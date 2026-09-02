// 클라이언트 상태(Zustand). `hydrateUiStore(store)`가 LocalStore kv 'ui:settings'에서 읽어 채우고,
// 이후 모든 상태 변경을 같은 키에 다시 쓴다(T-0-009·T-0-012 결정: 저장은 localStorage가 아니라
// platform LocalStore다). 저장 실패는 콘솔 경고만 남기고 화면을 막지 않는다.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { ProfileSettingsSchema, type ProfileSettings } from '@offside/contracts';
import type { LocalStore } from '@offside/engine-client';
import type { SimulationMode } from '@offside/domain';

export type ThemePreference = ProfileSettings['theme'];
export type ReducedMotionPreference = ProfileSettings['reducedMotion'];
export type TextScale = ProfileSettings['textScale'];

const UI_SETTINGS_KV_KEY = 'ui:settings';

type StoredUiSettings = ProfileSettings & { onboardingSeen: boolean };

const DEFAULT_SETTINGS: StoredUiSettings = {
  theme: 'SYSTEM',
  reducedMotion: 'SYSTEM',
  textScale: 100,
  defaultSimulationMode: 'FAST',
  onboardingSeen: false,
};

/** apps/web은 zod를 직접 의존하지 않는다(ADR-005). contracts의 ProfileSettingsSchema로 4개
 * 필드를 검증하고, onboardingSeen은 boolean 여부만 따로 확인한다. */
function parseStoredSettings(raw: unknown): StoredUiSettings | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { onboardingSeen, ...rest } = raw as Record<string, unknown>;
  if (typeof onboardingSeen !== 'boolean') return null;

  const parsed = ProfileSettingsSchema.safeParse(rest);
  if (!parsed.success) return null;

  return { ...parsed.data, onboardingSeen };
}

export interface UiState extends StoredUiSettings {
  setTheme: (theme: ThemePreference) => void;
  setReducedMotion: (reducedMotion: ReducedMotionPreference) => void;
  setTextScale: (textScale: TextScale) => void;
  setDefaultSimulationMode: (mode: SimulationMode) => void;
  setOnboardingSeen: (seen: boolean) => void;
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
}));

function persistedSlice(state: UiState): StoredUiSettings {
  return {
    theme: state.theme,
    reducedMotion: state.reducedMotion,
    textScale: state.textScale,
    defaultSimulationMode: state.defaultSimulationMode,
    onboardingSeen: state.onboardingSeen,
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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'SYSTEM') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme === 'DARK' ? 'dark' : 'light');
    }
  }, [theme]);

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
