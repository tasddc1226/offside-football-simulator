import { DEFAULT_ENHANCE_RULES } from '@offside/contracts/card-enhance';
import { describe, expect, it } from 'vitest';
import {
  enhanceErrorText,
  enhanceResultKind,
  enhanceResultText,
  enhanceSellNote,
  enhanceView,
} from './cardEnhance.js';
import { cardEnhanceText as L } from './i18n/ko/cardEnhance.js';

describe('카드 강화 창 (T-11-373)', () => {
  const open = { ...DEFAULT_ENHANCE_RULES, open: true };
  const card = { level: 0, fails: 0, tier: 'normal' as const };

  it('시도할 수 있으면 서버에 보낼 본 값을 만든다', () => {
    const v = enhanceView(card, open, 1_000_000);
    expect(v.block).toBeNull();
    expect(v.ratePct).toBe('90%');
    expect(v.body).toEqual({ level: 0, fails: 0, cost: 100_000, rateBp: 9000, downBp: 0 });
    expect(v.ovrText).toBe(L.ovr({ now: 0, next: 1 }));
    expect(v).toMatchObject({ keepPct: '10%', downPct: '0%', failText: L.failSafe });
    expect(enhanceView({ ...card, level: 3 }, open, 1_000_000)).toMatchObject({
      ratePct: '45%',
      keepPct: '40%',
      downPct: '15%',
      failText: L.failNote({ lv: 2 }),
    });
  });

  it('실패해도 확률이 그대로이고, 막는 이유를 차례로 알린다', () => {
    // 실패해도 확률은 그대로다(천장 없음).
    expect(enhanceView({ ...card, fails: 9 }, open, 1_000_000).ratePct).toBe('90%');
    expect(enhanceView(card, DEFAULT_ENHANCE_RULES, 1_000_000).block).toBe(L.closed);
    expect(enhanceView(card, open, 1_000_000, true).block).toBe(L.listed);
    expect(enhanceView(card, open, 99_999).block).toBe(L.short);
    expect(enhanceView({ ...card, level: 10 }, open, 1_000_000)).toMatchObject({
      block: L.max,
      ovrText: null,
    });
  });

  it('레전드 · 아이콘 카드는 낮은 확률과 이유를 보여 주고, 본 값도 그 확률이다', () => {
    const icon = enhanceView({ ...card, tier: 'icon' }, open, 1_000_000);
    expect(icon).toMatchObject({ ratePct: '72%', keepPct: '28%', tierText: L.tierIcon });
    expect(icon.body?.rateBp).toBe(7200);
    expect(enhanceView({ ...card, tier: 'legend' }, open, 1_000_000).ratePct).toBe('81%');
    expect(enhanceView(card, open, 1_000_000).tierText).toBeNull();
  });

  it('결과 문구: 성공 · 유지 · 실패(-1)', () => {
    expect(enhanceResultKind({ success: true, from: 3, to: 4 })).toBe('success');
    expect(enhanceResultKind({ success: false, from: 3, to: 3 })).toBe('keep');
    expect(enhanceResultKind({ success: false, from: 3, to: 2 })).toBe('down');
    expect(enhanceResultText({ success: false, from: 3, to: 2 })).toBe(
      L.failDown({ from: 3, to: 2 }),
    );
    expect(enhanceResultText({ success: false, from: 3, to: 3 })).toBe(L.failKeep({ lv: 3 }));
  });

  it('거절 이유 · 판매 안내', () => {
    expect(enhanceErrorText({ reason: 'FUNDS_SHORT' })).toBe(L.short);
    expect(enhanceErrorText({ reason: 'X', message: '서버 문구' })).toBe('서버 문구');
    expect(enhanceSellNote(0)).toBeNull();
    expect(enhanceSellNote(2)).toContain('+2');
  });
});
