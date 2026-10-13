import {
  CupMeResponseSchema,
  CupResponseSchema,
  CupHomeResponseSchema,
  ErrorEnvelopeSchema,
  successEnvelope,
} from '@offside/contracts';
import { planCup } from '@offside/contracts/cup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  cards,
  careers,
  cupEntries,
  cupMatches,
  cupState,
  cups,
  notifications,
  profiles,
} from '../db/schema.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
import { installFakeEdgeCache, flushEdge } from '../test/edgeCache.js';
import { checkCupListing, cupHomeView } from './cup.js';

const MeRes = successEnvelope(CupMeResponseSchema);
const CupRes = successEnvelope(CupResponseSchema);
const CUP = planCup({ id: 's1-1', season: 1, edition: 1, opensOn: '2026-10-09' });
const OPEN = '2026-10-10T03:00:00.000Z';
let seq = 0;

describe('/v1/cups (T-11-145 오프사이드 컵 신청)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(OPEN));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const idem = () => ({ 'Idempotency-Key': `cup-entry-${++seq}-key` });
  const enter = (cookie: string) =>
    call('POST', `/v1/cups/${CUP.id}/entries`, { cookie, headers: idem() });
  const me = async (cookie: string) =>
    MeRes.parse(await (await call('GET', `/v1/cups/${CUP.id}/me`, { cookie })).json()).data;
  const reason = async (res: Response) =>
    (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)
      ?.reason;

  /** 시즌 1 카드 n장으로 선발을 채운 구단주. */
  async function owner(n: number) {
    const who = await issueGoogleCookie(ctx, { nickname: `컵${++seq}` });
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = crypto.randomUUID();
      const at = '2026-10-06T00:00:00.000Z';
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
        createdAt: at,
        updatedAt: at,
        retiredAt: at,
        retireAge: 34,
        peak: 80,
        legendScore: 300,
        shirtNumber: 9,
        serviceSeason: 1,
      });
      await ctx.db.insert(cards).values({
        careerId: id,
        ownerId: who.profileId,
        serviceSeason: 1,
        pos: 'FW',
        number: 9,
        peak: 80,
        legendScore: 300,
        retireValue: 0,
        createdAt: at,
        updatedAt: at,
      });
      ids.push(id);
    }
    const slots = [...ids, ...Array(11 - n).fill(null)];
    const put = (s: (string | null)[]) =>
      call('PUT', '/v1/owner-team', {
        cookie: who.cookie,
        body: { name: `컵팀${seq}`, manager: '김감독', formation: '4-3-3', slots: s },
      });
    expect((await put(slots)).status).toBe(200);
    return { ...who, ids, put };
  }

  it('home summary matches each public phase and caches without session/logos/details', async () => {
    const fake = installFakeEdgeCache();
    try {
      const a = await owner(8);
      await enter(a.cookie);
      const spy = spyDb(ctx.env.DB);
      const read = async () => {
        const res = await callJson({ ...ctx.env, DB: spy.DB }, 'GET', '/v1/cups/home');
        expect(res.status).toBe(200);
        return successEnvelope(CupHomeResponseSchema).parse(await res.json()).data;
      };
      const first = await read();
      expect(first).toMatchObject({ phase: 'open', entries: 1, teamCount: 1 });
      expect(JSON.stringify(first).length).toBeLessThan(2500);
      expect(spy.seen.join(' ')).not.toMatch(/sessions|detail_json|logo_json/);
      await flushEdge();
      spy.seen.length = 0;
      expect(await read()).toEqual(first);
      expect(spy.seen).toEqual([]);
      await call('DELETE', `/v1/cups/${CUP.id}/entries/me`, { cookie: a.cookie, headers: idem() });
      await flushEdge();
      expect((await read()).entries).toBe(0);
      await enter(a.cookie);
      await ctx.db.update(cupEntries).set({ grp: 1 }).where(eq(cupEntries.cupId, CUP.id));
      for (const [at, phase] of [
        [new Date(Date.parse(CUP.opensAt) - 1).toISOString(), 'soon'],
        [CUP.closesAt, 'closed'],
      ] as const)
        expect((await cupHomeView(ctx.db, CUP, at)).phase).toBe(phase);
      await ctx.db
        .insert(cupState)
        .values({ cupId: CUP.id, seed: 'test', groups: 1, drawnAt: CUP.drawAt });
      expect((await cupHomeView(ctx.db, CUP, CUP.drawAt)).phase).toBe('group');
      const entry = (await ctx.db.select().from(cupEntries))[0]!;
      await ctx.db.insert(cupMatches).values({
        id: 'home-final',
        cupId: CUP.id,
        round: 'f',
        slot: 0,
        at: CUP.drawAt,
        homeTeamId: entry.teamId,
      });
      expect(await cupHomeView(ctx.db, CUP, CUP.drawAt)).toMatchObject({
        phase: 'knockout',
        round: 'f',
        teamCount: 1,
      });
      await ctx.db.update(cupMatches).set({ playedAt: CUP.drawAt, winnerTeamId: entry.teamId });
      await ctx.db.update(cupState).set({ doneAt: CUP.drawAt });
      const full = CupRes.parse(await (await call('GET', `/v1/cups/${CUP.id}`)).json()).data;
      const summary = await cupHomeView(ctx.db, CUP, CUP.drawAt);
      expect(summary).toMatchObject({ phase: 'done', championName: full.teams[0]!.name });
      await ctx.db.update(cupState).set({ groups: 0 });
      expect((await cupHomeView(ctx.db, CUP, CUP.drawAt)).phase).toBe('cancelled');
    } finally {
      fake.uninstall();
    }
  });

  it('선발 8명 이상이면 신청·취소·다시 신청할 수 있다', async () => {
    const a = await owner(8);
    expect((await me(a.cookie)).eligibility).toMatchObject({ ok: true, filled: 8 });
    expect((await enter(a.cookie)).status).toBe(204);
    // 두 번 눌러도 한 번만 들어간다.
    expect((await enter(a.cookie)).status).toBe(204);
    expect((await me(a.cookie)).entry).toMatchObject({ status: 'active' });
    // T-11-160 추첨 전에도 신청한 팀을 누구나 본다(취소한 팀은 빠진다).
    const view = async () =>
      CupRes.parse(await (await call('GET', `/v1/cups/${CUP.id}`)).json()).data;
    const entered = await view();
    expect(entered.teams).toHaveLength(1);
    expect(entered.teams[0]!.teamId).toBe((await me(a.cookie)).entry!.teamId);
    const del = await call('DELETE', `/v1/cups/${CUP.id}/entries/me`, { cookie: a.cookie });
    expect(del.status).toBe(204);
    expect((await view()).teams).toHaveLength(0);
    expect(await me(a.cookie)).toMatchObject({
      entry: { status: 'withdrawn' },
      eligibility: { ok: true },
    });
    expect((await enter(a.cookie)).status).toBe(204);
    expect(await ctx.db.select().from(cupEntries)).toHaveLength(1);
  });

  it('T-11-228 신청 뒤 팀 이름·감독·선발을 바꾸면 대회 화면에도 지금 팀으로 보인다', async () => {
    const a = await owner(9);
    const save = (name: string, manager: string, slots: (string | null)[]) =>
      call('PUT', '/v1/owner-team', {
        cookie: a.cookie,
        body: { name, manager, formation: '4-3-3', slots },
      });
    expect(
      (await save('처음 이름', '김감독', [...a.ids.slice(0, 8), null, null, null])).status,
    ).toBe(200);
    expect((await enter(a.cookie)).status).toBe(204);
    const [entry] = await ctx.db.select().from(cupEntries);
    expect((await save('바꾼 이름', '박감독', [...a.ids, null, null])).status).toBe(200);
    const view = CupRes.parse(await (await call('GET', `/v1/cups/${CUP.id}`)).json()).data;
    expect(view.teams[0]).toMatchObject({ name: '바꾼 이름', owner: '박감독' });
    expect(view.teams[0]!.ovr).toBeGreaterThan(entry!.ovr);
    // 조 추첨 기준인 신청 기록은 그대로 둔다.
    expect((await ctx.db.select().from(cupEntries))[0]).toMatchObject({
      name: '처음 이름',
      ovr: entry!.ovr,
    });
  });

  it('선발 7명이면 신청할 수 없다', async () => {
    const a = await owner(7);
    expect((await me(a.cookie)).eligibility).toMatchObject({ ok: false, reason: 'not-enough' });
    const res = await enter(a.cookie);
    expect(res.status).toBe(409);
    expect(await reason(res)).toBe('CUP_NOT_ENOUGH');
  });

  it('접수 전·후에는 신청할 수 없다', async () => {
    const a = await owner(8);
    vi.setSystemTime(new Date(Date.parse(CUP.opensAt) - 1000));
    expect(await reason(await enter(a.cookie))).toBe('CUP_CLOSED');
    vi.setSystemTime(new Date(CUP.closesAt));
    expect(await reason(await enter(a.cookie))).toBe('CUP_CLOSED');
  });

  it('영어 요청이면 오류를 영어로 돌려준다', async () => {
    const a = await owner(7);
    const res = await call('POST', `/v1/cups/${CUP.id}/entries?lang=en`, {
      cookie: a.cookie,
      headers: idem(),
    });
    expect(ErrorEnvelopeSchema.parse(await res.json()).error.message).toBe(
      'You need at least 8 of your retired players in your starting XI.',
    );
  });

  it('정원이 차면 신청할 수 없다', async () => {
    for (let i = 0; i < CUP.capacity; i++) {
      const profileId = `prf_full_${i}`;
      await ctx.db
        .insert(profiles)
        .values({ id: profileId, settingsJson: '{}', createdAt: OPEN, lastSeenAt: OPEN });
      await ctx.db.insert(cupEntries).values({
        cupId: CUP.id,
        teamId: `tem_full_${i}`,
        profileId,
        name: `팀${i}`,
        manager: '감독',
        ovr: 60,
        createdAt: OPEN,
        updatedAt: OPEN,
      });
    }
    const a = await owner(8);
    expect((await me(a.cookie)).eligibility).toMatchObject({ ok: false, reason: 'full' });
    expect(await reason(await enter(a.cookie))).toBe('CUP_FULL');
  });

  it('마지막 자리가 차면 접수를 닫고 일정을 당긴 뒤 신청한 구단주에게 알린다', async () => {
    const first = await owner(8);
    expect((await enter(first.cookie)).status).toBe(204);
    for (let i = 1; i < CUP.capacity - 1; i++) {
      const profileId = `prf_fill_${i}`;
      await ctx.db
        .insert(profiles)
        .values({ id: profileId, settingsJson: '{}', createdAt: OPEN, lastSeenAt: OPEN });
      await ctx.db.insert(cupEntries).values({
        cupId: CUP.id,
        teamId: `tem_fill_${i}`,
        profileId,
        name: `팀${i}`,
        manager: '감독',
        ovr: 60,
        createdAt: OPEN,
        updatedAt: OPEN,
      });
    }
    const last = await owner(8);
    expect((await enter(last.cookie)).status).toBe(204);
    // OPEN = 10/10 12:00 KST → 12시간 뒤 첫 추첨 시각은 10/11 12:00(2일 당김).
    const [row] = await ctx.db.select().from(cups).where(eq(cups.id, CUP.id));
    expect(row).toMatchObject({ closesAt: OPEN, drawAt: '2026-10-11T03:00:00.000Z' });
    expect(JSON.parse(row!.roundsJson)[0]).toBe('2026-10-11T12:00:00.000Z');
    const cur = CupRes.parse(await (await call('GET', '/v1/cups/current')).json()).data;
    expect(cur.cup.drawAt).toBe('2026-10-11T03:00:00.000Z');
    const sent = await ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.sourceKey, `cup:${CUP.id}:early`));
    expect(sent).toHaveLength(CUP.capacity);
    expect(sent.find((n) => n.profileId === first.profileId)?.body).toBe(
      '조 추첨 10/11 12:00, 첫 경기 10/11 21:00(한국 시간)에 열려요.',
    );
    // 접수가 닫혀 취소·추가 신청은 안 된다.
    const del = await call('DELETE', `/v1/cups/${CUP.id}/entries/me`, { cookie: first.cookie });
    expect(await reason(del)).toBe('CUP_CLOSED');
  });

  it('참가 중에는 선발을 8명 밑으로 줄이거나 선발 선수를 내놓을 수 없다', async () => {
    const a = await owner(8);
    expect((await enter(a.cookie)).status).toBe(204);
    const fewer = await a.put([...a.ids.slice(0, 7), ...Array(4).fill(null)]);
    expect(fewer.status).toBe(409);
    expect(await reason(fewer)).toBe('CUP_MIN_FILLED');
    await expect(checkCupListing(ctx.db, a.profileId, 1, a.ids[0]!)).rejects.toMatchObject({
      details: { reason: 'CUP_CARD_LOCKED' },
    });
    // 취소하면 풀린다.
    await call('DELETE', `/v1/cups/${CUP.id}/entries/me`, { cookie: a.cookie });
    await expect(checkCupListing(ctx.db, a.profileId, 1, a.ids[0]!)).resolves.toBeUndefined();
    expect((await a.put([...a.ids.slice(0, 7), ...Array(4).fill(null)])).status).toBe(200);
  });
});
