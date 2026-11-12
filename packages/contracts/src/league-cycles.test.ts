import { describe, expect, it } from 'vitest';
import {
  leagueFixtures,
  leagueLateSlots,
  leagueRoundPairs,
  leagueTeamSeason,
  planLeague,
  planLeagueCycle,
} from './league.js';

describe('28-round league seasons (T-11-708)', () => {
  it('keeps announced legacy season 2 schedules unchanged', () => {
    const legacy = planLeague(2, '2026-10-30T15:00:00.000Z');
    expect(legacy.rounds).toHaveLength(55);
    expect(legacy.teamSeason).toBeUndefined();
    expect(leagueTeamSeason(legacy)).toBe(2);
  });
  it('plays every opponent twice at home and twice away, with a fixed end', () => {
    const league = planLeagueCycle(4, '2027-02-03T15:00:00.000Z', 3);
    expect(league.rounds).toHaveLength(28);
    expect(leagueTeamSeason(league)).toBe(3);
    expect(Date.parse(league.drawAt) - Date.parse(league.startsAt)).toBe(33 * 3_600_000);
    const cycle = leagueFixtures(Array.from({ length: 8 }, (_, i) => i));
    const pairs = league.rounds.flatMap((_, r) => leagueRoundPairs(cycle, r));
    for (let home = 0; home < 8; home++)
      for (let away = 0; away < 8; away++)
        if (home !== away)
          expect(pairs.filter(([h, a]) => h === home && a === away)).toHaveLength(2);
  });
  it('gives only the first new league a five-day team preparation period', () => {
    const first = planLeagueCycle(3, '2027-01-01T00:00:00.000Z', 3, true);
    expect(Date.parse(first.drawAt) - Date.parse(first.startsAt)).toBe((5 * 24 + 9) * 3_600_000);
    const late = leagueLateSlots(first);
    expect(late).toHaveLength(1);
    expect(late[0]?.firstRound).toBe(15);
    expect(late[0]?.last).toBe(true);
  });
});
