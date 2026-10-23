import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeGuide, guideOpen, saveHintOpen } from './firstGuide.js';

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

describe('상품 · 저장 위치 안내', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('닫을 때까지 보이고, 닫으면 그 카드만 다시 뜨지 않는다', () => {
    fakeStorage();
    expect(guideOpen('save')).toBe(true);
    // 보여 주기만 해서는 닫은 것으로 적지 않는다.
    expect(guideOpen('save')).toBe(true);
    closeGuide('save');
    expect(guideOpen('save')).toBe(false);
    expect(guideOpen('items')).toBe(true);
    closeGuide('items');
    closeGuide('items');
    expect(guideOpen('items')).toBe(false);
  });

  it('저장소에 적을 수 없으면 띄우지 않는다(닫아도 매번 다시 뜨지 않게)', () => {
    fakeStorage({ full: true });
    expect(guideOpen('save')).toBe(false);
    expect(() => closeGuide('save')).not.toThrow();
  });

  it('저장소를 읽지 못해도 던지지 않는다', () => {
    fakeStorage({ broken: true });
    expect(guideOpen('items')).toBe(false);
    expect(() => closeGuide('items')).not.toThrow();
  });

  it('깨진 값은 무시한다', () => {
    const m = fakeStorage();
    m.set('ft_first_guide', JSON.stringify({ home: true }));
    expect(guideOpen('save')).toBe(true);
    m.set('ft_first_guide', JSON.stringify(['save', 7]));
    expect(guideOpen('save')).toBe(false);
  });

  it('T-11-473 옛 홈 처음 안내 카드를 닫은 값이 남아 있어도 다른 안내는 그대로 뜬다', () => {
    const m = fakeStorage();
    m.set('ft_first_guide', JSON.stringify(['home']));
    expect(guideOpen('items')).toBe(true);
    expect(guideOpen('save')).toBe(true);
  });

  it('T-11-437 저장 위치 안내는 첫 시즌에만, 닫으면 다시 뜨지 않고 다른 카드와 따로 기억한다', () => {
    fakeStorage();
    expect(saveHintOpen(0)).toBe(true);
    expect(saveHintOpen(1)).toBe(false);
    closeGuide('items');
    expect(saveHintOpen(0)).toBe(true);
    closeGuide('save');
    expect(saveHintOpen(0)).toBe(false);
    expect(guideOpen('items')).toBe(false);
  });
});
