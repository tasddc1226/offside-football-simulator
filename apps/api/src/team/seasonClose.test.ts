import {
  SeasonRecapResponseSchema,
  OwnerHonorsResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { careers } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';
import { ownerTiersOf } from '../db/repos/ownerTiers.js';
import { closeDivisions, closeStateOf, runSeasonClose } from './seasonClose.js';

const RecapRes = successEnvelope(SeasonRecapResponseSchema);
const HonorsRes = successEnvelope(OwnerHonorsResponseSchema);
/** 프리시즌이 끝난 시각(시즌 1 개막). */
const CUTOFF = '2026-10-05T15:00:00.000Z';
const BEFORE = '2026-10-04T00:00:00.000Z';
const AFTER = '2026-10-06T00:00:00.000Z';

describe('T-11-128 시즌 결산', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T00:00:00.000Z'));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  async function addCareer(
    profileId: string,
    o: {
      retiredAt?: string | null;
      score?: number;
      wall?: boolean;
      name?: string;
      goals?: number;
      peak?: number;
    },
  ) {
    const id = crypto.randomUUID();
    const retired = o.retiredAt !== null;
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: retired ? 'retired' : 'active',
      appVersion: '1.0.0',
      createdAt: BEFORE,
      updatedAt: BEFORE,
      retiredAt: retired ? (o.retiredAt ?? BEFORE) : null,
      retireAge: retired ? 34 : null,
      peak: retired ? (o.peak ?? 80) : null,
      apps: retired ? 300 : null,
      goals: retired ? (o.goals ?? 10) : null,
      ballon: retired ? 1 : null,
      legendScore: retired ? (o.score ?? 300) : null,
      lastClub: '서울',
      publicName: o.name ?? null,
      serviceSeason: 0,
      wallOfHonorJson: o.wall
        ? JSON.stringify({ clubId: 'k1-seoul', club: '서울', number: 9, grantedAt: AFTER })
        : null,
    });
    return id;
  }

  const addTeam = (profileId: string, rating: number) =>
    ctx.db.run(sql`
      insert into owner_teams (id, profile_id, season, name, formation, slots_json, filled, ovr, rating, wins, goals_for, goals_against, best_margin, created_at, updated_at)
      values (${crypto.randomUUID()}, ${profileId}, 0, ${`팀 ${rating}`}, '4-3-3', '[]', 1, 70, ${rating}, 3, 9, 4, 3, ${BEFORE}, ${BEFORE})`);

  const addAch = (profileId: string, score: number, reachedAt: string) =>
    ctx.db.run(sql`
      insert into owner_achievements (profile_id, season, score, done, players, reached_at, updated_at)
      values (${profileId}, 0, ${score}, 3, 1, ${reachedAt}, ${reachedAt})`);

  async function closeAll() {
    const steps: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await runSeasonClose(ctx.db, new Date().toISOString());
      if (!r) break;
      steps.push(r.step);
    }
    return steps;
  }

  it('통계를 묶음마다 저장하고 중단 뒤 다음 구단주부터 재개한다', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    await addCareer(a.profileId, { goals: 12 });
    await addCareer(b.profileId, { goals: 34 });
    const now = new Date().toISOString();
    expect((await runSeasonClose(ctx.db, now, 1))?.next).toBe('stats');
    expect((await runSeasonClose(ctx.db, now, 1))?.next).toBe('stats');
    const state = await closeStateOf(ctx.db, 0);
    expect(state?.statsAfter).toBeTruthy();
    const first = await ctx.db.all<{ profile_id: string; stats_json: string | null }>(sql`
      select profile_id, stats_json from owner_season_records where season = 0 order by profile_id`);
    expect(first.filter((row) => row.stats_json !== null)).toHaveLength(1);
    expect(first[0]!.profile_id).toBe(state?.statsAfter);
    await runSeasonClose(ctx.db, now, 1);
    expect((await closeStateOf(ctx.db, 0))?.statsAfter).toBe(first[1]!.profile_id);
    await runSeasonClose(ctx.db, now, 1);
    expect(await closeStateOf(ctx.db, 0)).toMatchObject({ step: 'ach' });
    const rows = await ctx.db.all<{ profile_id: string; stats_json: string }>(sql`
      select profile_id, stats_json from owner_season_records where season = 0`);
    const totals = Object.fromEntries(
      rows.map((row) => [row.profile_id, JSON.parse(row.stats_json).stats.goals]),
    );
    expect(totals).toEqual({ [a.profileId]: 12, [b.profileId]: 34 });
  });

  it('개막 시각까지의 기록으로 프리시즌을 굳히고 휘장을 준다', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    const anon = await issueCookie(ctx);
    const best = await addCareer(a.profileId, {
      score: 500,
      wall: true,
      name: '도하람',
      goals: 40,
    });
    // 레전드 점수는 낮아도 골을 더 넣은 선수가 최다 득점 · 최고 OVR 엘리트 카드.
    const scorer = await addCareer(a.profileId, { score: 200, goals: 120, peak: 88, name: '한빛' });
    // 개막 뒤 은퇴는 결산에 들지 않는다(기록은 프리시즌으로 남아도).
    await addCareer(a.profileId, { retiredAt: AFTER, score: 900 });
    await addCareer(a.profileId, { retiredAt: null });
    const bCareer = await addCareer(b.profileId, { score: 300 });
    await addCareer(anon.profileId, { score: 100 });
    await ctx.db.run(sql`
      insert into retired_numbers (season, club_id, number, career_id, club, score, seq, granted_at)
      values (0, 'k1-seoul', 9, ${best}, '서울', 500, 1, ${BEFORE})`);
    await ctx.db.run(sql`
      insert into server_firsts (season, id, career_id, achieved_at) values (0, 'ballon', ${bCareer}, ${BEFORE})`);
    await addTeam(a.profileId, 1000);
    await addTeam(b.profileId, 1100);
    await addAch(a.profileId, 1000, BEFORE);
    // 개막 뒤에 점수가 바뀐 구단주는 개막 시각 기준으로 다시 센다.
    await addAch(b.profileId, 9999, AFTER);

    const pending = RecapRes.parse(
      await (
        await callJson(ctx.env, 'GET', '/v1/owner/season-recap?season=0', { cookie: a.cookie })
      ).json(),
    );
    expect(pending.data.status).toBe('pending');

    // T-11-375 디비전 단계는 보상 시작 시즌(기본 2) 전이라 휘장 · 리롤권 없이 지나간다.
    expect(await closeAll()).toEqual([
      'records',
      'stats',
      'stats',
      'ach',
      'ranks',
      'honors',
      'specials',
      'division',
    ]);
    expect(await closeStateOf(ctx.db, 0)).toMatchObject({
      step: 'done',
      cutoff: CUTOFF,
      ranked: { team: 2, ach: 2, hof: 4 },
    });
    // 시즌 1은 아직 끝나지 않았다.
    expect(await closeStateOf(ctx.db, 1)).toBeNull();

    const mine = RecapRes.parse(
      await (await callJson(ctx.env, 'GET', '/v1/owner/season-recap', { cookie: a.cookie })).json(),
    ).data;
    expect(mine.status).toBe('ready');
    expect(mine.recap).toMatchObject({
      season: 0,
      cutoff: CUTOFF,
      players: 4,
      retired: 2,
      best: { careerId: best, name: '도하람', score: 500 },
      hofRank: 1,
      hofRanked: 4,
      retiredNumbers: 1,
      wallOfHonor: 1,
      firsts: 0,
      team: {
        rating: 1000,
        rank: 2,
        ranked: 2,
        wins: 3,
        goalsFor: 9,
        goalsAgainst: 4,
        bestMargin: 3,
      },
      // 다른 구단주의 9999점은 개막 시각 기준으로 다시 세어 내려간다.
      achievements: { score: 1000, rank: 1, ranked: 2 },
      // 개막 뒤 은퇴 · 현역은 묶음에 들지 않는다.
      stats: {
        apps: 600,
        goals: 160,
        ballon: 2,
        tiers: { icon: 0, legend: 0, elite: 1, gold: 1, silver: 0, bronze: 0 },
        scorer: { careerId: scorer, name: '한빛', pos: 'FW', goals: 120 },
      },
    });
    // 단체사진 · 카드 흐름: 마감 전 은퇴한 선수만, 레전드 점수 순(카드 · 마지막 구단).
    expect(
      mine.recap?.squad?.map((m) => [m.card.careerId, m.card.legendScore, m.lastClub]),
    ).toEqual([
      [best, 500, '서울'],
      [scorer, 200, '서울'],
    ]);
    expect(mine.recap?.best?.card).toMatchObject({ careerId: best, peak: 80, season: 0 });
    const kinds = Object.fromEntries(mine.honors.map((h) => [h.kind, h]));
    expect(Object.keys(kinds).sort()).toEqual(
      ['achievements', 'hof', 'pioneer', 'retired-number', 'team', 'wall-of-honor'].sort(),
    );
    expect(kinds.hof).toMatchObject({ band: 1, rank: 1 });
    expect(kinds.team).toMatchObject({ band: 10, rank: 2 });

    const other = RecapRes.parse(
      await (
        await callJson(ctx.env, 'GET', '/v1/owner/season-recap?season=0', { cookie: b.cookie })
      ).json(),
    ).data;
    expect(other.recap?.achievements).toMatchObject({ rank: 2 });
    expect(other.recap?.achievements?.score).toBeLessThan(200);
    expect(other.recap?.team?.rank).toBe(1);
    expect(other.honors.find((h) => h.kind === 'first')?.value).toBe(1);

    // 로그인 수단이 없는 프로필도 결산은 보지만 순위 휘장은 없다.
    const guest = RecapRes.parse(
      await (
        await callJson(ctx.env, 'GET', '/v1/owner/season-recap?season=0', { cookie: anon.cookie })
      ).json(),
    ).data;
    expect(guest.honors.map((h) => h.kind).sort()).toEqual(['hof', 'pioneer']);

    // 마감 때 굳힌 업적 점수의 업적 등급이 티어로 붙는다(댓글 · 채팅 · 프로필).
    const tiers = await ownerTiersOf(
      ctx.db,
      [a.profileId, b.profileId, anon.profileId, 'prf_none'],
      new Date().toISOString(),
    );
    // A: 1,000점 → 골드 · B: 개막 시각 기준으로 다시 센 점수(200 미만) → 루키 · 게스트: 업적 점수 없음 → 루키.
    expect(Object.fromEntries([...tiers].map(([id, t]) => [id, t.tier]))).toEqual({
      [a.profileId]: 'gold',
      [b.profileId]: 'rookie',
      [anon.profileId]: 'rookie',
    });

    // 다시 돌려도 바꾸지 않는다.
    expect(await closeAll()).toEqual([]);
    const all = HonorsRes.parse(
      await (await callJson(ctx.env, 'GET', '/v1/owner/honors', { cookie: a.cookie })).json(),
    ).data;
    expect(all.seasons).toEqual([0]);
    expect(all.honors).toHaveLength(6);
  });

  describe('T-11-375 시즌 마감 디비전 보상', () => {
    const NOW = '2026-11-01T00:00:00.000Z';
    const SEASON = 2;
    const CUT = '2026-10-31T00:00:00.000Z';
    const team = (
      profileId: string,
      o: { division: number; filled?: number; games?: number; createdAt?: string },
    ) =>
      ctx.db.run(sql`
        insert into owner_teams (id, profile_id, season, name, formation, slots_json, filled, ovr, rating, division, wins, draws, losses, created_at, updated_at)
        values (${crypto.randomUUID()}, ${profileId}, ${SEASON}, ${`팀 ${o.division}`}, '4-3-3', '[]', ${o.filled ?? 11}, 80, 1000,
          ${o.division}, ${o.games ?? 30}, 0, 0, ${o.createdAt ?? BEFORE}, ${BEFORE})`);
    const rerolls = async (profileId: string) => {
      const [row] = await ctx.db.all<{ qty: number }>(
        sql`select qty from owner_items where profile_id = ${profileId} and item = 'reroll'`,
      );
      return row?.qty ?? 0;
    };
    const honorOf = async (profileId: string) => {
      const [row] = await ctx.db.all<{ value: number }>(
        sql`select value from owner_honors where profile_id = ${profileId} and season = ${SEASON} and kind = 'division'`,
      );
      return row?.value ?? null;
    };

    it('자격을 갖춘 프로 II 이상에만 휘장과 리롤권(가안 1 · 2 · 3 · 4 · 6)을 한 번만 준다', async () => {
      const master = await issueGoogleCookie(ctx);
      const pro2 = await issueGoogleCookie(ctx);
      const semi = await issueGoogleCookie(ctx);
      const few = await issueGoogleCookie(ctx);
      const thin = await issueGoogleCookie(ctx);
      const late = await issueGoogleCookie(ctx);
      const guest = await issueCookie(ctx);
      await team(master.profileId, { division: 7 });
      await team(pro2.profileId, { division: 3 });
      await team(semi.profileId, { division: 2 });
      // 경기 수 · 선발 은퇴 선수 수 · 마감 뒤에 만든 팀은 자격 밖.
      await team(few.profileId, { division: 6, games: 19 });
      await team(thin.profileId, { division: 6, filled: 7 });
      await team(late.profileId, { division: 6, createdAt: NOW });
      await team(guest.profileId, { division: 7 });
      await ctx.db.run(
        sql`insert into owner_items (profile_id, item, qty, updated_at) values (${pro2.profileId}, 'reroll', 5, ${BEFORE})`,
      );

      expect(await closeDivisions(ctx.db, SEASON, CUT, NOW)).toBe(2);
      expect(await honorOf(master.profileId)).toBe(7);
      expect(await honorOf(pro2.profileId)).toBe(3);
      for (const p of [semi, few, thin, late, guest]) expect(await honorOf(p.profileId)).toBeNull();
      expect(await rerolls(master.profileId)).toBe(6);
      expect(await rerolls(pro2.profileId)).toBe(6);
      expect(await rerolls(few.profileId)).toBe(0);

      // 다시 돌아도(다른 시각) 두 번 주지 않는다.
      expect(await closeDivisions(ctx.db, SEASON, CUT, '2026-11-01T00:05:00.000Z')).toBe(0);
      expect(await rerolls(master.profileId)).toBe(6);
    });

    it('보상 시작 시즌 전(시즌 1)에는 아무것도 주지 않는다', async () => {
      const a = await issueGoogleCookie(ctx);
      await ctx.db.run(sql`
        insert into owner_teams (id, profile_id, season, name, formation, slots_json, filled, ovr, rating, division, wins, created_at, updated_at)
        values (${crypto.randomUUID()}, ${a.profileId}, 1, '팀', '4-3-3', '[]', 11, 80, 1400, 7, 40, ${BEFORE}, ${BEFORE})`);
      expect(await closeDivisions(ctx.db, 1, CUT, NOW)).toBe(0);
      expect(await rerolls(a.profileId)).toBe(0);
    });

    it('운영 도구에서 보상 시작 시즌 · 리롤권 수를 바꾸면 그 값으로 준다', async () => {
      const a = await issueGoogleCookie(ctx);
      await ctx.db.run(sql`
        insert into owner_teams (id, profile_id, season, name, formation, slots_json, filled, ovr, rating, division, wins, created_at, updated_at)
        values (${crypto.randomUUID()}, ${a.profileId}, 1, '팀', '4-3-3', '[]', 11, 80, 1400, 7, 40, ${BEFORE}, ${BEFORE})`);
      await ctx.db.run(sql`
        insert into balance_versions (status, note, values_json, created_by, created_at, updated_at, activated_at)
        values ('active', '', ${JSON.stringify({ teamDivRewardFrom: 1, teamDivReward7: 9 })}, 'admin', ${BEFORE}, ${BEFORE}, ${BEFORE})`);
      expect(await closeDivisions(ctx.db, 1, CUT, NOW)).toBe(1);
      expect(await rerolls(a.profileId)).toBe(9);
    });
  });
});
