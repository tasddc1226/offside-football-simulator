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
import { closeStateOf, runSeasonClose } from './seasonClose.js';

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

    expect(await closeAll()).toEqual(['records', 'ach', 'ranks', 'honors']);
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
});
