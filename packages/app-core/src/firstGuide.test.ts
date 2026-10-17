import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeGuide, guideOpen } from './firstGuide.js';

function fakeStorage(opts: { full?: boolean; broken?: boolean } = {}) {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (opts.broken) throw new Error('SecurityError');
      return m.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (opts.full || opts.broken) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
  });
  return m;
}

describe('처음 안내 카드', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('닫을 때까지 보이고, 닫으면 그 카드만 다시 뜨지 않는다', () => {
    fakeStorage();
    expect(guideOpen('home')).toBe(true);
    // 보여 주기만 해서는 닫은 것으로 적지 않는다.
    expect(guideOpen('home')).toBe(true);
    closeGuide('home');
    expect(guideOpen('home')).toBe(false);
    expect(guideOpen('items')).toBe(true);
    closeGuide('items');
    closeGuide('items');
    expect(guideOpen('items')).toBe(false);
  });

  it('저장소에 적을 수 없으면 띄우지 않는다(닫아도 매번 다시 뜨지 않게)', () => {
    fakeStorage({ full: true });
    expect(guideOpen('home')).toBe(false);
    expect(() => closeGuide('home')).not.toThrow();
  });

  it('저장소를 읽지 못해도 던지지 않는다', () => {
    fakeStorage({ broken: true });
    expect(guideOpen('items')).toBe(false);
    expect(() => closeGuide('items')).not.toThrow();
  });

  it('깨진 값은 무시한다', () => {
    const m = fakeStorage();
    m.set('ft_first_guide', JSON.stringify({ home: true }));
    expect(guideOpen('home')).toBe(true);
    m.set('ft_first_guide', JSON.stringify(['home', 7]));
    expect(guideOpen('home')).toBe(false);
  });
});
