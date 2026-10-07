import {
  ErrorEnvelopeSchema,
  OwnerProfileResponseSchema,
  OwnerTitlesResponseSchema,
  PutOwnerTeamResponseSchema,
  PutOwnerTitleResponseSchema,
  TeamProfileResponseSchema,
  TeamRankResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { careers, cupEntries, cups } from '../db/schema.js';
import { createTestD1, syncCards, type TestD1 } from '../test/d1.js';
import { installFakeEdgeCache } from '../test/edgeCache.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

const PutTeam = successEnvelope(PutOwnerTeamResponseSchema);
const OwnerRes = successEnvelope(OwnerProfileResponseSchema);
const MyRes = successEnvelope(OwnerTitlesResponseSchema);
const TitleRes = successEnvelope(PutOwnerTitleResponseSchema);
const TeamRes = successEnvelope(TeamProfileResponseSchema);
const RankRes = successEnvelope(TeamRankResponseSchema);
const AT = '2026-09-28T00:00:00.000Z';

describe('/v1/owners · /v1/owner/title (T-11-150 구단주 프로필 · 대표 칭호)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    installFakeEdgeCache();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z')); // 프리시즌(팀 시즌 0)
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);

  /** 은퇴 선수 한 명으로 프리시즌 팀을 만든 구단주. */
  async function owner(nickname: string) {
    const who = await issueGoogleCookie(ctx, { nickname });
    const id = crypto.randomUUID();
    await ctx.db.insert(careers).values({
      id,
      profileId: who.profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: 'retired',
      appVersion: '1.0.0',
      createdAt: AT,
      updatedAt: AT,
      retiredAt: AT,
      retireAge: 34,
      peak: 80,
      legendScore: 300,
      shirtNumber: 9,
      serviceSeason: 0,
    });
    await syncCards(ctx);
    const slots: (string | null)[] = Array(11).fill(null);
    slots[9] = id;
    const res = await call('PUT', '/v1/owner-team', {
      cookie: who.cookie,
      body: { name: `${nickname}FC`, manager: `${nickname}감독`, formation: '4-3-3', slots },
    });
    expect(res.status).toBe(200);
    return { ...who, team: PutTeam.parse(await res.json()).data.team };
  }

  /** 끝난 대회 성적(보상까지 끝난 것). */
  async function honor(
    who: { profileId: string; team: { id: string; name: string } },
    edition: number,
    stage: 'champion' | 'runnerup' | 'sf' | 'qf',
  ) {
    const id = `s1-${edition}`;
    if (edition > 1)
      await ctx.db.insert(cups).values({
        id,
        season: 1,
        edition,
        opensAt: `2026-1${edition}-01T00:00:00.000Z`,
        closesAt: `2026-1${edition}-02T00:00:00.000Z`,
        drawAt: `2026-1${edition}-03T00:00:00.000Z`,
        roundsJson: '[]',
        capacity: 64,
        minFilled: 8,
        createdAt: AT,
      });
    await ctx.db.insert(cupEntries).values({
      cupId: id,
      teamId: who.team.id,
      profileId: who.profileId,
      name: who.team.name,
      manager: '감독',
      ovr: 60,
      status: stage === 'champion' ? 'champion' : 'out',
      stage,
      rewardedAt: AT,
      createdAt: AT,
      updatedAt: AT,
    });
  }

  const putTitle = (cookie: string, title: string | null) =>
    call('PUT', '/v1/owner/title', { cookie, body: { title } });

  it('팀 id로 남의 구단주 프로필을 보고, 받은 칭호 가운데서만 대표 칭호를 고른다', async () => {
    const a = await owner('알파');
    await honor(a, 1, 'champion');
    await honor(a, 2, 'sf');
    await honor(a, 3, 'qf');

    const pub = OwnerRes.parse(
      await (await call('GET', `/v1/owners/by-team/${a.team.id}`)).json(),
    ).data;
    expect(pub.mine).toBe(false);
    expect(pub.owner).toMatchObject({
      nickname: '알파',
      title: null,
      team: { id: a.team.id, name: '알파FC', manager: '알파감독', season: 0 },
      stats: { retired: 1, retiredNumbers: 0 },
    });
    expect(pub.owner.cupHonors.map((h) => h.stage)).toEqual(['qf', 'sf', 'champion']);

    const my = MyRes.parse(
      await (await call('GET', '/v1/owner/title', { cookie: a.cookie })).json(),
    ).data;
    expect(my).toEqual({
      title: null,
      titles: ['cup-1-champion', 'cup-2-sf'],
      pinned: false,
      teamId: a.team.id,
    });

    // 받은 적 없는 칭호는 거절한다.
    const bad = await putTitle(a.cookie, 'cup-3-sf');
    expect(bad.status).toBe(409);
    expect(ErrorEnvelopeSchema.parse(await bad.json()).error.details).toMatchObject({
      reason: 'TITLE_NOT_OWNED',
    });

    const pick = await putTitle(a.cookie, 'cup-2-sf');
    expect(TitleRes.parse(await pick.json()).data).toEqual({ title: 'cup-2-sf', pinned: true });
    // 팀 프로필 · 랭킹에 붙는다.
    const team = TeamRes.parse(await (await call('GET', `/v1/teams/${a.team.id}`)).json()).data;
    expect(team.team.ownerTitle).toBe('cup-2-sf');
    const rank = RankRes.parse(await (await call('GET', '/v1/teams')).json()).data;
    expect(rank.items.find((t) => t.teamId === a.team.id)?.title).toBe('cup-2-sf');

    // 달지 않기 → 다시 자동(가장 좋은 칭호).
    expect(TitleRes.parse(await (await putTitle(a.cookie, 'none')).json()).data).toEqual({
      title: null,
      pinned: true,
    });
    expect(TitleRes.parse(await (await putTitle(a.cookie, null)).json()).data).toEqual({
      title: 'cup-1-champion',
      pinned: false,
    });
    const mine = OwnerRes.parse(
      await (await call('GET', `/v1/owners/by-team/${a.team.id}`, { cookie: a.cookie })).json(),
    ).data;
    expect(mine).toMatchObject({ mine: true, owner: { title: 'cup-1-champion' } });
  });

  it('없는 팀이면 404, 로그인 안 했으면 명예관을 못 연다', async () => {
    const res = await call('GET', `/v1/owners/by-team/tem_${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
    expect((await call('GET', '/v1/owner/title')).status).toBe(401);
  });
});
