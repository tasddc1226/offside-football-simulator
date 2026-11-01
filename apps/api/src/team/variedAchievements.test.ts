// T-11-541 시즌 2 업적 다양화 — 한 시즌의 위업 · 커리어의 모양 · 경기 장면 · 감독 업적을 더하고, 단계 업적마다 다른 단계
// 점수를 쓰며, 보상 표를 조금 줄인다. 시즌 1(varied 없음)은 업적 목록 · 점수 · 보상이 그대로다.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ownerActivityIn } from '../db/repos/ownerAchievements.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie } from '../test/http.js';
import {
  achRewardSteps,
  achievementScore,
  clubAchievements,
  teamKeptOf,
  withAchRewards,
  type AchievementCareer,
  type AchievementInput,
  type AchievementSeason,
  type AchievementTeam,
} from './achievements.js';
import { localizeAchievements } from './achievementsText.js';
import { seasonGiftAmount } from './ownerAchievements.js';

const career = (over: Partial<AchievementCareer> = {}): AchievementCareer => ({
  pos: 'FW',
  dpos: null,
  caps: 0,
  ballon: 0,
  trophies: 0,
  awards: 0,
  apps: 0,
  goals: 0,
  assists: 0,
  legendScore: 0,
  retiredNumber: false,
  nation: null,
  retireAge: 35,
  seasons: [],
  ...over,
});
const season = (over: Partial<AchievementSeason> = {}): AchievementSeason => ({
  league: '프리미어리그',
  honors: [],
  club: 'A',
  clubId: 'a',
  goals: 0,
  cs: 0,
  age: 25,
  assists: 0,
  ...over,
});
const team = (over: Partial<AchievementTeam> = {}): AchievementTeam => ({
  slots: [],
  wins: 0,
  bestStreak: 0,
  bestMargin: 0,
  goalsFor: 0,
  rating: 0,
  likes: 0,
  ...over,
});
const owner = { retireDays: 0, matchDays: 0, likesGiven: 0, nickname: false };
const S2 = { endless: true, varied: true, ladder: true } as const;
const groupsOf = (careers: AchievementCareer[], over: Partial<AchievementInput> = {}) =>
  clubAchievements({ careers, team: null, owner, detail: true, retireAt: 45, ...over });
const all = (g: ReturnType<typeof clubAchievements>) => g.flatMap((x) => x.items);
const item = (g: ReturnType<typeof clubAchievements>, id: string) =>
  all(g).find((i) => i.id === id)!;
const ids = (g: ReturnType<typeof clubAchievements>) => all(g).map((i) => i.id);

const NEW_PLAYER = [
  's-assists-30',
  's-teen-20',
  's-veteran-20',
  's-double',
  's-young-ballon',
  's-quadruple',
  's-ballon-treble',
  'c-journeyman',
  'c-df-50',
  'c-peak',
  'c-ballon-players',
  'c-legends',
  'secret-farewell',
  'secret-homecoming',
];
const NEW_TEAM = [
  'team-cup-qf',
  'team-clean',
  'team-thrash',
  'team-six',
  'team-winrate',
  'team-wall',
];

describe('시즌 1은 그대로(varied 없음)', () => {
  const rich = [
    career({
      goals: 30_000,
      assists: 15_000,
      apps: 100_000,
      caps: 10_000,
      trophies: 2_000,
      awards: 3_000,
      legendScore: 100_000,
      ballon: 100,
      peak: 99,
      seasons: [season({ age: 18, goals: 60, assists: 40, honors: ['발롱도르'] })],
    }),
  ];
  it('새 업적이 없고 점수 · 보상이 예전 사다리 · 예전 표 그대로다', () => {
    const g = groupsOf(rich, { team: team({ wins: 200, cleanWins: 50, topScore: 9 }) });
    for (const id of [...NEW_PLAYER, ...NEW_TEAM, 'mgr-titles', 'mgr-double'])
      expect(ids(g)).not.toContain(id);
    expect(g.map((x) => x.id)).toEqual([
      'first',
      'records',
      'collection',
      'legend',
      'world',
      'immortal',
      'beyond',
      'team',
      'race',
      'owner',
      'manager',
    ]);
    // 골 6단계 사다리 10 · 20 · 40 · 80 · 160 · 320.
    expect(item(g, 'goals')).toMatchObject({ level: 6, points: 630 });
    // 시즌 1 업적 보상(ACH_SEASON_GIFT)은 예전 표로 센다 — 골 3~6단계 1 · 2 · 3+1 · 3+2.
    const goals = achRewardSteps(g, 1).filter((s) => s.id === 'goals');
    expect(goals.map((s) => [s.boost, s.scout])).toEqual([
      [1, 0],
      [2, 0],
      [3, 1],
      [3, 2],
    ]);
    const gift = seasonGiftAmount(g);
    const old = achRewardSteps(g, 1).reduce(
      (t, s) => ({ boost: t.boost + s.boost, scout: t.scout + s.scout }),
      { boost: 0, scout: 0 },
    );
    expect(gift).toEqual(old);
  });
});

describe('시즌 2 새 업적 — 빈 상태', () => {
  it('선수 · 팀 · 감독이 없어도 새 묶음이 목표로 보이고 점수는 0이다', () => {
    const g = groupsOf([], { ...S2, team: team() });
    expect(g.map((x) => x.id)).toEqual([
      'first',
      'records',
      'collection',
      'legend',
      'world',
      'immortal',
      'beyond',
      'season',
      'career',
      'team',
      'race',
      'match',
      'owner',
      'manager',
    ]);
    for (const id of [...NEW_PLAYER, ...NEW_TEAM, 'mgr-titles', 'mgr-double']) {
      const i = item(g, id);
      expect(i.done).toBe(false);
      expect(i.points).toBe(0);
      expect(i.worth).toBeGreaterThan(0);
    }
    // 22개를 더한다.
    expect(NEW_PLAYER.length + NEW_TEAM.length + 2).toBe(22);
    expect(achievementScore(g).score).toBe(0);
  });

  it('지난 시즌에 팀이 없었으면 팀 묶음(경기 장면 포함)을 감춘다', () => {
    const g = groupsOf([], S2);
    expect(g.map((x) => x.id)).not.toContain('match');
    expect(ids(g)).not.toContain('team-cup-qf');
  });

  it('숨은 업적은 달성 전에 이름 대신 숨은 업적과 힌트만 보인다(영어 · 일본어도)', () => {
    const g = groupsOf([], S2);
    const s = item(g, 'secret-farewell');
    expect(s.label).toBe('숨은 업적');
    expect(s.desc).toBeTruthy();
    const en = item(localizeAchievements(g, 'en'), 'secret-farewell');
    expect(en.label).toBe('Hidden achievement');
    expect(en.desc).not.toMatch(/[가-힣]/);
    const ja = item(localizeAchievements(g, 'ja'), 'secret-homecoming');
    expect(ja.label).toBe('隠し実績');
  });
});

describe('시즌 2 새 업적 — 달성', () => {
  it('한 시즌의 위업은 같은 시즌 기록으로 판정한다', () => {
    const g = groupsOf(
      [
        career({
          seasons: [
            season({ age: 19, goals: 20, assists: 30 }),
            season({ age: 36, goals: 22 }),
            season({
              age: 21,
              honors: [
                '프리미어리그 우승',
                '프리미어리그 골든부트',
                'UEFA 챔피언스리그 우승',
                'FA컵 우승',
                '발롱도르',
              ],
            }),
            season({
              age: 30,
              honors: ['프리미어리그 우승', 'FA컵 우승', 'EFL컵 우승', 'UEFA 챔피언스리그 우승'],
            }),
          ],
        }),
      ],
      S2,
    );
    for (const id of [
      's-assists-30',
      's-teen-20',
      's-veteran-20',
      's-double',
      's-young-ballon',
      's-quadruple',
      's-ballon-treble',
    ])
      expect(item(g, id).done, id).toBe(true);
    expect(item(g, 's-ballon-treble').points).toBe(150);
  });

  it('경계: 20세 20골 · 34세 20골 · 29도움 · 다른 시즌의 우승과 득점왕은 아니다', () => {
    const g = groupsOf(
      [
        career({
          seasons: [
            season({ age: 20, goals: 20, assists: 29 }),
            season({ age: 34, goals: 25, honors: ['프리미어리그 우승'] }),
            season({ age: 22, honors: ['프리미어리그 골든부트', '발롱도르'] }),
            // 슈퍼컵 · 대표팀 우승은 클럽 우승 4개에 세지 않는다.
            season({
              age: 28,
              honors: [
                '프리미어리그 우승',
                'FA컵 우승',
                'FA 커뮤니티 실드 우승',
                'FIFA 월드컵 우승',
              ],
            }),
          ],
        }),
      ],
      S2,
    );
    for (const id of [
      's-assists-30',
      's-teen-20',
      's-veteran-20',
      's-double',
      's-young-ballon',
      's-quadruple',
    ])
      expect(item(g, id).done, id).toBe(false);
  });

  it('커리어의 모양 — 다섯 리그 · 50골 수비수 · 최고 OVR · 큰 선수 수 · 숨은 업적', () => {
    const leagues = ['프리미어리그', '라리가', '세리에 A', '분데스리가', 'K리그1'];
    const g = groupsOf(
      [
        career({
          peak: 96,
          seasons: [
            season({ age: 20, clubId: 'home', club: 'H', league: 'K리그1' }),
            ...leagues
              .slice(0, 4)
              .map((league, k) => season({ age: 22 + k, clubId: `c${k}`, league })),
            season({
              age: 34,
              clubId: 'home',
              club: 'H',
              league: 'K리그1',
              honors: ['K리그1 우승'],
            }),
          ],
        }),
        career({ pos: 'DF', goals: 50, ballon: 1, legendScore: 1200 }),
        career({ ballon: 2, legendScore: 999 }),
        career({ ballon: 1 }),
      ],
      S2,
    );
    expect(item(g, 'c-journeyman').done).toBe(true);
    expect(item(g, 'c-df-50').done).toBe(true);
    // 85 · 90 · 95 → 3단계, 다음 99(끝이 있는 업적).
    expect(item(g, 'c-peak')).toMatchObject({ level: 3, cur: 96, next: 99, points: 170 });
    expect(item(g, 'c-ballon-players')).toMatchObject({ level: 2, cur: 3, next: 10 });
    expect(item(g, 'c-legends')).toMatchObject({ level: 1, cur: 1, next: 5 });
    const farewell = item(g, 'secret-farewell');
    expect(farewell).toMatchObject({ done: true, label: '우승하고 떠난 마지막 시즌', points: 40 });
    expect(item(g, 'secret-homecoming').done).toBe(true);
    // 달성한 숨은 업적은 영어로도 이름이 보인다.
    expect(item(localizeAchievements(g, 'en'), 'secret-homecoming').label).toBe(
      'Back home to retire',
    );
  });

  it('최고 OVR은 99에서 끝난다(끝없는 단계가 아니다)', () => {
    const g = groupsOf([career({ peak: 99 })], S2);
    expect(item(g, 'c-peak')).toMatchObject({ level: 4, next: null, worth: 0 });
  });

  it('한 구단에만 있었거나 마지막 시즌이 무관이면 숨은 업적이 아니다', () => {
    const g = groupsOf(
      [
        career({
          seasons: [
            season({ age: 20, clubId: 'home' }),
            season({ age: 30, clubId: 'home', honors: [] }),
          ],
        }),
      ],
      S2,
    );
    expect(item(g, 'secret-homecoming').done).toBe(false);
    expect(item(g, 'secret-farewell').done).toBe(false);
  });

  it('경기 장면은 내가 건 경기 집계와 팀 전적으로 판정하고, 한 번 닿으면 남는다', () => {
    const t = team({
      wins: 40,
      draws: 5,
      losses: 5,
      goalsAgainst: 49,
      cleanWins: 20,
      bigWins: 3,
      topScore: 6,
      cupBest: 'qf',
    });
    const g = groupsOf([], { ...S2, team: t });
    expect(item(g, 'team-clean')).toMatchObject({ level: 2, cur: 20, next: 60 });
    expect(item(g, 'team-clean').desc).toBeTruthy();
    expect(item(g, 'team-thrash')).toMatchObject({ level: 1, next: 10 });
    expect(item(g, 'team-six').done).toBe(true);
    // 50경기 40승(80%) · 49실점 < 50경기.
    expect(item(g, 'team-winrate').done).toBe(true);
    expect(item(g, 'team-wall').done).toBe(true);
    expect(item(g, 'team-cup-qf').done).toBe(true);
    expect(item(g, 'team-cup-sf').done).toBe(false);
    const kept = teamKeptOf(g);
    expect(kept).toMatchObject({ 'team-clean': 20, 'team-winrate': 1, 'team-wall': 1 });
    // 지고 나서 승률이 내려가도 그 시즌에는 남는다.
    const later = groupsOf([], {
      ...S2,
      team: team({ ...t, wins: 40, losses: 40, goalsAgainst: 200, cleanWins: 20 }),
      kept,
    });
    expect(item(later, 'team-winrate').done).toBe(true);
    expect(item(later, 'team-wall').done).toBe(true);
  });

  it('경기 수가 모자라면 승률 · 실점 업적이 아니다', () => {
    const g = groupsOf([], { ...S2, team: team({ wins: 29, goalsAgainst: 0 }) });
    expect(item(g, 'team-winrate').done).toBe(false);
    expect(item(g, 'team-wall').done).toBe(false);
  });

  it('감독 — 리그 우승 합계(끝없이) · 우승과 승격을 한 감독', () => {
    const g = groupsOf([], {
      ...S2,
      managers: [
        { titles: 3, promotions: 0, grade: 'A', mastery: {} },
        { titles: 2, promotions: 1, grade: 'B', mastery: {} },
      ],
    });
    expect(item(g, 'mgr-titles')).toMatchObject({ level: 2, cur: 5, next: 10 });
    expect(item(g, 'mgr-double').done).toBe(true);
  });
});

describe('시즌 2 단계 점수와 보상', () => {
  it('쌓기 기록은 완만한 사다리(GRIND), 큰 선수 기록은 끝을 낮춘 사다리(STEEP)다', () => {
    const big = career({ goals: 30_000, caps: 10_000 });
    const g = groupsOf([big], S2);
    // GRIND 10 · 20 · 30 · 50 · 80 · 120.
    expect(item(g, 'goals')).toMatchObject({ level: 6, points: 310, worth: 120 });
    // STEEP 10 · 20 · 40 · 80 · 160.
    expect(item(g, 'caps')).toMatchObject({ level: 5, points: 310, worth: 240 });
  });

  it('보상은 시즌 2 표, 끝없는 단계는 강화권 1장씩이다', () => {
    const g = groupsOf([career({ goals: 300_000 })], S2);
    const goals = achRewardSteps(g, 2).filter((s) => s.id === 'goals');
    // 30점 3단계는 없음, 50 · 80점은 1장, 120점은 2장, 7 · 8단계(끝없는 단계)는 1장.
    expect(goals.map((s) => [s.key, s.boost, s.scout])).toEqual([
      ['goals:4', 1, 0],
      ['goals:5', 1, 0],
      ['goals:6', 2, 0],
      ['goals:7', 1, 0],
      ['goals:8', 1, 0],
    ]);
    // 응답의 다음 보상도 같은 규칙이다.
    const shown = item(withAchRewards(g, new Map(), 2), 'goals');
    expect(shown.reward).toEqual({ boost: 1, scout: 0 });
  });

  it('같은 기록이면 시즌 2 보상이 예전 규칙(끝없는 단계 · 예전 표)보다 적다', () => {
    const owners = [
      // 중간 구단주: 평범한 선수 20명.
      Array.from({ length: 20 }, () =>
        career({
          goals: 150,
          assists: 80,
          apps: 600,
          caps: 30,
          trophies: 6,
          awards: 5,
          legendScore: 700,
        }),
      ),
      [
        career({ goals: 30_000, assists: 15_000, apps: 100_000, caps: 10_000, trophies: 2_000 }),
        career({ awards: 3_000, legendScore: 100_000, ballon: 30, peak: 97 }),
      ],
    ];
    for (const cs of owners) {
      const sum = (xs: { boost: number; scout: number }[]) =>
        xs.reduce((t, s) => ({ boost: t.boost + s.boost, scout: t.scout + s.scout }), {
          boost: 0,
          scout: 0,
        });
      const before = sum(achRewardSteps(groupsOf(cs, { endless: true, ladder: true }), 1));
      const after = sum(achRewardSteps(groupsOf(cs, S2), 2));
      expect(after.boost).toBeLessThan(before.boost);
      expect(after.scout).toBeLessThanOrEqual(before.scout);
    }
  });
});

describe('경기 장면 재료(ownerActivityIn) — 같은 경기 행 한 번 읽기', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('내가 건 경기의 무실점 승리 · 4골 차 이상 승리 · 최다 득점을 세고, asOf 뒤 경기는 뺀다', async () => {
    const me = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const teamRow = (id: string, profileId: string) =>
      ctx.env.DB.prepare(
        `INSERT INTO owner_teams (id, profile_id, season, name, formation, slots_json, filled, ovr, created_at, updated_at)
         VALUES (?, ?, 2, ?, '4-3-3', '[]', 0, 0, '2026-11-01', '2026-11-01')`,
      )
        .bind(id, profileId, id)
        .run();
    await teamRow('t-me', me.profileId);
    await teamRow('t-other', other.profileId);
    const match = (
      id: string,
      by: string,
      home: string,
      away: string,
      hg: number,
      ag: number,
      at: string,
    ) =>
      ctx.env.DB.prepare(
        `INSERT INTO team_matches (id, profile_id, home_team_id, away_team_id, home_goals, away_goals, detail_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, '{}', ?)`,
      )
        .bind(id, by, home, away, hg, ag, at)
        .run();
    await match('m1', me.profileId, 't-me', 't-other', 2, 0, '2026-11-01T01:00:00.000Z'); // 무실점 승
    await match('m2', me.profileId, 't-me', 't-other', 6, 1, '2026-11-01T02:00:00.000Z'); // 4골 차 이상 · 6골
    await match('m3', me.profileId, 't-me', 't-other', 0, 0, '2026-11-02T01:00:00.000Z'); // 무승부는 무실점 승리가 아니다
    await match('m4', me.profileId, 't-me', 't-other', 4, 0, '2026-11-03T01:00:00.000Z'); // 무실점 · 4골 차
    // 상대가 건 경기(내가 원정)는 세지 않는다.
    await match('m5', other.profileId, 't-other', 't-me', 0, 7, '2026-11-02T03:00:00.000Z');

    const now = await ownerActivityIn(ctx.db, me.profileId, 2, 't-me');
    expect(now).toMatchObject({ matchDays: 3, cleanWins: 2, bigWins: 2, topScore: 6 });
    const asOf = await ownerActivityIn(ctx.db, me.profileId, 2, 't-me', '2026-11-02T00:00:00.000Z');
    expect(asOf).toMatchObject({ matchDays: 1, cleanWins: 1, bigWins: 1, topScore: 6 });
    // 경기가 없으면 0.
    expect(await ownerActivityIn(ctx.db, other.profileId, 2, null)).toMatchObject({
      cleanWins: 0,
      bigWins: 0,
      topScore: 0,
    });
    const empty = await ownerActivityIn(ctx.db, me.profileId, 3, 't-none');
    expect(empty).toMatchObject({ matchDays: 0, cleanWins: 0, bigWins: 0, topScore: 0 });
  });
});
