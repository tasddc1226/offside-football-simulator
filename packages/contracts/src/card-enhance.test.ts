import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENHANCE_RULES,
  ENHANCE_MAX,
  enhanceCost,
  enhanceDownBp,
  enhanceExpectedCost,
  enhanceOutcome,
  enhanceOvr,
  enhanceRateBp,
  enhanceTierOf,
  enhanceTierRules,
  enhanceValue,
  tradeBand,
} from './card-enhance.js';
import { slotFit, slotRating, type SlotPlayer } from './owner-team.js';

describe('카드 강화 표 (T-11-373)', () => {
  const r = DEFAULT_ENHANCE_RULES;

  it('확률은 정수 퍼센트(만분율)이고 +10에서는 0이다', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => enhanceRateBp(l, r))).toEqual([
      9000, 7500, 6000, 4500, 3000, 2500, 2000, 1500, 1000, 1000, 0,
    ]);
    expect(enhanceRateBp(4, { rateScale: 1.013 })).toBe(3000);
    expect(enhanceRateBp(0, { rateScale: 1.5 })).toBe(10_000);
  });

  it('실패 확률은 +0에서 0이고, 성공 배율이 커지면 합이 100%를 넘지 않게 줄어든다', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => enhanceDownBp(l, r))).toEqual([
      0, 500, 1000, 1500, 2000, 2000, 2000, 2000, 2000, 2000, 0,
    ]);
    expect(enhanceDownBp(1, { rateScale: 2 })).toBe(0);
    for (let l = 0; l < ENHANCE_MAX; l++)
      expect(enhanceRateBp(l, r) + enhanceDownBp(l, r)).toBeLessThanOrEqual(10_000);
  });

  it('난수 구간대로 성공 · 실패(-1) · 유지가 나오고, 천장이 없어 몇 번을 실패해도 그대로다', () => {
    for (let l = 0; l < ENHANCE_MAX; l++) {
      const up = enhanceRateBp(l, r);
      const down = enhanceDownBp(l, r);
      let fails = 0;
      for (let k = 0; k < 50; k++) {
        const out = enhanceOutcome(l, fails, 9999, r);
        expect(out).toEqual({ success: false, to: l, fails: fails + 1 });
        fails = out.fails;
      }
      expect(enhanceOutcome(l, fails, up - 1, r)).toEqual({ success: true, to: l + 1, fails: 0 });
      expect(enhanceOutcome(l, 0, up + down, r).to).toBe(l);
      if (down > 0)
        expect(enhanceOutcome(l, 0, up, r)).toEqual({ success: false, to: l - 1, fails: 1 });
    }
  });

  it('평균 비용은 내려간 단계를 다시 올리는 몫까지 넣어 +5 약 742억 · +10 약 6조 1천억이다', () => {
    expect(Math.round(enhanceExpectedCost(1).cost / 10_000)).toBe(11);
    expect(Math.round(enhanceExpectedCost(5).cost / 10_000)).toBe(742);
    expect(Math.round(enhanceExpectedCost(10).cost / 10_000)).toBe(60981);
  });

  it('최고 OVR 구간마다 성공 확률이 다르고, 실패 확률은 그대로이며 나머지가 유지다', () => {
    expect([89, 90, 94, 95, null].map(enhanceTierOf)).toEqual([
      'normal',
      'high',
      'high',
      'top',
      'normal',
    ]);
    const high = enhanceTierRules(r, 'high');
    const top = enhanceTierRules(r, 'top');
    expect(enhanceRateBp(0, high)).toBe(8100);
    expect(enhanceRateBp(0, top)).toBe(7200);
    expect(enhanceRateBp(9, top)).toBe(800);
    expect(enhanceDownBp(4, top)).toBe(2000);
    expect(enhanceRateBp(0, enhanceTierRules(r, 'normal'))).toBe(9000);
    // 강화 가치는 구간과 상관없이 기본 표로 잰다.
    expect(enhanceValue(5)).toBe(Math.round(enhanceExpectedCost(5).cost / 2 / 100) * 100);
  });

  it('비용은 100 단위로 배율을 곱하고, 기대 비용 · 강화 가치는 늘어난다', () => {
    expect(enhanceCost(0, r)).toBe(100_000);
    expect(enhanceCost(4, { costScale: 0.333 })).toBe(333_000);
    expect(enhanceCost(10, r)).toBeNull();
    const costs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => enhanceExpectedCost(t).cost);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]!);
    expect(enhanceValue(0)).toBe(0);
    expect(enhanceValue(10)).toBe(Math.round(costs[9]! / 2 / 100) * 100);
    // 성공하면 단계마다 강화 OVR이 오른다.
    for (let l = 1; l <= 10; l++) expect(enhanceOvr(l)).toBe(enhanceOvr(l - 1) + 1);
  });
});

describe('강화 OVR이 자리 실력에 더해진다 (T-11-373)', () => {
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

  it('판매가 상한의 배수는 기준가에만 붙고, 하한은 강화 가치까지 본다', () => {
    const rules = { priceMin: 0.5, priceMax: 3 };
    // 강화 전에는 예전 범위와 같다.
    expect(tradeBand(700_000, 0, rules)).toEqual({ min: 350_000, max: 2_100_000 });
    const v = enhanceValue(6);
    expect(tradeBand(700_000, 6, rules)).toEqual({
      min: Math.ceil((700_000 + v) / 2 / 100) * 100,
      max: 2_100_000 + v,
    });
    // 강화 가치는 평균 비용의 절반이라, 상한에서 강화분이 평균 비용을 넘지 않는다.
    expect(tradeBand(700_000, 10, rules).max - 2_100_000).toBeLessThan(
      enhanceExpectedCost(10).cost,
    );
    // 기준가 그대로(100%)는 어느 단계든 범위 안이다.
    expect(tradeBand(700_000, 10, { priceMin: 0.5, priceMax: 1 }).max).toBe(
      700_000 + enhanceValue(10),
    );
  });
});
