import { leagueFatiguePenalty, leagueFatigueSteps } from '@offside/contracts/league';
import { describe, expect, it } from 'vitest';
import { startStreaks, withFatigue, type PlayedLeagueMatch } from './fatigue.js';
import type { LineupSlot } from './sim.js';

const match = (round: number, xi: string[] | null, home = 'T'): PlayedLeagueMatch => ({
  round,
  homeTeamId: home,
  awayTeamId: home === 'T' ? 'O' : 'T',
  detailJson:
    xi === null
      ? null
      : JSON.stringify({
          home: {
            teamId: home,
            ...(home === 'T' ? { xi: Object.fromEntries(xi.map((id) => [id, 'ST'])) } : {}),
          },
          away: {
            teamId: home === 'T' ? 'O' : 'T',
            ...(home === 'T' ? {} : { xi: Object.fromEntries(xi.map((id) => [id, 'ST'])) }),
          },
          events: [],
        }),
});

describe('T-11-571 리그 체력', () => {
  it('3경기 연속 선발부터 1단계, 최대 3단계', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(leagueFatigueSteps)).toEqual([0, 0, 1, 2, 3, 3, 3]);
    expect(leagueFatiguePenalty(3, 0.03)).toBeCloseTo(0.06);
    expect(leagueFatiguePenalty(5, 0)).toBe(0);
  });

  it('직전 라운드부터 거슬러 연속 선발을 세고, 쉰 경기 · 기권 · 빠진 라운드에서 끊는다', () => {
    const played = [
      match(1, ['a', 'b', 'c']),
      match(2, ['a', 'b'], 'O'), // 원정에서도 센다
      match(3, ['a', 'b', 'c']),
      match(4, ['a', 'c']),
    ];
    expect(Object.fromEntries(startStreaks(played, 'T', 5))).toEqual({ a: 4, c: 2 });
    // 3라운드가 기권(기록 없음)이면 거기서 끊긴다.
    const forfeit = [...played.filter((m) => m.round !== 3), match(3, null)];
    expect(Object.fromEntries(startStreaks(forfeit, 'T', 5))).toEqual({ a: 1, c: 1 });
    // 바로 앞 라운드 경기가 없으면 모두 쉰 것으로 본다.
    expect(startStreaks(played, 'T', 6).size).toBe(0);
  });

  it('지친 선수의 자리 실력만 깎고, 꺼져 있으면 그대로 둔다', () => {
    const slot = (careerId: string | null, rating: number) => ({ careerId, rating }) as LineupSlot;
    const lineup = [slot('a', 80), slot('b', 80), slot(null, 50)];
    const streaks = new Map([
      ['a', 4],
      ['b', 1],
    ]);
    expect(withFatigue(lineup, streaks, 0.03).map((s) => s.rating)).toEqual([73, 80, 50]);
    expect(withFatigue(lineup, streaks, 0)).toEqual(lineup);
  });
});
