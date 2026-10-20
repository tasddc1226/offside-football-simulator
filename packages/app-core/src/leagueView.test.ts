import { planLeague } from '@offside/contracts/league';
import { describe, expect, it } from 'vitest';
import type { LeagueResponse } from './api/league.js';
import type { LeagueTableResponse } from './api/league.js';
import {
  leagueChoices,
  leagueDefaultPick,
  leagueDefaultRound,
  leagueLine,
  leaguePlacementLine,
  leagueReadiness,
  leagueRound,
  leagueSchedule,
  leagueZone,
} from './leagueView.js';

const plan = planLeague(2, '2026-10-30T15:00:00.000Z');
const league = { ...plan, rounds: [...plan.rounds] };
const data = (phase: LeagueResponse['phase']): LeagueResponse => ({ league, phase, entries: 12 });

describe('leagueView (T-11-418)', () => {
  it('일정은 한국 시간으로 신청 · 배치 · 라운드를 보인다', () => {
    expect(leagueSchedule(league).map((r) => r.text)).toEqual([
      '10월 24일 00:00 ~ 11월 4일 23:59',
      '10월 31일 00:00',
      '11월 5일 09:00',
      '11월 5일 ~ 11월 18일, 매일 13:00',
    ]);
  });
  it('단계마다 배너 한 줄', () => {
    expect(leagueLine(data('soon'))).toBe('10월 24일 00:00부터 신청받아요.');
    expect(leagueLine(data('open'))).toBe('12팀 신청 · 11월 4일 23:59까지');
    expect(leagueLine(data('closed'))).toBe('11월 5일 09:00에 부와 리그 배치를 발표해요.');
  });
  it('준비 상태: 개막 전엔 없음, 팀 없음 · 모자람 · 준비 완료', () => {
    const me = (team: { filled: number } | null) => ({
      entry: null,
      canEnter: true,
      team: team && { teamId: 'tem_1', filled: team.filled, ovr: 80 },
    });
    const before = Date.parse('2026-10-28T00:00:00.000Z');
    const after = Date.parse('2026-11-01T00:00:00.000Z');
    expect(leagueReadiness(data('open'), me(null), before)).toBeNull();
    expect(leagueReadiness(data('open'), me(null), after)?.text).toBe(
      '아직 시즌 2 팀이 없어요. 배치 전까지 팀을 만들고 선발에 내 은퇴 선수 8명을 채워야 리그에 들어가요.',
    );
    expect(leagueReadiness(data('open'), me({ filled: 6 }), after)).toEqual({
      ok: false,
      text: '선발에 내 은퇴 선수가 6/8명이에요. 배치 전까지 8명을 채워야 리그에 들어가요.',
    });
    expect(leagueReadiness(data('open'), me({ filled: 9 }), after)?.ok).toBe(true);
  });

  it('T-11-418b 배치 뒤: 진행 한 줄 · 내 배치 · 리그 고르기 · 승강권 · 라운드', () => {
    const tiers = [
      { tier: 1, leagues: 1, teams: 8 },
      { tier: 2, leagues: 2, teams: 15 },
    ];
    const running = { ...data('running'), tiers, playedRounds: 3 };
    expect(leagueLine(running)).toBe('14라운드 중 3라운드를 치렀어요.');
    const me = (
      placement: NonNullable<Parameters<typeof leaguePlacementLine>[0]>['placement'],
    ) => ({
      entry: null,
      canEnter: false,
      team: null,
      placement,
    });
    expect(leaguePlacementLine(me(null))).toBeNull();
    expect(
      leaguePlacementLine(me({ status: 'placed', tier: 2, league: 1, teamId: 't', rank: 3 })),
    ).toEqual({ ok: true, text: '2부 1리그 · 지금 3위' });
    expect(
      leaguePlacementLine(
        me({ status: 'dropped', tier: null, league: null, teamId: null, rank: null }),
      )?.ok,
    ).toBe(false);
    expect(leagueChoices(running)).toEqual([
      { tier: 1, league: 1 },
      { tier: 2, league: 1 },
      { tier: 2, league: 2 },
    ]);
    expect(
      leagueDefaultPick(
        running,
        me({ status: 'placed', tier: 2, league: 2, teamId: 't', rank: 1 }),
      ),
    ).toEqual({ tier: 2, league: 2 });
    expect(leagueDefaultPick(running, null)).toEqual({ tier: 1, league: 1 });
    expect(leagueDefaultPick({ tiers: undefined }, null)).toBeNull();
    // 1부 1위는 우승(승격권 아님), 맨 아래 부는 강등권 없음.
    expect([1, 2, 7, 8].map((r) => leagueZone(r, 8, 1, 2))).toEqual([null, null, 'down', 'down']);
    expect([1, 7].map((r) => leagueZone(r, 7, 2, 2))).toEqual(['up', null]);
    expect(leagueDefaultRound(running)).toBe(4);
    expect(leagueDefaultRound({ playedRounds: 14 })).toBe(14);
    const team = (id: string) => ({ teamId: id, name: id, owner: 'o', logo: null, ovr: 80 });
    const table = {
      teams: ['a', 'b', 'c'].map(team),
      matches: [
        {
          id: 'm',
          round: 1,
          homeTeamId: 'a',
          awayTeamId: 'b',
          at: league.rounds[0]!,
          played: false,
          homeGoals: null,
          awayGoals: null,
          forfeit: false,
        },
      ],
    } as unknown as LeagueTableResponse;
    expect(leagueRound(table, 1).resting.map((t) => t.teamId)).toEqual(['c']);
  });
});
