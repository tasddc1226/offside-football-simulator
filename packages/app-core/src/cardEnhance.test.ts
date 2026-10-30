import { DEFAULT_ENHANCE_RULES } from '@offside/contracts/card-enhance';
import { describe, expect, it } from 'vitest';
import { enhanceErrorText, enhanceSellNote, enhanceView } from './cardEnhance.js';
import { cardEnhanceText as L } from './i18n/ko/cardEnhance.js';

describe('카드 강화 창 (T-11-373)', () => {
  const open = { ...DEFAULT_ENHANCE_RULES, open: true };
  const card = { level: 0, fails: 0, starts: 10, used: 0 };

  it('시도할 수 있으면 서버에 보낼 본 값을 만든다', () => {
    const v = enhanceView(card, open, 1_000_000);
    expect(v.block).toBeNull();
    expect(v.ratePct).toBe('90%');
    expect(v.body).toEqual({ level: 0, fails: 0, used: 0, cost: 100_000, rateBp: 9000 });
    expect(v.ovrText).toBe(L.ovr({ now: 0, next: 1 }));
    expect(v.ceilingText).toBe(L.ceiling({ n: 1 }));
  });

  it('천장이면 확정으로 보이고, 막는 이유를 차례로 알린다', () => {
    expect(enhanceView({ ...card, fails: 1 }, open, 1_000_000)).toMatchObject({
      ratePct: '100%',
      ceilingText: L.sure,
    });
    expect(enhanceView(card, DEFAULT_ENHANCE_RULES, 1_000_000).block).toBe(L.closed);
    expect(enhanceView(card, open, 1_000_000, true).block).toBe(L.listed);
    expect(enhanceView({ ...card, used: 1 }, open, 1_000_000)).toMatchObject({
      block: L.noTry,
      body: null,
    });
    expect(enhanceView(card, open, 99_999).block).toBe(L.short);
    expect(enhanceView({ ...card, level: 5 }, open, 1_000_000)).toMatchObject({
      block: L.max,
      ovrText: null,
      ceilingText: null,
    });
  });

  it('거절 이유 · 판매 안내', () => {
    expect(enhanceErrorText({ reason: 'ENHANCE_NO_TRY' })).toBe(L.noTry);
    expect(enhanceErrorText({ reason: 'X', message: '서버 문구' })).toBe('서버 문구');
    expect(enhanceSellNote(0)).toBeNull();
    expect(enhanceSellNote(2)).toContain('+2');
  });
});
