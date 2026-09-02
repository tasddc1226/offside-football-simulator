import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useApplyTheme, useUiStore } from './ui-store.js';

describe('useApplyTheme', () => {
  beforeEach(() => {
    useUiStore.setState({ theme: 'SYSTEM', reducedMotion: 'SYSTEM', textScale: 100 });
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-text-scale');
  });

  it('SYSTEM이면 data-theme 속성을 제거한다', () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    renderHook(() => useApplyTheme());

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('DARK를 고르면 즉시 data-theme=dark를 설정한다', () => {
    renderHook(() => useApplyTheme());

    act(() => {
      useUiStore.getState().setTheme('DARK');
    });

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('LIGHT를 고르면 data-theme=light를 설정하고, 다시 SYSTEM으로 돌리면 제거한다', () => {
    renderHook(() => useApplyTheme());

    act(() => {
      useUiStore.getState().setTheme('LIGHT');
    });
    expect(document.documentElement.dataset.theme).toBe('light');

    act(() => {
      useUiStore.getState().setTheme('SYSTEM');
    });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('textScale을 data-text-scale에 반영한다', () => {
    renderHook(() => useApplyTheme());

    act(() => {
      useUiStore.getState().setTextScale(125);
    });

    expect(document.documentElement.dataset.textScale).toBe('125');
  });
});
