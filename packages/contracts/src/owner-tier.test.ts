import { describe, expect, it } from 'vitest';
import { ACH_GRADES } from './owner-team.js';
import { OWNER_TIERS, ownerTierOf } from './owner-tier.js';

describe('T-11-128 구단주 티어', () => {
  it('구단주 랭킹 업적 등급과 같은 단계', () => {
    expect([...OWNER_TIERS]).toEqual(ACH_GRADES.map((g) => g.id));
  });
  it('시즌 1까지는 마감 업적 점수로 정한다', () => {
    expect(ownerTierOf({ season: 1, score: null })).toBe('rookie');
    expect(ownerTierOf({ season: 1, score: 199 })).toBe('rookie');
    expect(ownerTierOf({ season: 0, score: 1000 })).toBe('gold');
    expect(ownerTierOf({ season: 1, score: 3500, rank: 900, ranked: 1000 })).toBe('legend');
  });
  it('T-11-489 시즌 2부터는 마감 순위의 상위 비율로 정한다', () => {
    const at = (rank: number | null, score = 100) =>
      ownerTierOf({ season: 2, score, rank, ranked: 1000 });
    expect(at(20, 10)).toBe('legend');
    expect(at(21, 99999)).toBe('diamond');
    expect(at(80)).toBe('diamond');
    expect(at(200)).toBe('platinum');
    expect(at(400)).toBe('gold');
    expect(at(700)).toBe('silver');
    expect(at(900)).toBe('bronze');
    expect(at(901)).toBe('rookie');
    expect(at(null, 0)).toBe('rookie');
    // 순위가 없는 옛 기록은 루키.
    expect(ownerTierOf({ season: 2, score: 5000 })).toBe('rookie');
  });
});
