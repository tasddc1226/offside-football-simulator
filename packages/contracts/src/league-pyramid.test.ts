import { describe, expect, it } from 'vitest';
import { LEAGUE_CYCLE, leagueFixtures, leaguePyramid } from './league.js';

describe('leaguePyramid (T-11-418b)', () => {
  it('위 부부터 1 · 2 · 4 · 8 …개 리그로, 7 ~ 8팀씩, 8팀 리그를 위로', () => {
    expect(leaguePyramid(300)).toEqual({
      tiers: [
        { tier: 1, leagues: 1, teams: 8 },
        { tier: 2, leagues: 2, teams: 16 },
        { tier: 3, leagues: 4, teams: 32 },
        { tier: 4, leagues: 8, teams: 64 },
        { tier: 5, leagues: 16, teams: 128 },
        { tier: 6, leagues: 7, teams: 52 },
      ],
      dropped: 0,
    });
    // 251팀 = 32리그(27개 8팀 + 5개 7팀). 맨 아래 부에 7팀 리그가 모인다.
    const p = leaguePyramid(251);
    expect(p.dropped).toBe(0);
    expect(p.tiers.reduce((a, t) => a + t.teams, 0)).toBe(251);
    expect(p.tiers.at(-1)).toEqual({ tier: 6, leagues: 1, teams: 7 });
  });

  it('7 ~ 8팀으로 나눌 수 없는 적은 수는 남는 팀을 뺀다, 7팀 미만이면 리그 없음', () => {
    expect(leaguePyramid(7)).toEqual({ tiers: [{ tier: 1, leagues: 1, teams: 7 }], dropped: 0 });
    expect(leaguePyramid(13)).toEqual({ tiers: [{ tier: 1, leagues: 1, teams: 8 }], dropped: 5 });
    expect(leaguePyramid(14)).toEqual({
      tiers: [
        { tier: 1, leagues: 1, teams: 7 },
        { tier: 2, leagues: 1, teams: 7 },
      ],
      dropped: 0,
    });
    expect(leaguePyramid(6)).toEqual({ tiers: [], dropped: 6 });
    for (let n = 42; n <= 600; n++) expect(leaguePyramid(n).dropped).toBe(0);
  });
});

describe('leagueFixtures (T-11-418b)', () => {
  const check = (n: number, games: number) => {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`);
    const rounds = leagueFixtures(ids);
    expect(rounds).toHaveLength(LEAGUE_CYCLE);
    const meet = new Map<string, number>();
    const home = new Map<string, number>();
    for (const pairs of rounds) {
      const seen = new Set<string>();
      for (const [h, a] of pairs) {
        expect(seen.has(h) || seen.has(a)).toBe(false);
        seen.add(h).add(a);
        meet.set(`${h}>${a}`, (meet.get(`${h}>${a}`) ?? 0) + 1);
        home.set(h, (home.get(h) ?? 0) + 1);
      }
    }
    // 모든 짝이 홈에서 한 번 · 원정에서 한 번.
    for (const a of ids) for (const b of ids) if (a !== b) expect(meet.get(`${a}>${b}`)).toBe(1);
    for (const id of ids) expect(home.get(id)).toBe(games / 2);
  };
  it('8팀: 라운드마다 4경기, 서로 홈 · 원정 한 번씩, 홈 7경기', () => check(8, 14));
  it('7팀: 라운드마다 한 팀 휴식, 12경기 중 홈 6경기', () => check(7, 12));
});
