// 클라이언트 상태(Zustand). 영속화하지 않는다 — 저장은 T-0-012의 platform LocalStore가 맡는다.
import { useEffect } from 'react';
import { create } from 'zustand';

export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK';
export type ReducedMotionPreference = 'SYSTEM' | 'ON' | 'OFF';
export type TextScale = 100 | 125 | 150;

export interface UiState {
  theme: ThemePreference;
  reducedMotion: ReducedMotionPreference;
  textScale: TextScale;
  setTheme: (theme: ThemePreference) => void;
  setReducedMotion: (reducedMotion: ReducedMotionPreference) => void;
  setTextScale: (textScale: TextScale) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'SYSTEM',
  reducedMotion: 'SYSTEM',
  textScale: 100,
  setTheme: (theme) => {
    set({ theme });
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
  },
  setTextScale: (textScale) => {
    set({ textScale });
  },
}));

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
