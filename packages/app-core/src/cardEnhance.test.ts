import { DEFAULT_ENHANCE_RULES } from '@offside/contracts/card-enhance';
import { describe, expect, it } from 'vitest';
import {
  enhanceErrorText,
  enhanceFxBig,
  enhanceFxMs,
  enhanceParticles,
  enhanceResultKind,
  enhanceResultText,
  enhanceSellNote,
  enhanceLossNote,
  showsPosOvr,
  enhanceView,
} from './cardEnhance.js';
import { cardEnhanceText as L } from './i18n/ko/cardEnhance.js';
import { marketSalaryText } from './salary.js';

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

  it('최고 OVR이 높은 카드는 낮은 확률과 이유를 보여 주고, 본 값도 그 확률이다', () => {
    const top = enhanceView({ ...card, tier: 'top' }, open, 1_000_000);
    expect(top).toMatchObject({ ratePct: '72%', keepPct: '28%', tierText: L.tierTop });
    expect(top.body?.rateBp).toBe(7200);
    expect(enhanceView({ ...card, tier: 'high' }, open, 1_000_000).ratePct).toBe('81%');
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

  it('자리 OVR은 제 자리가 아닐 때만 따로 보인다(강화 OVR만큼 높은 것은 제 자리)', () => {
    expect(showsPosOvr(84, 84, 0)).toBe(false);
    expect(showsPosOvr(84, 87, 3)).toBe(false);
    expect(showsPosOvr(84, 79, 0)).toBe(true);
    expect(showsPosOvr(84, 82, 3)).toBe(true);
    // 강화 덕에 최고 OVR과 숫자가 같아져도 제 자리가 아니면 보인다(제 자리면 87이다).
    expect(showsPosOvr(84, 84, 3)).toBe(true);
    expect(showsPosOvr(84, 87, null)).toBe(true);
  });

  it('방출 · 과제 확인에는 강화한 선수가 있을 때만 경고한다', () => {
    expect(enhanceLossNote([{ enhance: 0 }, {}])).toBeNull();
    expect(enhanceLossNote([{ enhance: 3 }, { enhance: 1 }, {}])).toBe(L.lossNote({ n: 2 }));
  });

  it('이적시장 급여는 강화 OVR까지 넣어 보인다', () => {
    const plain = { peak: 85, season: 0 };
    expect(marketSalaryText({ ...plain, enhance: 10 }, 1)).not.toBe(marketSalaryText(plain, 1));
    expect(marketSalaryText({ ...plain, enhance: 10 }, 1)).toBe(
      marketSalaryText({ peak: 95, season: 0 }, 1),
    );
  });
});

describe('T-11-639 강화 연출 값', () => {
  it('높은 단계 성공만 크게, 길이는 결과마다 다르다', () => {
    expect(enhanceFxBig({ success: true, to: 7 })).toBe(true);
    expect(enhanceFxBig({ success: true, to: 6 })).toBe(false);
    expect(enhanceFxBig({ success: false, to: 8 })).toBe(false);
    expect(enhanceFxMs({ success: true, from: 7, to: 8 })).toBeGreaterThan(
      enhanceFxMs({ success: true, from: 1, to: 2 }),
    );
    expect(enhanceFxMs({ success: false, from: 2, to: 2 })).toBeLessThan(
      enhanceFxMs({ success: false, from: 2, to: 1 }),
    );
  });
  it('입자 배치는 범위 안의 고정값이다', () => {
    const a = enhanceParticles(24);
    expect(a).toHaveLength(24);
    expect(a).toEqual(enhanceParticles(24));
    for (const x of a) {
      expect(x.dist).toBeGreaterThanOrEqual(0.55);
      expect(x.dist).toBeLessThanOrEqual(1);
      expect(x.delay).toBeLessThan(1);
    }
  });
});
