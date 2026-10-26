import { describe, expect, it } from 'vitest';
import {
  LEAGUE_REWARDS,
  leagueOutcome,
  leagueReward,
  leagueSeedOrder,
  type LeagueSeedTeam,
} from './league.js';

describe('leagueOutcome · leagueReward (T-11-418e)', () => {
  it('1위는 1부 우승 · 아래 부 승격, 7위 아래는 강등(맨 아래 부는 잔류), 기권 퇴출은 따로', () => {
    expect(leagueOutcome(1, 1, 3, false)).toBe('champion');
    expect(leagueOutcome(2, 1, 3, false)).toBe('promoted');
    expect(leagueOutcome(1, 6, 3, false)).toBe('stayed');
    expect(leagueOutcome(1, 7, 3, false)).toBe('relegated');
    expect(leagueOutcome(2, 8, 3, false)).toBe('relegated');
    expect(leagueOutcome(3, 8, 3, false)).toBe('stayed');
    expect(leagueOutcome(1, 1, 3, true)).toBe('forfeited');
  });

  it('1부 1 ~ 3위는 컵 묶음, 승격은 늘 스카우트권, 완주하면 리롤권을 더한다', () => {
    expect(leagueReward(1, 1, 0, 'champion')).toEqual({ rerolls: 17, scouts: 3, boosts: 3 });
    expect(leagueReward(1, 3, 1, 'stayed')).toEqual({ rerolls: 7, scouts: 1, boosts: 1 });
    expect(leagueReward(1, 4, 0, 'stayed')).toEqual(LEAGUE_REWARDS.finish);
    for (const tier of [2, 5])
      expect(leagueReward(tier, 1, 2, 'promoted')).toEqual({ rerolls: 7, scouts: 1, boosts: 1 });
    expect(leagueReward(4, 2, 0, 'stayed')).toEqual({ rerolls: 5, scouts: 0, boosts: 0 });
    expect(leagueReward(4, 8, 1, 'stayed')).toEqual({ rerolls: 0, scouts: 0, boosts: 0 });
    expect(leagueReward(1, 1, 3, 'forfeited')).toEqual({ rerolls: 0, scouts: 0, boosts: 0 });
  });
});

describe('leagueSeedOrder (T-11-418e)', () => {
  const team = (id: string, ovr: number, prev?: LeagueSeedTeam['prev']): LeagueSeedTeam => ({
    id,
    ovr,
    prev: prev ?? null,
  });

  it('승격 · 잔류 · 강등대로 부를 고르고, 위 부가 모자라면 아래 부 2위부터 올린다', () => {
    // 지난 시즌 1부 8팀 · 2부 2리그 16팀 = 24팀. 1부 7 · 8위가 내려가고 2부 1위 둘이 올라온다.
    const prev: LeagueSeedTeam[] = [];
    for (let r = 1; r <= 8; r++)
      prev.push(team(`a${r}`, 70, { tier: 1, rank: r, outcome: leagueOutcome(1, r, 2, false) }));
    for (const l of ['b', 'c'])
      for (let r = 1; r <= 8; r++)
        prev.push(
          team(`${l}${r}`, 60, { tier: 2, rank: r, outcome: leagueOutcome(2, r, 2, false) }),
        );
    const order = leagueSeedOrder(prev).map((t) => t.id);
    // 1부(8팀): 남은 1 ~ 6위 + 올라온 2부 1위 둘.
    expect(order.slice(0, 8).sort()).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'b1', 'c1']);
    expect(order.slice(8)).toContain('a7');

    // a3 · a4가 빠지면 1부 빈자리 둘은 2부 2위들이 채운다.
    const fewer = leagueSeedOrder(prev.filter((t) => t.id !== 'a3' && t.id !== 'a4')).map(
      (t) => t.id,
    );
    expect(fewer.slice(0, 8).sort()).toEqual(['a1', 'a2', 'a5', 'a6', 'b1', 'b2', 'c1', 'c2']);
  });

  it('새 팀은 OVR이 높아도 3부부터, 기권 퇴출은 맨 아래로', () => {
    const teams: LeagueSeedTeam[] = [
      team('star', 99),
      team('quit', 90, { tier: 1, rank: 2, outcome: 'forfeited' }),
    ];
    // 지난 시즌 1 · 2부에서 잔류한 24팀(OVR은 새 팀보다 낮다).
    for (let i = 0; i < 24; i++)
      teams.push(team(`old${i}`, 60, { tier: i < 8 ? 1 : 2, rank: 3, outcome: 'stayed' }));
    for (let i = 0; i < 40; i++) teams.push(team(`new${i}`, 50 + (i % 30)));
    const order = leagueSeedOrder(teams).map((t) => t.id);
    // 1 · 2부(24팀)는 지난 시즌 팀이 채우고, 'star'는 3부 맨 앞.
    expect(order.slice(0, 24).every((id) => id.startsWith('old'))).toBe(true);
    expect(order.indexOf('star')).toBe(24);
    expect(order.at(-1)).toBe('quit');

    // 1 · 2부가 비면(지난 시즌 팀이 모자라면) 새 팀도 빈자리를 채운다.
    expect(leagueSeedOrder([team('x', 50), team('y', 60)]).map((t) => t.id)).toEqual(['y', 'x']);
  });
});
