import {
  ErrorEnvelopeSchema,
  PlayTeamMatchResponseSchema,
  PutOwnerTeamResponseSchema,
  TeamLikeResponseSchema,
  TeamProfileResponseSchema,
  TeamRankResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { careers, ownerTeams, teamLikes, teamMatches } from '../db/schema.js';
import { createTestD1, spyDb, syncCards, type TestD1 } from '../test/d1.js';
import { flushEdge, installFakeEdgeCache } from '../test/edgeCache.js';
import { callJson, deleteProfile, issueCookie, issueGoogleCookie } from '../test/http.js';

const PutRes = successEnvelope(PutOwnerTeamResponseSchema);
const PlayRes = successEnvelope(PlayTeamMatchResponseSchema);
const RankRes = successEnvelope(TeamRankResponseSchema);
const ProfileRes = successEnvelope(TeamProfileResponseSchema);
const LikeRes = successEnvelope(TeamLikeResponseSchema);

let seq = 0;

describe('/v1/teams (T-10-092 라이브 랭킹 · 팀 프로필)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z')); // 프리시즌(팀 시즌 0)
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);

  /** 구단주 + 은퇴 선수 n명(공격수, 공개 이름)으로 만든 프리시즌 팀. */
  async function team(n: number, peak: number, manager = `감독${++seq}`) {
    const who = await issueGoogleCookie(ctx);
    const s: (string | null)[] = Array(11).fill(null);
    for (let i = 0; i < n; i++) {
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
        createdAt: '2026-09-28T00:00:00.000Z',
        updatedAt: '2026-09-28T00:00:00.000Z',
        retiredAt: '2026-09-28T00:00:00.000Z',
        retireAge: 34,
        peak,
        legendScore: 300,
        shirtNumber: 9,
        publicName: i === 0 ? `${manager} 에이스` : null,
        serviceSeason: 0,
      });
      s[[9, 8, 10][i]!] = id;
    }
    await syncCards(ctx);
    const res = await call('PUT', '/v1/owner-team', {
      cookie: who.cookie,
      body: { name: `팀${++seq}`, manager, formation: '4-3-3', slots: s },
    });
    expect(res.status).toBe(200);
    return { ...who, team: PutRes.parse(await res.json()).data.team };
  }

  const rank = async (q = '') => {
    const res = await call('GET', `/v1/teams${q}`);
    expect(res.status).toBe(200);
    return { res, data: RankRes.parse(await res.json()).data };
  };
  const profile = async (id: string, cookie?: string) =>
    ProfileRes.parse(await (await call('GET', `/v1/teams/${id}`, cookie ? { cookie } : {})).json())
      .data;

  it('선수가 있는 팀만 레이팅 순으로 오르고, OVR 순으로도 본다', async () => {
    const strong = await team(3, 90, '강감독');
    const weak = await team(1, 70);
    const empty = await issueGoogleCookie(ctx);
    await call('PUT', '/v1/owner-team', {
      cookie: empty.cookie,
      body: { name: '빈 팀', manager: '빈감독', formation: '4-4-2', slots: Array(11).fill(null) },
    });
    // 약한 팀이 이기도록 레이팅을 직접 둔다(경기 결과는 무작위).
    await ctx.db.update(ownerTeams).set({ rating: 1040 }).where(eq(ownerTeams.id, weak.team.id));

    const { res, data } = await rank();
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(data).toMatchObject({ season: 0, sort: 'rating', page: 1, total: 2 });
    expect(data.seasons).toEqual([{ id: 0, name: '프리시즌' }]);
    expect(data.items.map((i) => [i.rank, i.teamId])).toEqual([
      [1, weak.team.id],
      [2, strong.team.id],
    ]);
    expect(data.items[1]).toMatchObject({ manager: '강감독', rating: 1000, likes: 0 });
    const byOvr = (await rank('?sort=ovr')).data;
    expect(byOvr.items.map((i) => i.teamId)).toEqual([strong.team.id, weak.team.id]);
    expect((await call('GET', '/v1/teams?season=1')).status).toBe(400);
    expect((await call('GET', '/v1/teams?sort=goals')).status).toBe(400);
  });

  it('최근 5경기는 홈·원정을 합쳐 최신순으로 읽고 상대 결과는 뒤집는다', async () => {
    const a = await team(1, 80);
    const b = await team(1, 75);
    const idle = await team(1, 70);
    const results = ['W', 'D', 'L', 'W', 'D', 'L', 'W'] as const;
    await ctx.db.insert(teamMatches).values(
      results.map((result, i) => {
        const homeA = i % 2 === 0;
        const ownGoals = result === 'W' ? 2 : result === 'D' ? 1 : 0;
        return {
          id: `form-${i}`,
          profileId: homeA ? a.profileId : b.profileId,
          homeTeamId: homeA ? a.team.id : b.team.id,
          awayTeamId: homeA ? b.team.id : a.team.id,
          homeGoals: homeA ? ownGoals : 1,
          awayGoals: homeA ? 1 : ownGoals,
          detailJson: '{}',
          // Last two matches share a timestamp: ID breaks the tie deterministically.
          createdAt: `2026-09-29T00:00:0${Math.min(i, 5)}.000Z`,
        };
      }),
    );
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await callJson({ ...ctx.env, DB }, 'GET', '/v1/teams');
    expect(res.status).toBe(200);
    const { data } = RankRes.parse(await res.json());
    expect(data.items.find((x) => x.teamId === a.team.id)?.recentForm).toEqual([
      'W',
      'L',
      'D',
      'W',
      'L',
    ]);
    expect(data.items.find((x) => x.teamId === b.team.id)?.recentForm).toEqual([
      'L',
      'W',
      'D',
      'L',
      'W',
    ]);
    expect(data.items.find((x) => x.teamId === idle.team.id)?.recentForm).toEqual([]);
    expect(seen.filter((query) => query.includes('WITH requested'))).toHaveLength(1);
    expect(seen.filter((query) => query.includes('sessions'))).toEqual([]);
  });

  it('팀 프로필은 누구나 보고, 순위·선수 공개 이름·배지를 보인다', async () => {
    const a = await team(3, 88, '홍감독');
    const b = await team(1, 60);
    const play = await call('POST', '/v1/owner-team/matches', {
      cookie: a.cookie,
      headers: { 'Idempotency-Key': `teams-play-${++seq}-key` },
      body: { opponentTeamId: b.team.id },
    });
    const { match } = PlayRes.parse(await play.json()).data;

    const p = await profile(a.team.id);
    expect(p).toMatchObject({ liked: false, mine: false });
    expect(p.team).toMatchObject({
      id: a.team.id,
      season: 0,
      seasonName: '프리시즌',
      manager: '홍감독',
      record: { w: match.home.goals > match.away.goals ? 1 : 0 },
      goals: { for: match.home.goals, against: match.away.goals },
    });
    expect(p.team.rank).toBe(p.team.rating >= 1000 ? 1 : 2);
    expect(p.team.slots[9]).toMatchObject({ slot: 'ST', name: '홍감독 에이스' });
    expect(p.team.slots[8]!.name).toBe('익명의 공격수 No.9');
    expect(p.team.badges.map((x) => x.id)).toContain('debut');
    expect(p.team.badges.some((x) => x.id.startsWith('final-'))).toBe(false); // 아직 진행 중인 시즌
    expect((await profile(a.team.id, a.cookie)).mine).toBe(true);
    expect((await call('GET', `/v1/teams/tem_${crypto.randomUUID()}`)).status).toBe(404);

    // 시즌 1이 열리면 프리시즌은 끝난 시즌 — 최종 순위 배지가 붙는다.
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
    const top = p.team.rank === 1 ? a : b;
    const final = await profile(top.team.id);
    expect(final.team.badges[0]).toMatchObject({ id: 'final-1', desc: '프리시즌 최종 1위' });
    expect((await rank('?season=0')).data.total).toBe(2);
    expect((await rank()).data).toMatchObject({ season: 1, total: 0 });
  });

  it('T-11-106: lang=en이면 시즌 이름·익명 선수·배지 문구가 영어, lang이 없거나 모르는 값이면 한국어', async () => {
    const a = await team(3, 88, '홍감독');
    const p = ProfileRes.parse(
      await (await call('GET', `/v1/teams/${a.team.id}?lang=en`)).json(),
    ).data;
    expect(p.team).toMatchObject({ seasonName: 'Preseason' });
    expect(p.team.slots[9]!.name).toBe('홍감독 에이스'); // 공개 이름은 그대로
    expect(p.team.slots[8]!.name).toBe('Anonymous forward No.9');
    expect(p.team.slots[0]!.name).toBe('Youth player');
    const unknown = ProfileRes.parse(
      await (await call('GET', `/v1/teams/${a.team.id}?lang=fr`)).json(),
    ).data;
    expect(unknown.team).toMatchObject({ seasonName: '프리시즌' });
    expect(unknown.team.slots[8]!.name).toBe('익명의 공격수 No.9');
    expect(unknown.team.slots[0]!.name).toBe('유스 선수');

    // 끝난 시즌의 최종 순위 배지 문장
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
    const final = ProfileRes.parse(
      await (await call('GET', `/v1/teams/${a.team.id}?lang=en`)).json(),
    ).data;
    expect(final.team.badges[0]).toEqual({
      id: 'final-1',
      label: 'Season champions',
      desc: 'Finished 1st in Preseason',
    });
  });

  it('T-11-106: 랭킹은 lang=en을 받고(엄격한 쿼리), 엣지 캐시 키는 영어일 때만 lang이 붙어 둘로만 늘어난다', async () => {
    await team(1, 80);
    const edge = installFakeEdgeCache();
    try {
      const ko = (await rank()).data;
      const en = (await rank('?lang=en')).data;
      const odd = (await rank('?lang=zz')).data; // 모르는 값은 한국어 — 같은 키를 쓴다
      await flushEdge();
      expect(ko.seasons).toEqual([{ id: 0, name: '프리시즌' }]);
      expect(en.seasons).toEqual([{ id: 0, name: 'Preseason' }]);
      expect(odd.seasons).toEqual(ko.seasons);
      expect([...edge.store.keys()].sort()).toEqual([
        'http://localhost/v1/teams?season=0&sort=rating&page=1&form=5&logo=1',
        'http://localhost/v1/teams?season=0&sort=rating&page=1&form=5&logo=1&lang=en',
      ]);
      const ach = await call('GET', '/v1/achievements/ranking?lang=en');
      expect(ach.status).toBe(200);
      await flushEdge();
      expect([...edge.store.keys()].filter((k) => k.includes('achievements'))).toEqual([
        'http://localhost/v1/achievements/ranking?season=0&page=1&logo=1&lang=en',
      ]);
      // 팀을 저장하면 한국어·영어 키를 함께 지운다.
      edge.purged.length = 0;
      await team(1, 70);
      await flushEdge();
      const base = 'http://localhost/v1/teams?season=0&sort=rating&page=1&form=5&logo=1';
      expect(edge.purged).toEqual(expect.arrayContaining([base, `${base}&lang=en`]));
      expect(edge.store.has(base)).toBe(false);
      expect(edge.store.has(`${base}&lang=en`)).toBe(false);
    } finally {
      edge.uninstall();
    }
  });

  it('좋아요는 한 사람이 한 번(익명 프로필도), 내 팀은 누를 수 없고, 조회수는 부를 때마다 오른다', async () => {
    const a = await team(1, 80);
    const fan = await issueCookie(ctx);
    const like = (cookie: string, method = 'PUT') =>
      call(method, `/v1/teams/${a.team.id}/like`, { cookie });
    expect((await call('PUT', `/v1/teams/${a.team.id}/like`)).status).toBe(401);
    expect(LikeRes.parse(await (await like(fan.cookie)).json()).data).toEqual({
      liked: true,
      likes: 1,
    });
    expect(LikeRes.parse(await (await like(fan.cookie)).json()).data.likes).toBe(1);
    const own = await like(a.cookie);
    expect(own.status).toBe(409);
    expect(ErrorEnvelopeSchema.parse(await own.json()).error.details).toEqual({
      reason: 'OWN_TEAM',
    });
    expect((await profile(a.team.id, fan.cookie)).liked).toBe(true);

    expect((await call('POST', `/v1/teams/${a.team.id}/views`)).status).toBe(204);
    expect((await call('POST', `/v1/teams/${a.team.id}/views`)).status).toBe(204);
    expect((await profile(a.team.id)).team).toMatchObject({ likes: 1, views: 2 });
    expect((await call('POST', `/v1/teams/tem_${crypto.randomUUID()}/views`)).status).toBe(404);

    expect(LikeRes.parse(await (await like(fan.cookie, 'DELETE')).json()).data).toEqual({
      liked: false,
      likes: 0,
    });

    // 좋아요를 누른 사람이 프로필을 지우면 좋아요도 빠진다.
    const google = await issueGoogleCookie(ctx);
    await like(google.cookie);
    expect((await profile(a.team.id)).team.likes).toBe(1);
    expect((await deleteProfile(ctx.env, google.cookie, 'teams-like-del')).status).toBe(204);
    expect((await profile(a.team.id)).team.likes).toBe(0);
    expect(await ctx.db.select().from(teamLikes)).toEqual([]);
  });

  it('T-11-029: 끝난 시즌(프리시즌은 시즌 1 개막에 끝난다) 팀의 좋아요는 누르기도 거두기도 409로 거절한다', async () => {
    const a = await team(1, 80);
    const fan = await issueCookie(ctx);
    const like = (method: string) =>
      call(method, `/v1/teams/${a.team.id}/like`, { cookie: fan.cookie });
    expect((await like('PUT')).status).toBe(200); // 진행 중인 시즌에는 누를 수 있다.

    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1 — 프리시즌 팀은 닫혔다.
    for (const method of ['PUT', 'DELETE']) {
      const res = await like(method);
      expect(res.status).toBe(409);
      expect(ErrorEnvelopeSchema.parse(await res.json()).error.details).toEqual({
        reason: 'SEASON_CLOSED',
      });
    }
    // 좋아요는 굳은 채 그대로다.
    expect((await profile(a.team.id, fan.cookie)).team.likes).toBe(1);
    expect((await profile(a.team.id, fan.cookie)).liked).toBe(true);
  });
});
