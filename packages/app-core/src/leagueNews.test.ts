import type { TeamMatch } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import type { LeagueNewsMatch, LeagueTableResponse } from './api/league.js';
import { derbyIds, leagueRival, matchArticle, newsCards, predictionSplit } from './leagueNews.js';

const team = (teamId: string, name: string, ovr: number) => ({
  teamId,
  name,
  owner: '감독',
  logo: null,
  ovr,
});
const nm = (over: Partial<LeagueNewsMatch> = {}): LeagueNewsMatch => ({
  id: 'm1',
  tier: 1,
  league: 1,
  round: 3,
  home: team('a', '하늘 FC', 80),
  away: team('b', '바다 FC', 88),
  homeGoals: 2,
  awayGoals: 1,
  ...over,
});
const side = (name: string, goals: number, ovr: number, xg?: number) => ({
  teamId: name,
  name,
  owner: '감독',
  formation: '4-3-3' as const,
  ovr,
  goals,
  ratingChange: null,
  ...(xg === undefined ? {} : { xg }),
});
const ev = (minute: number, s: 'home' | 'away', scorer: string) => ({
  minute,
  side: s,
  scorer,
  assist: null,
  scorerId: null,
  assistId: null,
});
const match = (over: Partial<TeamMatch>): TeamMatch => ({
  id: 'm1',
  home: side('하늘 FC', 2, 80),
  away: side('바다 FC', 1, 80),
  events: [],
  mine: 'home',
  createdAt: '2026-11-07T04:00:36.000Z',
  ...over,
});

describe('T-11-652 오프사이드 데일리 문장', () => {
  it('이변 · 골 잔치 · 더비 · 선두 · 연승 · 이 라운드의 팀 꼭지를 기사 문장으로 만든다', () => {
    const cards = newsCards({
      season: 2,
      round: 3,
      bigMatch: null,
      lastBig: null,
      items: [
        { kind: 'upset', match: nm({ homeXg: 1.24, awayXg: 2 }), gap: 8 },
        { kind: 'goalfest', match: nm({ id: 'm2', homeGoals: 4, awayGoals: 3 }) },
        {
          kind: 'derby',
          match: nm({ id: 'm3', homeGoals: 1, awayGoals: 1 }),
          homeRank: 3,
          awayRank: 2,
        },
        {
          kind: 'leader',
          tier: 1,
          league: 1,
          team: team('a', '하늘 FC', 80),
          points: 9,
          changed: true,
        },
        { kind: 'streak', tier: 2, league: 1, team: team('c', '숲 FC', 70), n: 4 },
        { kind: 'teamOfRound', match: nm({ id: 'm4', homeGoals: 0, awayGoals: 5 }), side: 'away' },
      ],
    });
    expect(cards.map((c) => [c.tag, c.head])).toEqual([
      ['이변', '하늘 FC, OVR 8 차를 뒤집다'],
      ['골 잔치', '하늘 FC · 바다 FC, 7골 난타전'],
      ['더비', '2위와 3위의 맞대결'],
      ['선두', '하늘 FC, 1부 선두로'],
      ['연승', '숲 FC, 4연승 행진'],
      ['이 라운드의 팀', '바다 FC, 5골 차 완승'],
    ]);
    expect(cards[0]!.body).toBe(
      '하늘 FC가 바다 FC를 2:1로 꺾었습니다. 경기 전 OVR은 바다 FC 쪽이 8 높았습니다. 기대 득점은 1.2 대 2.0이었습니다.',
    );
    expect(cards[2]!.body).toContain('1:1로 비겼습니다');
    expect(cards[3]!.match).toBeNull();
    expect(cards[3]!.where).toBe('1부 1리그 · 3라운드');
  });

  it('경기 기사: 밀리고도 이긴 경기 · 대승 · 한 골 차 결승골 · 무승부', () => {
    const lucky = matchArticle(
      match({
        home: side('하늘 FC', 1, 80, 0.4),
        away: side('바다 FC', 0, 80, 1.9),
        events: [ev(88, 'home', '김선수')],
      }),
    );
    expect(lucky.head).toBe('하늘 FC, 밀리고도 이겼다');
    expect(lucky.body[0]).toContain('바다 FC 1.9, 하늘 FC 0.4');
    const narrow = matchArticle(
      match({
        events: [ev(10, 'away', '박선수'), ev(30, 'home', '김선수'), ev(81, 'home', '이선수')],
      }),
    );
    expect(narrow.head).toBe('하늘 FC, 한 골 차로 웃다');
    expect(narrow.body).toContain('선제골은 10분 박선수의 발끝에서 나왔습니다.');
    expect(narrow.body).toContain('81분 이선수의 골이 승부를 갈랐습니다.');
    const rout = matchArticle(
      match({
        home: side('하늘 FC', 4, 80),
        away: side('바다 FC', 0, 80),
        events: [
          ev(5, 'home', '김선수'),
          ev(20, 'home', '김선수'),
          ev(40, 'home', '김선수'),
          ev(70, 'home', '최선수'),
        ],
      }),
    );
    expect(rout.head).toBe('하늘 FC, 4골 차 대승');
    expect(rout.body).toContain('김선수가 해트트릭을 기록했습니다.');
    const draw = matchArticle(
      match({ home: side('하늘 FC', 0, 80), away: side('바다 FC', 0, 80) }),
    );
    expect(draw.head).toBe('하늘 FC · 바다 FC, 0:0 무승부');
    expect(draw.body).toContain('두 팀 모두 골문을 열지 못했습니다.');
  });

  it('예측 비율은 합이 100이고, 아무도 고르지 않았으면 null', () => {
    expect(predictionSplit({ matchId: 'm', home: 0, draw: 0, away: 0 })).toBeNull();
    expect(predictionSplit({ matchId: 'm', home: 1, draw: 1, away: 1 })).toMatchObject({
      home: 33,
      draw: 34,
      away: 33,
      n: 3,
    });
  });
});

describe('T-11-652 라이벌 · 더비', () => {
  const st = (teamId: string, rank: number, pts: number, p = 2) => ({
    teamId,
    rank,
    pts,
    p,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    forfeits: 0,
  });
  const lm = (
    id: string,
    round: number,
    home: string,
    away: string,
    hg: number | null,
    ag: number | null,
  ) => ({
    id,
    round,
    homeTeamId: home,
    awayTeamId: away,
    at: '2026-11-07T04:00:00.000Z',
    played: hg !== null,
    homeGoals: hg,
    awayGoals: ag,
    forfeit: false,
  });
  const table: LeagueTableResponse = {
    season: 2,
    tier: 1,
    league: 1,
    teams: ['a', 'b', 'c', 'd'].map((id) => team(id, `${id.toUpperCase()} FC`, 80)),
    standings: [st('a', 1, 6), st('b', 2, 4), st('c', 3, 3), st('d', 4, 0)],
    matches: [
      lm('m1', 1, 'b', 'c', 1, 1),
      lm('m2', 2, 'c', 'b', 0, 2),
      lm('m3', 3, 'b', 'c', null, null),
      lm('m4', 3, 'a', 'd', null, null),
    ],
  };

  it('라이벌은 바로 위 · 아래 팀 중 승점 차가 작은 팀이고 맞대결 전적을 센다', () => {
    expect(leagueRival(table, 'c')).toMatchObject({ teamId: 'b', gap: 1, w: 0, d: 1, l: 1 });
    expect(leagueRival(table, 'c')!.line).toBe('라이벌 B FC · 승점 차 1 · 맞대결 0승 1무 1패');
    expect(leagueRival(table, 'x')).toBeNull();
  });

  it('더비는 안 치른 경기 중 순위가 붙고 승점 차 3 안인 경기', () => {
    expect([...derbyIds(table)]).toEqual(['m3']);
  });
});
