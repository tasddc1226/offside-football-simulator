// 클라이언트 상태(Zustand). `hydrateUiStore(store)`가 LocalStore kv 'ui:settings'에서 읽어 채우고,
// 이후 모든 상태 변경을 같은 키에 다시 쓴다(T-0-009·T-0-012 결정: 저장은 localStorage가 아니라
// platform LocalStore다). 저장 실패는 콘솔 경고만 남기고 화면을 막지 않는다.
import { useEffect } from 'react';
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

/**
 * document.documentElement에 data-theme(SYSTEM이면 속성 제거)와 data-text-scale을 반영한다.
 * DSN-THM-001.
 */
export function useApplyTheme() {
  const theme = useUiStore((state) => state.theme);
  const textScale = useUiStore((state) => state.textScale);

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
}
