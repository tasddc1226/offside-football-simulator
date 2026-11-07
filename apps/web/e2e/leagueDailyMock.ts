import type { Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-11-652 오프사이드 데일리 e2e 목업: 시즌 2 리그 1부 8팀, 3라운드까지 치름. 내 팀은 tem_3(3위).

export const league = {
  season: 2,
  startsAt: '2026-10-30T15:00:00.000Z',
  opensAt: '2026-10-23T15:00:00.000Z',
  closesAt: '2026-11-04T15:00:00.000Z',
  drawAt: '2026-11-05T00:00:00.000Z',
  rounds: Array.from(
    { length: 14 },
    (_, i) => `2026-11-${String(5 + i).padStart(2, '0')}T04:00:00.000Z`,
  ),
  minFilled: 8,
};
const NAMES = [
  '한강 유나이티드',
  '북악 FC',
  '하늘 FC',
  '남산 시티',
  '바다 레인저스',
  '은하 SC',
  '금빛 원더러스',
  '숲속 FC',
];
const OVR = [96, 95, 93, 92, 90, 89, 86, 85];
export const ids = NAMES.map((_, i) => `tem_${i + 1}`);
export const team = (i: number) => ({
  teamId: ids[i]!,
  name: NAMES[i]!,
  owner: `감독${i + 1}`,
  logo: null,
  ovr: OVR[i]!,
});
/** 라운드별 대진(홈 i, 원정 j)과 스코어(3라운드까지). */
const FIX: [number, number, number | null, number | null][][] = [
  [
    [0, 7, 3, 0],
    [1, 6, 2, 1],
    [2, 5, 1, 1],
    [3, 4, 2, 2],
  ],
  [
    [7, 1, 1, 0],
    [6, 2, 0, 2],
    [5, 3, 2, 1],
    [4, 0, 1, 3],
  ],
  [
    [0, 6, 1, 1],
    [1, 5, 4, 3],
    [2, 4, 4, 2],
    [3, 7, 0, 2],
  ],
  [
    [0, 1, null, null],
    [2, 3, null, null],
    [4, 6, null, null],
    [5, 7, null, null],
  ],
];
const matches = FIX.flatMap((round, r) =>
  round.map(([h, a, hg, ag], s) => ({
    id: `lgm_${r + 1}_${s}`,
    round: r + 1,
    homeTeamId: ids[h]!,
    awayTeamId: ids[a]!,
    at: `2026-11-${String(5 + r).padStart(2, '0')}T${['04', '07', '10', '12'][s]}:00:00.000Z`,
    played: hg !== null,
    homeGoals: hg,
    awayGoals: ag,
    forfeit: false,
  })),
);
const standings = [
  { i: 0, w: 2, d: 1, l: 0, gf: 7, ga: 2, pts: 7 },
  { i: 1, w: 2, d: 0, l: 1, gf: 6, ga: 5, pts: 6 },
  { i: 2, w: 2, d: 1, l: 0, gf: 7, ga: 3, pts: 7 },
  { i: 7, w: 2, d: 0, l: 1, gf: 3, ga: 3, pts: 6 },
  { i: 5, w: 1, d: 1, l: 1, gf: 5, ga: 6, pts: 4 },
  { i: 3, w: 0, d: 1, l: 2, gf: 3, ga: 6, pts: 1 },
  { i: 6, w: 0, d: 1, l: 2, gf: 2, ga: 5, pts: 1 },
  { i: 4, w: 0, d: 1, l: 2, gf: 4, ga: 7, pts: 1 },
]
  .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga))
  .map((s, k) => ({
    teamId: ids[s.i]!,
    p: 3,
    w: s.w,
    d: s.d,
    l: s.l,
    gf: s.gf,
    ga: s.ga,
    pts: s.pts,
    rank: k + 1,
    forfeits: 0,
  }));
export const table = {
  season: 2,
  tier: 1,
  league: 1,
  teams: ids.map((_, i) => team(i)),
  standings,
  matches,
};
const nm = (id: string, h: number, a: number, hg: number, ag: number, xg?: [number, number]) => ({
  id,
  tier: 1,
  league: 1,
  round: 3,
  home: team(h),
  away: team(a),
  homeGoals: hg,
  awayGoals: ag,
  ...(xg ? { homeXg: xg[0], awayXg: xg[1] } : {}),
});
export const news = {
  season: 2,
  round: 3,
  items: [
    { kind: 'upset', match: nm('lgm_3_3', 3, 7, 0, 2, [1.9, 0.7]), gap: 7 },
    { kind: 'leader', tier: 1, league: 1, team: team(0), points: 7, changed: false },
    { kind: 'derby', match: nm('lgm_3_1', 1, 5, 4, 3, [2.8, 2.1]), homeRank: 3, awayRank: 4 },
    { kind: 'goalfest', match: nm('lgm_3_2', 2, 4, 4, 2, [2.6, 1.3]) },
    { kind: 'streak', tier: 1, league: 1, team: team(7), n: 3 },
    { kind: 'teamOfRound', match: nm('lgm_3_3', 3, 7, 0, 2, [1.9, 0.7]), side: 'away' },
  ],
  bigMatch: {
    id: 'lgm_4_0',
    tier: 1,
    league: 1,
    round: 4,
    at: '2026-11-08T04:00:00.000Z',
    home: team(0),
    away: team(1),
    homeRank: 1,
    awayRank: 3,
  },
  lastBig: nm('lgm_3_0', 0, 6, 1, 1),
};
const side = (i: number, goals: number, xg: number) => ({
  ...team(i),
  formation: '4-3-3',
  goals,
  ratingChange: null,
  xg,
});
const ev = (minute: number, s: 'home' | 'away', scorer: string, assist: string | null = null) => ({
  minute,
  side: s,
  scorer,
  assist,
  scorerId: null,
  assistId: null,
});
export const detail = {
  match: {
    id: 'lgm_3_3',
    home: side(3, 0, 1.9),
    away: side(7, 2, 0.7),
    events: [ev(54, 'away', '정우진', '최하람'), ev(87, 'away', '정우진')],
    mine: 'home',
    createdAt: '2026-11-07T12:00:36.000Z',
  },
  league: { tier: 1, league: 1, round: 3, forfeit: false },
};

/** 리그 화면 API 목업. hits에 경로별 호출 수, puts에 예측 요청을 남긴다. */
export async function mockDaily(page: Page) {
  const hits: Record<string, number> = {};
  const puts: string[] = [];
  let counts = { matchId: 'lgm_4_0', home: 41, draw: 12, away: 27 };
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    const method = r.request().method();
    hits[`${method} ${path}`] = (hits[`${method} ${path}`] ?? 0) + 1;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'u***@example.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    if (path === '/v1/leagues/current')
      return r.fulfill(
        ok({
          league,
          phase: 'running',
          entries: 263,
          tiers: [
            { tier: 1, leagues: 1, teams: 8 },
            { tier: 2, leagues: 2, teams: 16 },
          ],
          playedRounds: 3,
        }),
      );
    if (path === '/v1/leagues/current/me')
      return r.fulfill(
        ok({
          entry: { createdAt: '2026-11-01T03:00:00.000Z' },
          canEnter: false,
          team: { teamId: 'tem_3', filled: 11, ovr: 93 },
          placement: { status: 'placed', tier: 1, league: 1, teamId: 'tem_3', rank: 2 },
        }),
      );
    if (path === '/v1/leagues/2/tables/1/1') return r.fulfill(ok(table));
    if (path === '/v1/leagues/2/news/3') return r.fulfill(ok(news));
    if (path === '/v1/leagues/2/matches/lgm_4_0/predictions') return r.fulfill(ok(counts));
    if (path === '/v1/leagues/2/predictions/me')
      return r.fulfill(
        ok({
          items: [
            { matchId: 'lgm_3_0', round: 3, pick: 'draw', result: 'draw' },
            { matchId: 'lgm_2_3', round: 2, pick: 'home', result: 'away' },
            { matchId: 'lgm_1_0', round: 1, pick: 'home', result: 'home' },
          ],
          hit: 2,
          total: 3,
        }),
      );
    if (path === '/v1/leagues/2/matches/lgm_4_0/prediction' && method === 'PUT') {
      const { pick } = r.request().postDataJSON() as { pick: 'home' | 'draw' | 'away' };
      puts.push(pick);
      counts = { ...counts, [pick]: counts[pick] + 1 };
      return r.fulfill(ok(counts));
    }
    if (path === '/v1/leagues/2/matches/lgm_3_3') return r.fulfill(ok(detail));
    if (path === '/v1/chat/share' && method === 'POST') return r.fulfill(ok({ id: 'msg_1' }, 201));
    return r.fulfill({ status: 503, body: '' });
  });
  return { hits, puts };
}
