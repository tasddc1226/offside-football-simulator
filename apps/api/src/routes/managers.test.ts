import {
  ErrorEnvelopeSchema,
  ManagerCareerResponseSchema,
  ManagersResponseSchema,
  OwnerTeamResponseSchema,
  successEnvelope,
  type ManagerResult,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cards, careerSeasons, careers, marketListings } from '../db/schema.js';
import { createTestD1, syncCards, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie, issueCookie } from '../test/http.js';
import { createDb } from '../db/client.js';
import { managerOriginOf, startManagerCareer } from '../db/repos/managers.js';

const ListRes = successEnvelope(ManagersResponseSchema);
const CareerRes = successEnvelope(ManagerCareerResponseSchema);
const TeamRes = successEnvelope(OwnerTeamResponseSchema);

const RESULT: ManagerResult = {
  mastery: { '4-3-3': 'S', '4-4-2': 'B', '3-5-2': 'C' },
  style: 'attack',
  specials: ['wing'],
  grade: 'A',
  ending: 'promoter',
  seasons: 9,
  titles: 1,
  cups: 0,
  promotions: 2,
  sacked: 0,
  clubs: 2,
  topLeague: 'k1',
  wins: 150,
  draws: 80,
  losses: 90,
};

let seq = 0;

describe('감독 커리어 (T-11-310)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z'));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const idem = () => ({ 'Idempotency-Key': `manager-${++seq}-key` });
  const reason = async (res: Response) =>
    (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)
      ?.reason;

  async function addCard(profileId: string, seasons = 3) {
    const id = crypto.randomUUID();
    const now = '2026-09-28T00:00:00.000Z';
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: 'MF',
      dpos: 'CM',
      foot: '오른발',
      type: 'maker',
      trait: 'late',
      startYear: 2026,
      status: 'retired',
      appVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
      retiredAt: now,
      retireAge: 35,
      peak: 86,
      legendScore: 600,
      apps: 400,
      trophies: 5,
      caps: 40,
      shirtNumber: 8,
      serviceSeason: 0,
      value: 3_000_000,
    });
    for (let i = 0; i < seasons; i++)
      await ctx.db.insert(careerSeasons).values({
        careerId: id,
        year: 2030 + i,
        age: 25 + i,
        club: i === 0 ? '울산' : '전북',
        clubId: i === 0 ? 'k1-0' : 'k1-1',
        league: 'K리그1',
        apps: 30,
        goals: 3,
        assists: 5,
        rating: 7,
        rank: '1',
        ovr: 80,
        honorsJson: '[]',
        mil: 0,
        eventsJson: '[]',
        createdAt: now,
      });
    await syncCards(ctx, 1_000_000);
    return id;
  }
  const managers = async (cookie: string) =>
    ListRes.parse(await (await call('GET', '/v1/managers', { cookie })).json()).data;
  const start = (cookie: string, careerId: string) =>
    call('POST', '/v1/managers', { cookie, headers: idem(), body: { careerId } });
  const putTeam = (cookie: string, slots: (string | null)[], coach?: string | null) =>
    call('PUT', '/v1/owner-team', {
      cookie,
      body: {
        name: '우리 FC',
        manager: '김감독',
        formation: '4-3-3',
        slots,
        ...(coach !== undefined ? { coach } : {}),
      },
    });
  const team = async (cookie: string) =>
    TeamRes.parse(await (await call('GET', '/v1/owner-team', { cookie })).json()).data;

  it('구글 로그인한 구단주만 쓴다', async () => {
    expect((await call('GET', '/v1/managers')).status).toBe(401);
    const anon = await issueCookie(ctx);
    expect((await call('GET', '/v1/managers', { cookie: anon.cookie })).status).toBe(403);
  });

  it('recovers a lost connection before or after commit without duplicating a manager or leaving its listing open', async () => {
    for (const loseAfterCommit of [false, true]) {
      const owner = await issueGoogleCookie(ctx);
      const careerId = await addCard(owner.profileId);
      expect(
        (
          await call('POST', '/v1/market/listings', {
            cookie: owner.cookie,
            headers: idem(),
            body: { careerId, price: 1_000_000 },
          })
        ).status,
      ).toBe(201);
      const origin = (await managerOriginOf(ctx.db, careerId))!;
      let calls = 0;
      const DB = new Proxy(ctx.env.DB, {
        get(target, key) {
          if (key === 'batch')
            return async (...args: Parameters<D1Database['batch']>) => {
              calls++;
              if (calls === 1 && !loseAfterCommit)
                throw new Error('D1_ERROR: Network connection lost.');
              const result = await target.batch(...args);
              if (calls === 1) throw new Error('D1_ERROR: Network connection lost.');
              return result;
            };
          const v = Reflect.get(target, key);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
      const id = await startManagerCareer(createDb(DB), {
        profileId: owner.profileId,
        careerId,
        seed: 123,
        origin,
        now: new Date().toISOString(),
      });
      expect(id).toEqual(expect.any(String));
      expect(calls).toBe(2);
      expect(
        await ctx.env.DB.prepare('SELECT count(*) n FROM manager_careers WHERE profile_id=?')
          .bind(owner.profileId)
          .first(),
      ).toEqual({ n: 1 });
      expect(
        await ctx.env.DB.prepare('SELECT id FROM manager_careers WHERE profile_id=?')
          .bind(owner.profileId)
          .first(),
      ).toEqual({ id });
      expect(
        await ctx.env.DB.prepare('SELECT manager FROM cards WHERE career_id=?')
          .bind(careerId)
          .first(),
      ).toEqual({ manager: 1 });
      expect(
        await ctx.env.DB.prepare('SELECT status FROM market_listings WHERE career_id=?')
          .bind(careerId)
          .first(),
      ).toEqual({ status: 'cancelled' });
    }
  });

  it('시작하면 카드가 감독으로 분류돼 선발 · 판매 · 잠금에서 빠지고, 진행 중 커리어는 하나뿐이다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const a = await addCard(owner.profileId);
    const b = await addCard(owner.profileId);
    expect((await putTeam(owner.cookie, [...Array(9).fill(null), a, b])).status).toBe(200);
    const listed = await call('POST', '/v1/market/listings', {
      cookie: owner.cookie,
      headers: idem(),
      body: { careerId: a, price: 1_000_000 },
    });
    expect(listed.status).toBe(201);

    const before = await managers(owner.cookie);
    expect(before.active).toBeNull();
    expect(before.candidates.find((x) => x.careerId === a)).toMatchObject({
      inLineup: true,
      listed: true,
      cardValue: 1_000_000,
    });

    const res = await start(owner.cookie, a);
    expect(res.status).toBe(201);
    const { career } = CareerRes.parse(await res.json()).data;
    expect(career).toMatchObject({ careerId: a, status: 'active', result: null });
    // 선수 시절 기록이 시작값 재료가 된다(시즌 3 · 구단 2).
    expect(career.origin).toMatchObject({ pos: 'MF', seasons: 3, clubs: 2, trophies: 5, caps: 40 });

    const t = await team(owner.cookie);
    expect(t.team!.slots[9]!.careerId).toBeNull();
    expect(t.team!.slots[10]!.careerId).toBe(b);
    expect(t.players.map((p) => p.careerId)).toEqual([b]);
    const [card] = await ctx.db.select().from(cards).where(eq(cards.careerId, a));
    expect(card!.manager).toBe(true);
    const [l] = await ctx.db.select().from(marketListings).where(eq(marketListings.careerId, a));
    expect(l!.status).toBe('cancelled');

    const relist = await call('POST', '/v1/market/listings', {
      cookie: owner.cookie,
      headers: idem(),
      body: { careerId: a, price: 1_000_000 },
    });
    expect(await reason(relist)).toBe('CARD_MANAGER');
    const lock = await call('POST', '/v1/cards/lock', {
      cookie: owner.cookie,
      body: { careerId: a, locked: true },
    });
    expect(await reason(lock)).toBe('CARD_MANAGER');
    expect(await reason(await putTeam(owner.cookie, [...Array(10).fill(null), a]))).toBe(
      'PLAYER_NOT_ELIGIBLE',
    );

    const second = await start(owner.cookie, b);
    expect(second.status).toBe(409);
    expect(await reason(second)).toBe('MANAGER_ACTIVE');
    expect(await reason(await start(owner.cookie, a))).toBe('CARD_MANAGER');
    expect((await managers(owner.cookie)).active?.careerId).toBe(a);
  });

  it('남의 카드는 감독으로 만들 수 없다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const a = await addCard(other.profileId);
    expect(await reason(await start(owner.cookie, a))).toBe('CARD_NOT_FOUND');
  });

  it('포기하면 원래 선수로 돌아오고 선발에는 다시 넣지 않는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const a = await addCard(owner.profileId);
    await putTeam(owner.cookie, [...Array(10).fill(null), a]);
    const { career } = CareerRes.parse(await (await start(owner.cookie, a)).json()).data;
    const res = await call('POST', `/v1/managers/${career.id}/abandon`, { cookie: owner.cookie });
    expect(res.status).toBe(204);
    const t = await team(owner.cookie);
    expect(t.players.map((p) => p.careerId)).toEqual([a]);
    expect(t.team!.slots[10]!.careerId).toBeNull();
    expect((await managers(owner.cookie)).active).toBeNull();
    expect(
      (await call('POST', `/v1/managers/${career.id}/abandon`, { cookie: owner.cookie })).status,
    ).toBe(404);
  });

  it('끝내면 감독 카드가 되고, 감독 칸에 넣을 수 있으며, 다른 선수로 새 커리어를 시작한다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const a = await addCard(owner.profileId);
    const b = await addCard(owner.profileId);
    const { career } = CareerRes.parse(await (await start(owner.cookie, a)).json()).data;
    // 끝내기 전에는 감독 칸에 넣을 수 없다.
    expect(await reason(await putTeam(owner.cookie, Array(11).fill(null), a))).toBe(
      'COACH_NOT_ELIGIBLE',
    );
    const finish = () =>
      call('POST', `/v1/managers/${career.id}/finish`, {
        cookie: owner.cookie,
        headers: idem(),
        body: { result: RESULT },
      });
    const done = await finish();
    expect(done.status).toBe(200);
    expect(CareerRes.parse(await done.json()).data.career).toMatchObject({
      status: 'done',
      result: RESULT,
    });
    // 재시도는 그대로 돌려준다.
    expect((await finish()).status).toBe(200);

    const list = await managers(owner.cookie);
    expect(list.active).toBeNull();
    expect(list.managers.map((m) => m.careerId)).toEqual([a]);
    expect(list.candidates.map((c) => c.careerId)).toEqual([b]);

    expect((await putTeam(owner.cookie, [...Array(10).fill(null), b], a)).status).toBe(200);
    expect((await team(owner.cookie)).team!.coach).toMatchObject({
      careerId: a,
      style: 'attack',
      grade: 'A',
    });
    // coach를 보내지 않는 옛 클라이언트 저장은 감독 칸을 그대로 둔다.
    await putTeam(owner.cookie, [...Array(10).fill(null), b]);
    expect((await team(owner.cookie)).team!.coach?.careerId).toBe(a);
    await putTeam(owner.cookie, [...Array(10).fill(null), b], null);
    expect((await team(owner.cookie)).team!.coach).toBeNull();

    expect((await start(owner.cookie, b)).status).toBe(201);
  });

  it('감독 칸만 바꾸는 요청은 팀이 있어야 하고, 끝낸 내 감독만 받는다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const a = await addCard(owner.profileId);
    const theirs = await addCard(other.profileId);
    const { career } = CareerRes.parse(await (await start(owner.cookie, a)).json()).data;
    await call('POST', `/v1/managers/${career.id}/finish`, {
      cookie: owner.cookie,
      headers: idem(),
      body: { result: RESULT },
    });
    const setCoach = (cookie: string, coach: string | null) =>
      call('PUT', '/v1/owner-team/coach', { cookie, body: { coach } });
    expect(await reason(await setCoach(owner.cookie, a))).toBe('TEAM_REQUIRED');
    await putTeam(owner.cookie, Array(11).fill(null));
    expect(await reason(await setCoach(owner.cookie, theirs))).toBe('COACH_NOT_ELIGIBLE');
    const set = await setCoach(owner.cookie, a);
    expect(set.status).toBe(200);
    const mine = (await team(owner.cookie)).team!;
    expect(mine.coach?.careerId).toBe(a);
    // T-11-335 다른 구단주가 내 팀 프로필을 열면 앉힌 감독이 보인다.
    const profile = async (cookie?: string) =>
      (
        (await (await call('GET', `/v1/teams/${mine.id}`, cookie ? { cookie } : {})).json()) as {
          data: { team: { coach: { careerId: string; style: string } | null } };
        }
      ).data.team.coach;
    expect(await profile(other.cookie)).toMatchObject({ careerId: a, style: 'attack' });
    expect(await profile()).toMatchObject({ careerId: a });
    // 다른 구단주는 내 감독을 앉힐 수 없다.
    await putTeam(other.cookie, Array(11).fill(null));
    expect(await reason(await setCoach(other.cookie, a))).toBe('COACH_NOT_ELIGIBLE');
    expect((await setCoach(owner.cookie, null)).status).toBe(200);
    expect((await team(owner.cookie)).team!.coach).toBeNull();
    expect(await profile(other.cookie)).toBeNull();
  });

  it('끝낸 결과는 범위를 검사한다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const a = await addCard(owner.profileId);
    const { career } = CareerRes.parse(await (await start(owner.cookie, a)).json()).data;
    const res = await call('POST', `/v1/managers/${career.id}/finish`, {
      cookie: owner.cookie,
      headers: idem(),
      body: { result: { ...RESULT, seasons: 30 } },
    });
    expect(res.status).toBe(400);
  });
});
