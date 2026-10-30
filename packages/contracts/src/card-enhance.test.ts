import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENHANCE_RULES,
  ENHANCE_CEILING,
  ENHANCE_MAX,
  enhanceCeilingLeft,
  enhanceCost,
  enhanceExpectedCost,
  enhanceOutcome,
  enhanceRateBp,
  enhanceStartsToNext,
  enhanceTriesLeft,
  enhanceValue,
} from './card-enhance.js';
import { salaryOf, seasonSalaryOf, slotFit, slotRating, type SlotPlayer } from './owner-team.js';

describe('카드 강화 표 (T-11-373)', () => {
  const r = DEFAULT_ENHANCE_RULES;

  it('확률은 정수 퍼센트(만분율)이고 +5에서는 0이다', () => {
    expect([0, 1, 2, 3, 4, 5].map((l) => enhanceRateBp(l, 0, r))).toEqual([
      9000, 7500, 6000, 4500, 3000, 0,
    ]);
    expect(enhanceRateBp(4, 0, { rateScale: 1.013 })).toBe(3000);
    expect(enhanceRateBp(0, 0, { rateScale: 1.5 })).toBe(10_000);
  });

  it('천장: 그 단계에서 정해진 수만큼 실패하면 다음 시도는 반드시 성공한다', () => {
    for (let l = 0; l < ENHANCE_MAX; l++) {
      const ceil = ENHANCE_CEILING[l]!;
      let fails = 0;
      for (let k = 0; k < ceil; k++) {
        const out = enhanceOutcome(l, fails, 9999, r);
        expect(out).toEqual({ success: false, to: l, fails: fails + 1 });
        fails = out.fails;
      }
      expect(enhanceCeilingLeft(l, fails)).toBe(0);
      expect(enhanceOutcome(l, fails, 9999, r)).toEqual({ success: true, to: l + 1, fails: 0 });
    }
    expect(enhanceCeilingLeft(ENHANCE_MAX, 0)).toBeNull();
  });

  it('비용은 100 단위로 배율을 곱하고, 기대 비용 · 강화 가치는 늘어난다', () => {
    expect(enhanceCost(0, r)).toBe(100_000);
    expect(enhanceCost(4, { costScale: 0.333 })).toBe(333_000);
    expect(enhanceCost(5, r)).toBeNull();
    const costs = [1, 2, 3, 4, 5].map((t) => enhanceExpectedCost(t).cost);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]!);
    expect(enhanceValue(0)).toBe(0);
    expect(enhanceValue(5)).toBe(Math.round(costs[4]! / 2 / 100) * 100);
  });

  it('시도권: 선발 경기 수 ÷ 경기 수 − 쓴 시도권', () => {
    const card = { level: 0, fails: 0, starts: 25, used: 1 };
    expect(enhanceTriesLeft(card, r)).toBe(1);
    expect(enhanceStartsToNext(card, r)).toBe(5);
    expect(enhanceTriesLeft({ ...card, used: 2 }, r)).toBe(0);
  });
});

describe('강화 OVR이 자리 실력 · 급여에 더해진다 (T-11-373)', () => {
  const p: SlotPlayer = { peak: 84, pos: 'FW', dpos: 'ST', roles: null };

  it('자리 실력은 +N, 적합도는 그대로', () => {
    const base = slotRating('ST', p);
    expect(slotRating('ST', { ...p, enhance: 3 })).toBe(base + 3);
    expect(slotFit('ST', { ...p, enhance: 3 })).toBe(slotFit('ST', p));
    const roles = {
      ...Object.fromEntries(['ST', 'W', 'AM', 'CM', 'DM', 'FB', 'CB', 'GK'].map((k) => [k, 70])),
      ST: 84,
    };
    const withRoles = { ...p, roles } as SlotPlayer;
    expect(slotRating('ST', { ...withRoles, enhance: 2 })).toBe(slotRating('ST', withRoles) + 2);
    expect(slotFit('ST', { ...withRoles, enhance: 2 })).toBe(slotFit('ST', withRoles));
  });

  it('급여는 강화 OVR을 더한 값으로 잰다', () => {
    expect(seasonSalaryOf({ peak: 84, season: 0, enhance: 1 }, 1)).toBe(salaryOf(85));
    expect(seasonSalaryOf({ peak: 84, season: 1, enhance: 5 }, 1)).toBe(0);
  });
});
