// 클라이언트 상태(Zustand). `hydrateUiStore(store)`가 LocalStore kv 'ui:settings'에서 읽어 채우고,
// 이후 모든 상태 변경을 같은 키에 다시 쓴다(T-0-009·T-0-012 결정: 저장은 localStorage가 아니라
// platform LocalStore다). 저장 실패는 콘솔 경고만 남기고 화면을 막지 않는다.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { ProfileSettingsSchema, type ProfileSettings } from '@offside/contracts';
import type { LocalStore } from '@offside/engine-client';
import { ACCENT_PRESET_IDS, type AccentPresetId } from './accent-presets.js';
import { isTeamLogoDataUrl } from './team-logo.js';
import { FIXED_SIMULATION_MODE } from './start-season.js';

export type ThemePreference = ProfileSettings['theme'];
export type ReducedMotionPreference = ProfileSettings['reducedMotion'];
export type TextScale = ProfileSettings['textScale'];
export type { AccentPresetId };

const UI_SETTINGS_KV_KEY = 'ui:settings';
/** UX-013: 구단 로고(data URL 문자열)는 'ui:settings'의 형제 키에 따로 둔다 — 12팀 × ≤40KB라 테마
 * 토글 같은 사소한 변경마다 다시 쓰지 않게 하고(toss 채널은 문자열 KV, ADR-002), 로고가 바뀔 때만 쓴다. */
const UI_TEAM_LOGOS_KV_KEY = 'ui:team-logos';
/** UX-001: 구단 이름 커스터마이즈 트림 후 길이 규칙. 빈 값은 오버라이드 제거(기본 이름 복귀)다. */
const TEAM_NAME_OVERRIDE_MAX_LENGTH = 16;

type StoredUiSettings = ProfileSettings & {
  onboardingSeen: boolean;
  accentPreset: AccentPresetId;
  /** UX-001: 팀 id → 커스텀 표시 이름. 기기 로컬 전용(서버 ProfileSettings에는 없다) — 팀 id가
   * 없으면 룰셋 기본 이름을 그대로 쓴다. */
  teamNameOverrides: Record<string, string>;
};

/** UX-013: 팀 id → 이 기기에 올린 로고 data URL. 기기 로컬 전용, contracts 스키마 밖, 별도 kv 키. */
export type TeamLogos = Record<string, string>;

const DEFAULT_SETTINGS: StoredUiSettings = {
  theme: 'SYSTEM',
  reducedMotion: 'SYSTEM',
  textScale: 100,
  // 사용자 결정(2026-09-13, D-77): 더 이상 사용자가 고르지 않는다 — contracts의 ProfileSettingsSchema가
  // 여전히 이 필드를 요구해(수정 금지 경계) 타입 호환을 위해 남겨 두지만 항상 FIXED_SIMULATION_MODE다.
  defaultSimulationMode: FIXED_SIMULATION_MODE,
  onboardingSeen: false,
  accentPreset: 'DEFAULT',
  teamNameOverrides: {},
};

const DEFAULT_TEAM_LOGOS: TeamLogos = {};

function isAccentPresetId(value: unknown): value is AccentPresetId {
  return typeof value === 'string' && (ACCENT_PRESET_IDS as readonly string[]).includes(value);
}

/** 손상된 값이 섞여도 우리 형식의 data URL만 남긴다(없던 저장값은 빈 객체). */
function parseTeamLogos(value: unknown): TeamLogos {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const result: TeamLogos = {};
  for (const [teamId, dataUrl] of Object.entries(value as Record<string, unknown>)) {
    if (teamId.length === 0 || !isTeamLogoDataUrl(dataUrl)) continue;
    result[teamId] = dataUrl;
  }
  return result;
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
    // 사용자 결정(2026-09-13, D-77): 기기에 남아 있던 옛 저장값(과거에는 CHAPTER를 고를 수 있었다)은
    // 무시하고 항상 FIXED_SIMULATION_MODE로 덮어쓴다 — 그 값 하나 때문에 다른 설정까지 초기화하지 않는다.
    defaultSimulationMode: FIXED_SIMULATION_MODE,
    onboardingSeen,
    accentPreset: isAccentPresetId(accentPreset) ? accentPreset : 'DEFAULT',
    teamNameOverrides: parseTeamNameOverrides(teamNameOverrides),
  };
}

export interface UiState extends StoredUiSettings {
  teamLogos: TeamLogos;
  setTheme: (theme: ThemePreference) => void;
  setReducedMotion: (reducedMotion: ReducedMotionPreference) => void;
  setTextScale: (textScale: TextScale) => void;
  setOnboardingSeen: (seen: boolean) => void;
  setAccentPreset: (accentPreset: AccentPresetId) => void;
  /** 트림 후 빈 값이면 오버라이드를 지운다(기본 이름 복귀). 16자를 넘는 값은 잘라서 저장한다. */
  setTeamNameOverride: (teamId: string, name: string) => void;
  resetTeamNameOverrides: () => void;
  /** UX-013: team-logo.ts processTeamLogo가 만든 data URL만 넣는다(형식 밖 값은 무시). */
  setTeamLogo: (teamId: string, dataUrl: string) => void;
  /** 기본 로고(이니셜 배지) 복원. */
  clearTeamLogo: (teamId: string) => void;
  resetTeamLogos: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  ...DEFAULT_SETTINGS,
  teamLogos: DEFAULT_TEAM_LOGOS,
  setTheme: (theme) => {
    set({ theme });
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
  },
  setTextScale: (textScale) => {
    set({ textScale });
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
  setTeamLogo: (teamId, dataUrl) => {
    if (teamId.length === 0 || !isTeamLogoDataUrl(dataUrl)) return;
    set((state) => ({ teamLogos: { ...state.teamLogos, [teamId]: dataUrl } }));
  },
  clearTeamLogo: (teamId) => {
    set((state) => {
      if (!(teamId in state.teamLogos)) return {};
      const next = { ...state.teamLogos };
      delete next[teamId];
      return { teamLogos: next };
    });
  },
  resetTeamLogos: () => {
    set({ teamLogos: {} });
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
  let initialTeamLogos: TeamLogos = DEFAULT_TEAM_LOGOS;
  try {
    const { settings, logos } = await store.transaction('readonly', async (tx) => ({
      settings: await tx.kv.get<unknown>(UI_SETTINGS_KV_KEY),
      logos: await tx.kv.get<unknown>(UI_TEAM_LOGOS_KV_KEY),
    }));
    const parsed = settings === undefined ? null : parseStoredSettings(settings);
    if (parsed !== null) {
      initial = parsed;
    }
    initialTeamLogos = parseTeamLogos(logos);
  } catch (error) {
    console.warn('hydrateUiStore: 설정을 읽지 못해 기본값을 사용한다.', error);
  }

  unsubscribePersist?.();
  useUiStore.setState({ ...initial, teamLogos: initialTeamLogos });
  unsubscribePersist = useUiStore.subscribe((state, previous) => {
    store.transaction('readwrite', (tx) => tx.kv.put(UI_SETTINGS_KV_KEY, persistedSlice(state))).catch((error: unknown) => {
      console.warn('ui-store: 설정 저장 실패', error);
    });
    if (state.teamLogos !== previous.teamLogos) {
      store.transaction('readwrite', (tx) => tx.kv.put(UI_TEAM_LOGOS_KV_KEY, state.teamLogos)).catch((error: unknown) => {
        console.warn('ui-store: 구단 로고 저장 실패', error);
      });
    }
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
