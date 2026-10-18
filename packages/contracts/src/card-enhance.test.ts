import { describe, expect, it } from 'vitest';
import { BALANCE_SPEC } from './balance-spec.js';
import {
  DEFAULT_ENHANCE_RULES,
  ENHANCE_COSTS,
  ENHANCE_MAX,
  ENHANCE_RATES,
  ENHANCE_VALUE,
  enhanceBoost,
  enhanceCost,
  enhanceExpectedCost,
  enhanceOutcome,
  enhanceRate,
  enhanceValue,
} from './card-enhance.js';

describe('T-11-373 카드 강화 표', () => {
  it('확률 · 비용표는 단계 수와 같고 확률은 내려가며 비용은 오른다', () => {
    expect(ENHANCE_RATES).toHaveLength(ENHANCE_MAX);
    expect(ENHANCE_COSTS).toHaveLength(ENHANCE_MAX);
    for (let l = 1; l < ENHANCE_MAX; l++) {
      expect(ENHANCE_RATES[l]!).toBeLessThan(ENHANCE_RATES[l - 1]!);
      expect(ENHANCE_COSTS[l]!).toBeGreaterThan(ENHANCE_COSTS[l - 1]!);
    }
  });

  it('밸런스 기본값이 이 표의 기본 규칙과 같다', () => {
    expect({
      costScale: BALANCE_SPEC.enhanceCostScale.def,
      rateScale: BALANCE_SPEC.enhanceRateScale.def,
      pity: BALANCE_SPEC.enhancePity.def,
      dailyCap: BALANCE_SPEC.enhanceDailyCap.def,
      effectScale: BALANCE_SPEC.enhanceEffectScale.def,
    }).toEqual(DEFAULT_ENHANCE_RULES);
  });

  it('천장: 연속 실패마다 기본 확률의 10%씩 오르고 1을 넘지 않는다', () => {
    expect(enhanceRate(9, 0, DEFAULT_ENHANCE_RULES)).toBe(0.2);
    expect(enhanceRate(9, 3, DEFAULT_ENHANCE_RULES)).toBe(0.26);
    expect(enhanceRate(1, 50, DEFAULT_ENHANCE_RULES)).toBe(1);
    expect(enhanceRate(ENHANCE_MAX, 0, DEFAULT_ENHANCE_RULES)).toBe(0);
  });

  it('+7 시도부터 실패하면 한 단계 내려가고, 그 아래는 그대로다', () => {
    expect(enhanceOutcome(5, 2, 0.99, DEFAULT_ENHANCE_RULES)).toEqual({
      success: false,
      to: 5,
      fails: 3,
    });
    expect(enhanceOutcome(6, 0, 0.99, DEFAULT_ENHANCE_RULES)).toEqual({
      success: false,
      to: 5,
      fails: 1,
    });
    expect(enhanceOutcome(6, 4, 0.1, DEFAULT_ENHANCE_RULES)).toEqual({
      success: true,
      to: 7,
      fails: 0,
    });
  });

  it('비용 배율은 100만 원 단위로 반올림하고 +10이면 비용이 없다', () => {
    expect(enhanceCost(0, { costScale: 1 })).toBe(50_000);
    expect(enhanceCost(9, { costScale: 0.33 })).toBe(825_000);
    expect(enhanceCost(ENHANCE_MAX, { costScale: 1 })).toBeNull();
  });

  it('효과는 +5까지 0.1씩, 그 뒤 0.3씩 — +10이면 2.0, 배율 0이면 0', () => {
    expect([0, 1, 5, 6, 10].map((l) => enhanceBoost(l))).toEqual([0, 0.1, 0.5, 0.8, 2]);
    expect(enhanceBoost(10, 0)).toBe(0);
    expect(enhanceBoost(10, 0.5)).toBe(1);
  });

  it('강화 가치 표는 기본 규칙의 기대 비용 절반(100만 원 단위)이다', () => {
    const table = Array.from({ length: ENHANCE_MAX + 1 }, (_, t) =>
      t === 0 ? 0 : Math.round(enhanceExpectedCost(t).cost / 2 / 100) * 100,
    );
    expect(table).toEqual([...ENHANCE_VALUE]);
    expect(enhanceValue(12)).toBe(ENHANCE_VALUE[ENHANCE_MAX]);
    expect(enhanceValue(-1)).toBe(0);
  });

  it('기대 비용: +10은 1조 2천억 안팎, 천장이 없으면 더 든다', () => {
    const withPity = enhanceExpectedCost(10).cost;
    const noPity = enhanceExpectedCost(10, { ...DEFAULT_ENHANCE_RULES, pity: 0 }).cost;
    expect(withPity).toBeGreaterThan(120_000_000);
    expect(withPity).toBeLessThan(130_000_000);
    expect(noPity).toBeGreaterThan(withPity);
  });
});
