import { describe, expect, it } from 'vitest';
import { ACH_GRADES } from './owner-team.js';
import { OWNER_TIERS, ownerTierOf } from './owner-tier.js';

describe('T-11-128 구단주 티어', () => {
  it('구단주 랭킹 업적 등급과 같은 단계', () => {
    expect([...OWNER_TIERS]).toEqual(ACH_GRADES.map((g) => g.id));
  });
  it('마감 업적 점수로 정한다', () => {
    expect(ownerTierOf(null)).toBe('rookie');
    expect(ownerTierOf(199)).toBe('rookie');
    expect(ownerTierOf(1000)).toBe('gold');
    expect(ownerTierOf(3500)).toBe('legend');
  });
});
