import { afterEach, describe, expect, it } from 'vitest';
import {
  passRewardBetween,
  passSaleSeason,
  passSeasonFor,
  passTierOf,
  SEASON_PASS_TIERS,
} from './season-pass-rules';
import { applySeasonSchedule } from './service-seasons';

describe('T-11-511 시즌 패스 규칙', () => {
  afterEach(() => applySeasonSchedule([]));

  it('은퇴 수로 열린 단계 수', () => {
    expect(passTierOf(0)).toBe(0);
    expect(passTierOf(4)).toBe(3);
    expect(passTierOf(25)).toBe(SEASON_PASS_TIERS.length);
  });

  it('(from, to] 단계 보상을 합친다', () => {
    expect(passRewardBetween(0, 4)).toEqual({ reroll: 6, boost: 3 });
    expect(passRewardBetween(4, 4)).toEqual({});
  });

  it('진행 중인 시즌을 팔고, 시즌 사이면 다음 시즌, 이미 가졌으면 그다음 시즌', () => {
    applySeasonSchedule([
      {
        id: 1,
        startsAt: '2026-10-05T15:00:00.000Z',
        endsAt: '2026-10-30T15:00:00.000Z',
        retireAt: 45,
      },
      { id: 2, startsAt: '2026-11-01T15:00:00.000Z', endsAt: null, retireAt: 46 },
    ]);
    expect(passSaleSeason('2026-10-20T00:00:00.000Z')).toBe(1);
    expect(passSaleSeason('2026-10-31T00:00:00.000Z')).toBe(2);
    expect(passSeasonFor('2026-11-05T00:00:00.000Z', [2])).toBe(3);
  });
});
