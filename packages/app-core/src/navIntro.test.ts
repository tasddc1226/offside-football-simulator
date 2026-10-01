import { afterEach, describe, expect, it, vi } from 'vitest';
import { NAV_INTRO, takeNavIntro } from './navIntro.js';

function fakeStorage(full = false) {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
  });
}

describe('takeNavIntro', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('메뉴마다 처음 한 번만 안내한다', () => {
    fakeStorage();
    expect(takeNavIntro('game')).toBe(NAV_INTRO.game);
    expect(takeNavIntro('game')).toBeNull();
    expect(takeNavIntro('team')).toBe(NAV_INTRO.team);
    expect(takeNavIntro('team')).toBeNull();
  });

  it('본 것을 적지 못하면 띄우지 않는다(매번 뜨지 않게)', () => {
    fakeStorage(true);
    expect(takeNavIntro('game')).toBeNull();
  });
});
