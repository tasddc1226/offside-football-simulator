// 클라이언트 상태(Zustand). `hydrateUiStore(store)`가 LocalStore kv 'ui:settings'에서 읽어 채우고,
// 이후 모든 상태 변경을 같은 키에 다시 쓴다(T-0-009·T-0-012 결정: 저장은 localStorage가 아니라
// platform LocalStore다). 저장 실패는 콘솔 경고만 남기고 화면을 막지 않는다.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { ProfileSettingsSchema, type ProfileSettings } from '@offside/contracts';
import type { LocalStore } from '@offside/engine-client';
import type { SimulationMode } from '@offside/domain';
import { ACCENT_PRESET_IDS, type AccentPresetId } from './accent-presets.js';

export type ThemePreference = ProfileSettings['theme'];
export type ReducedMotionPreference = ProfileSettings['reducedMotion'];
export type TextScale = ProfileSettings['textScale'];
export type { AccentPresetId };

const UI_SETTINGS_KV_KEY = 'ui:settings';
/** UX-001: 구단 이름 커스터마이즈 트림 후 길이 규칙. 빈 값은 오버라이드 제거(기본 이름 복귀)다. */
const TEAM_NAME_OVERRIDE_MAX_LENGTH = 16;

type StoredUiSettings = ProfileSettings & {
  onboardingSeen: boolean;
  accentPreset: AccentPresetId;
  /** UX-001: 팀 id → 커스텀 표시 이름. 기기 로컬 전용(서버 ProfileSettings에는 없다) — 팀 id가
   * 없으면 룰셋 기본 이름을 그대로 쓴다. */
  teamNameOverrides: Record<string, string>;
};

const DEFAULT_SETTINGS: StoredUiSettings = {
  theme: 'SYSTEM',
  reducedMotion: 'SYSTEM',
  textScale: 100,
  defaultSimulationMode: 'FAST',
  onboardingSeen: false,
  accentPreset: 'DEFAULT',
  teamNameOverrides: {},
};

function isAccentPresetId(value: unknown): value is AccentPresetId {
  return typeof value === 'string' && (ACCENT_PRESET_IDS as readonly string[]).includes(value);
}

/** 손상된 값이 섞여도 유효한 항목만 남긴다(트림 1~16자, 문자열 값만) — 저장값에 필드가 아예 없던
 * 과거 버전도 빈 객체로 안전하게 읽힌다. */
function parseTeamNameOverrides(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [teamId, name] of Object.entries(value as Record<string, unknown>)) {
    if (teamId.length === 0 || typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > TEAM_NAME_OVERRIDE_MAX_LENGTH) continue;
    result[teamId] = trimmed;
  }
  return result;
}

/** apps/web은 zod를 직접 의존하지 않는다(ADR-005). contracts의 ProfileSettingsSchema는 strictObject라
 * accentPreset·teamNameOverrides(둘 다 로컬 전용이라 contracts에는 없음)는 onboardingSeen과 같이 먼저
 * 떼어내고 별도로 검증해야 한다 — 안 떼면 매번 파싱이 실패해 기본값으로 되돌아간다. */
function parseStoredSettings(raw: unknown): StoredUiSettings | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { onboardingSeen, accentPreset, teamNameOverrides, ...rest } = raw as Record<string, unknown>;
  if (typeof onboardingSeen !== 'boolean') return null;

  const parsed = ProfileSettingsSchema.safeParse(rest);
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    onboardingSeen,
    accentPreset: isAccentPresetId(accentPreset) ? accentPreset : 'DEFAULT',
    teamNameOverrides: parseTeamNameOverrides(teamNameOverrides),
  };
}

export interface UiState extends StoredUiSettings {
  setTheme: (theme: ThemePreference) => void;
  setReducedMotion: (reducedMotion: ReducedMotionPreference) => void;
  setTextScale: (textScale: TextScale) => void;
  setDefaultSimulationMode: (mode: SimulationMode) => void;
  setOnboardingSeen: (seen: boolean) => void;
  setAccentPreset: (accentPreset: AccentPresetId) => void;
  /** 트림 후 빈 값이면 오버라이드를 지운다(기본 이름 복귀). 16자를 넘는 값은 잘라서 저장한다. */
  setTeamNameOverride: (teamId: string, name: string) => void;
  resetTeamNameOverrides: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  ...DEFAULT_SETTINGS,
  setTheme: (theme) => {
    set({ theme });
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
  },
  setTextScale: (textScale) => {
    set({ textScale });
  },
  setDefaultSimulationMode: (defaultSimulationMode) => {
    set({ defaultSimulationMode });
  },
  setOnboardingSeen: (onboardingSeen) => {
    set({ onboardingSeen });
  },
  setAccentPreset: (accentPreset) => {
    set({ accentPreset });
  },
  setTeamNameOverride: (teamId, name) => {
    set((state) => {
      const trimmed = name.trim().slice(0, TEAM_NAME_OVERRIDE_MAX_LENGTH);
      const next = { ...state.teamNameOverrides };
      if (trimmed.length === 0) {
        delete next[teamId];
      } else {
        next[teamId] = trimmed;
      }
      return { teamNameOverrides: next };
    });
  },
  resetTeamNameOverrides: () => {
    set({ teamNameOverrides: {} });
  },
}));

function persistedSlice(state: UiState): StoredUiSettings {
  return {
    theme: state.theme,
    reducedMotion: state.reducedMotion,
    textScale: state.textScale,
    defaultSimulationMode: state.defaultSimulationMode,
    onboardingSeen: state.onboardingSeen,
    accentPreset: state.accentPreset,
    teamNameOverrides: state.teamNameOverrides,
  };
}

let unsubscribePersist: (() => void) | null = null;

/**
 * kv에서 읽어(검증 실패·없음이면 기본값) 스토어를 채우고, 이후 모든 변경을 구독해 같은 키에
 * 다시 쓴다. 같은 세션에서 다시 호출되면(예: 테스트) 이전 구독을 먼저 해지한다.
 */
export async function hydrateUiStore(store: LocalStore): Promise<void> {
  let initial: StoredUiSettings = DEFAULT_SETTINGS;
  try {
    const raw = await store.transaction('readonly', (tx) => tx.kv.get<unknown>(UI_SETTINGS_KV_KEY));
    const parsed = raw === undefined ? null : parseStoredSettings(raw);
    if (parsed !== null) {
      initial = parsed;
    }
  } catch (error) {
    console.warn('hydrateUiStore: 설정을 읽지 못해 기본값을 사용한다.', error);
  }

  unsubscribePersist?.();
  useUiStore.setState(initial);
  unsubscribePersist = useUiStore.subscribe((state) => {
    store.transaction('readwrite', (tx) => tx.kv.put(UI_SETTINGS_KV_KEY, persistedSlice(state))).catch((error: unknown) => {
      console.warn('ui-store: 설정 저장 실패', error);
    });
  });
}

/** jsdom은 기본적으로 matchMedia를 구현하지 않는다 — 없으면 "시스템 선호 없음"으로 취급한다. */
function reducedMotionMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

/**
 * document.documentElement에 data-theme(SYSTEM이면 속성 제거)·data-text-scale·data-reduced-motion을
 * 반영한다. DSN-THM-001. data-reduced-motion은 T-1-007 리뷰에서 발견된 버그 수정: OS 미디어쿼리
 * (`prefers-reduced-motion: reduce`)만으로는 앱 설정에서 명시적으로 ON을 고른 경우를 못 잡는다.
 */
export function useApplyTheme() {
  const theme = useUiStore((state) => state.theme);
  const textScale = useUiStore((state) => state.textScale);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const accentPreset = useUiStore((state) => state.accentPreset);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'SYSTEM') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme === 'DARK' ? 'dark' : 'light');
    }
  }, [theme]);

  // UX-004: tokens.css의 :root[data-accent='...'] 블록과 짝을 이룬다. 'DEFAULT'는 속성을 지워
  // 기본 네이비(:root 베이스)로 되돌린다.
  useEffect(() => {
    const root = document.documentElement;
    if (accentPreset === 'DEFAULT') {
      root.removeAttribute('data-accent');
    } else {
      root.setAttribute('data-accent', accentPreset);
    }
  }, [accentPreset]);

  useEffect(() => {
    document.documentElement.setAttribute('data-text-scale', String(textScale));
  }, [textScale]);

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion === 'ON') {
      root.setAttribute('data-reduced-motion', 'true');
      return;
    }
    if (reducedMotion === 'OFF') {
      root.removeAttribute('data-reduced-motion');
      return;
    }

    const query = reducedMotionMediaQuery();
    if (query === null) {
      root.removeAttribute('data-reduced-motion');
      return;
    }
    const applyFromSystem = () => {
      if (query.matches) root.setAttribute('data-reduced-motion', 'true');
      else root.removeAttribute('data-reduced-motion');
    };
    applyFromSystem();
    query.addEventListener('change', applyFromSystem);
    return () => {
      query.removeEventListener('change', applyFromSystem);
    };
  }, [reducedMotion]);
}

/**
 * 애니메이션·Stepper 등 JS 쪽 모션 분기에 쓰는 boolean. 앱 설정(ON/OFF)이 시스템 선호보다 우선하고,
 * SYSTEM이면 `prefers-reduced-motion: reduce` 미디어쿼리를 구독한다.
 */
export function useReducedMotion(): boolean {
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const [systemReduced, setSystemReduced] = useState(() => reducedMotionMediaQuery()?.matches ?? false);

  useEffect(() => {
    const query = reducedMotionMediaQuery();
    if (query === null) return;
    const handleChange = () => {
      setSystemReduced(query.matches);
    };
    handleChange();
    query.addEventListener('change', handleChange);
    return () => {
      query.removeEventListener('change', handleChange);
    };
  }, []);

  if (reducedMotion === 'ON') return true;
  if (reducedMotion === 'OFF') return false;
  return systemReduced;
}
