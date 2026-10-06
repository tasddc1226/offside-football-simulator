import { describe, expect, it } from 'vitest';
import type { SeasonRecapResponse } from '@offside/contracts';
import { profileTier } from './ownerTier.js';

describe('T-11-128 프로필 지난 시즌 등급', () => {
  const res = (status: SeasonRecapResponse['status'], score?: number) =>
    ({
      season: 0,
      status,
      recap: score === undefined ? null : { achievements: { score } },
      honors: [],
    }) as unknown as SeasonRecapResponse;

  it('결산이 나왔으면 마감 업적 점수의 등급', () => {
    expect(profileTier(res('ready', 1000))).toEqual({ tier: 'gold', season: 0 });
  });
  it('그 시즌 기록이 없으면 없다(루키로도 붙이지 않는다)', () => {
    expect(profileTier(res('none'))).toBeNull();
  });
  it('굳히는 중이면 없다', () => {
    expect(profileTier(res('pending'))).toBeNull();
  });
});
