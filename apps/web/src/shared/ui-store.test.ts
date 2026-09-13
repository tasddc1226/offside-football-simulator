import { act, renderHook } from '@testing-library/react';
import { MemoryLocalStore } from '@offside/engine-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateUiStore, useApplyTheme, useReducedMotion, useUiStore } from './ui-store.js';

describe('useApplyTheme', () => {
  beforeEach(() => {
    useUiStore.setState({ theme: 'SYSTEM', reducedMotion: 'SYSTEM', textScale: 100 });
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-text-scale');
    document.documentElement.removeAttribute('data-reduced-motion');
    document.documentElement.removeAttribute('data-accent');
    useUiStore.setState({ accentPreset: 'DEFAULT' });
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

  it('reducedMotion ON은 data-reduced-motion=true를 설정한다', () => {
    renderHook(() => useApplyTheme());

    act(() => {
      useUiStore.getState().setReducedMotion('ON');
    });
    expect(document.documentElement.dataset.reducedMotion).toBe('true');

    act(() => {
      useUiStore.getState().setReducedMotion('OFF');
    });
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
  });

  it('reducedMotion SYSTEM은(matchMedia 미구현 jsdom에서) data-reduced-motion을 남기지 않는다', () => {
    renderHook(() => useApplyTheme());

    act(() => {
      useUiStore.getState().setReducedMotion('SYSTEM');
    });

    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
  });

  it('accentPreset을 고르면 data-accent를 설정하고, DEFAULT로 되돌리면 지운다', () => {
    renderHook(() => useApplyTheme());

    act(() => {
      useUiStore.getState().setAccentPreset('green');
    });
    expect(document.documentElement.dataset.accent).toBe('green');

    act(() => {
      useUiStore.getState().setAccentPreset('DEFAULT');
    });
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });
});

describe('useReducedMotion', () => {
  beforeEach(() => {
    useUiStore.setState({ theme: 'SYSTEM', reducedMotion: 'SYSTEM', textScale: 100 });
  });

  it('ON이면 true, OFF면 false를 돌려준다', () => {
    useUiStore.setState({ reducedMotion: 'ON' });
    const on = renderHook(() => useReducedMotion());
    expect(on.result.current).toBe(true);

    useUiStore.setState({ reducedMotion: 'OFF' });
    const off = renderHook(() => useReducedMotion());
    expect(off.result.current).toBe(false);
  });

  it('SYSTEM이고 matchMedia가 없으면 false로 안전하게 대체한다', () => {
    useUiStore.setState({ reducedMotion: 'SYSTEM' });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});

describe('UX-001: 구단 이름 오버라이드', () => {
  afterEach(() => {
    useUiStore.setState({ teamNameOverrides: {} });
  });

  it('빈 값(트림 후)으로 바꾸면 오버라이드를 지운다', () => {
    useUiStore.getState().setTeamNameOverride('cheongyeon-fc', '내 팀');
    expect(useUiStore.getState().teamNameOverrides).toEqual({ 'cheongyeon-fc': '내 팀' });

    useUiStore.getState().setTeamNameOverride('cheongyeon-fc', '   ');
    expect(useUiStore.getState().teamNameOverrides).toEqual({});
  });

  it('resetTeamNameOverrides는 모든 오버라이드를 지운다', () => {
    useUiStore.getState().setTeamNameOverride('cheongyeon-fc', '내 팀');
    useUiStore.getState().setTeamNameOverride('seorabeol-united', '다른 팀');

    useUiStore.getState().resetTeamNameOverrides();

    expect(useUiStore.getState().teamNameOverrides).toEqual({});
  });
});

const DEFAULTS = {
  theme: 'SYSTEM' as const,
  reducedMotion: 'SYSTEM' as const,
  textScale: 100 as const,
  defaultSimulationMode: 'FAST' as const,
  onboardingSeen: false,
};

async function readPersisted(store: MemoryLocalStore): Promise<unknown> {
  return store.transaction('readonly', (tx) => tx.kv.get('ui:settings'));
}

describe('hydrateUiStore', () => {
  afterEach(() => {
    useUiStore.setState(DEFAULTS);
  });

  it('kv에 저장된 값이 없으면 기본값을 쓴다', async () => {
    const store = new MemoryLocalStore();

    await hydrateUiStore(store);

    expect(useUiStore.getState()).toMatchObject(DEFAULTS);
  });

  it('kv에 저장된 유효한 값을 읽어 스토어를 채운다', async () => {
    const store = new MemoryLocalStore();
    await store.transaction('readwrite', (tx) =>
      tx.kv.put('ui:settings', {
        theme: 'DARK',
        reducedMotion: 'ON',
        textScale: 150,
        defaultSimulationMode: 'FAST',
        onboardingSeen: true,
      }),
    );

    await hydrateUiStore(store);

    expect(useUiStore.getState()).toMatchObject({
      theme: 'DARK',
      reducedMotion: 'ON',
      textScale: 150,
      defaultSimulationMode: 'FAST',
      onboardingSeen: true,
    });
  });

  // 사용자 결정(2026-09-13, D-77): 이 기기에 남아 있던 옛 저장값(과거에는 CHAPTER를 고를 수 있었다)은
  // 무시하고 항상 FAST로 덮어쓴다 — 그 값 하나 때문에 나머지 저장값까지 기본값으로 초기화하지 않는다.
  it('옛 저장값이 CHAPTER여도 무시하고 FAST로 덮어쓰며, 다른 설정은 그대로 읽는다', async () => {
    const store = new MemoryLocalStore();
    await store.transaction('readwrite', (tx) =>
      tx.kv.put('ui:settings', {
        theme: 'DARK',
        reducedMotion: 'ON',
        textScale: 150,
        defaultSimulationMode: 'CHAPTER',
        onboardingSeen: true,
      }),
    );

    await hydrateUiStore(store);

    expect(useUiStore.getState()).toMatchObject({
      theme: 'DARK',
      reducedMotion: 'ON',
      textScale: 150,
      defaultSimulationMode: 'FAST',
      onboardingSeen: true,
    });
  });

  it('손상된 값(잘못된 타입·누락)은 기본값으로 대체한다', async () => {
    const store = new MemoryLocalStore();
    await store.transaction('readwrite', (tx) => tx.kv.put('ui:settings', { theme: 'NOT_A_THEME', onboardingSeen: true }));

    await hydrateUiStore(store);

    expect(useUiStore.getState()).toMatchObject(DEFAULTS);
  });

  it('accentPreset이 없던 옛 저장값도 DEFAULT로 안전하게 읽는다', async () => {
    const store = new MemoryLocalStore();
    await store.transaction('readwrite', (tx) => tx.kv.put('ui:settings', DEFAULTS));

    await hydrateUiStore(store);

    expect(useUiStore.getState().accentPreset).toBe('DEFAULT');
  });

  it('onboardingSeen이 boolean이 아니면 기본값으로 대체한다', async () => {
    const store = new MemoryLocalStore();
    await store.transaction('readwrite', (tx) =>
      tx.kv.put('ui:settings', { ...DEFAULTS, onboardingSeen: 'yes' }),
    );

    await hydrateUiStore(store);

    expect(useUiStore.getState()).toMatchObject(DEFAULTS);
  });

  it('읽기가 실패하면 콘솔 경고만 남기고 기본값을 쓴다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new MemoryLocalStore();
    const failingStore = {
      kind: store.kind,
      transaction: () => Promise.reject(new Error('강제 실패(테스트)')),
      close: () => store.close(),
    } as unknown as MemoryLocalStore;

    await hydrateUiStore(failingStore);

    expect(useUiStore.getState()).toMatchObject(DEFAULTS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('UX-001: teamNameOverrides가 저장값에 없어도 빈 객체로 안전하게 읽힌다', async () => {
    const store = new MemoryLocalStore();
    await store.transaction('readwrite', (tx) => tx.kv.put('ui:settings', { ...DEFAULTS }));

    await hydrateUiStore(store);

    expect(useUiStore.getState().teamNameOverrides).toEqual({});
  });

  it("UX-013: 구단 로고는 'ui:team-logos' 키에서 우리 형식의 data URL만 읽고, 바뀔 때만 그 키에 다시 쓴다", async () => {
    const store = new MemoryLocalStore();
    await store.transaction('readwrite', (tx) =>
      tx.kv.put('ui:team-logos', {
        'hangang-u18': 'data:image/webp;base64,QUJD',
        'cheongyeon-fc': 'https://evil.example/logo.png',
        'geumbit-fc': 42,
      }),
    );

    await hydrateUiStore(store);
    expect(useUiStore.getState().teamLogos).toEqual({ 'hangang-u18': 'data:image/webp;base64,QUJD' });

    act(() => {
      useUiStore.getState().setTeamLogo('geumbit-fc', 'data:image/png;base64,QUJDRA==');
      useUiStore.getState().clearTeamLogo('hangang-u18');
    });

    await vi.waitFor(async () => {
      expect(await store.transaction('readonly', (tx) => tx.kv.get('ui:team-logos'))).toEqual({
        'geumbit-fc': 'data:image/png;base64,QUJDRA==',
      });
    });
    expect(await readPersisted(store)).not.toHaveProperty('teamLogos');
    useUiStore.getState().resetTeamLogos();
    expect(useUiStore.getState().teamLogos).toEqual({});
  });

  it('hydrate 뒤 상태 변경은 같은 kv 키에 다시 저장된다', async () => {
    const store = new MemoryLocalStore();
    await hydrateUiStore(store);

    act(() => {
      useUiStore.getState().setTheme('DARK');
    });

    await vi.waitFor(async () => {
      expect(await readPersisted(store)).toMatchObject({ theme: 'DARK' });
    });
  });

  it('저장 실패는 화면을 막지 않고 콘솔 경고만 남긴다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inner = new MemoryLocalStore();
    const throwingStore = {
      kind: inner.kind,
      transaction: (mode: 'readonly' | 'readwrite', run: (tx: unknown) => Promise<unknown>) =>
        mode === 'readwrite' ? Promise.reject(new Error('저장 강제 실패(테스트)')) : inner.transaction(mode, run as never),
      close: () => inner.close(),
    } as unknown as MemoryLocalStore;

    await hydrateUiStore(throwingStore);

    act(() => {
      useUiStore.getState().setTheme('DARK');
    });

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });
    expect(useUiStore.getState().theme).toBe('DARK');
    warn.mockRestore();
  });
});
