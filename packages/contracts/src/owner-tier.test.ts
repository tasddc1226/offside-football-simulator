import { describe, expect, it } from 'vitest';
import { ownerTierOf } from './owner-tier.js';

const tier = (ranks: [number | null, number][], retired = 0, legacy = 0) =>
  ownerTierOf({ ranks: ranks.map(([rank, ranked]) => ({ rank, ranked })), retired, legacy });

describe('T-11-128 구단주 티어', () => {
  it('가장 좋은 순위로 정한다(1위 · 10위 · 50위 · 상위 비율)', () => {
    expect(tier([[1, 400]])).toBe('challenger');
    expect(
      tier([
        [200, 400],
        [7, 20000],
      ]),
    ).toBe('grandmaster');
    expect(tier([[50, 20000]])).toBe('master');
    expect(tier([[900, 20000]])).toBe('diamond');
    expect(tier([[120, 1000]])).toBe('emerald');
    expect(tier([[300, 1000]])).toBe('platinum');
    expect(tier([[500, 1000]])).toBe('gold');
    expect(tier([[900, 1000]])).toBe('silver');
  });

  it('순위가 없으면 은퇴 선수 · 기록으로, 레거시 휘장은 적어도 플래티넘', () => {
    expect(tier([[null, 100]], 2)).toBe('bronze');
    expect(tier([], 0)).toBe('iron');
    expect(tier([[900, 1000]], 3, 1)).toBe('platinum');
    expect(tier([[3, 1000]], 3, 1)).toBe('grandmaster');
  });
});
