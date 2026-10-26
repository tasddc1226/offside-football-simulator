import {
  CupMeResponseSchema,
  CupResponseSchema,
  CupHomeResponseSchema,
  ErrorEnvelopeSchema,
  successEnvelope,
} from '@offside/contracts';
import { planCup, planNextCup } from '@offside/contracts/cup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  balanceVersions,
  cards,
  careers,
  cupEntries,
  cupMatches,
  cupState,
  cups,
  notifications,
  ownerTeams,
  profiles,
} from '../db/schema.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';
import { installFakeEdgeCache, flushEdge } from '../test/edgeCache.js';
import { drawCup, runCup } from '../team/cup.js';
import { checkCupListing, cupChampionView, cupHomeView, recentCupFor } from './cup.js';

const MeRes = successEnvelope(CupMeResponseSchema);
const CupRes = successEnvelope(CupResponseSchema);
const CUP = planCup({ id: 's1-1', season: 1, edition: 1, opensOn: '2026-10-09', capacity: 64 });
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
      // T-11-290 우승 팝업: 마감(done_at)까지 끝난 대회의 우승 팀을 한 행으로(지금 팀 이름·구단주·로고).
      expect(await cupChampionView(ctx.db, CUP)).toEqual({
        cupId: CUP.id,
        season: CUP.season,
        edition: CUP.edition,
        teamId: entry.teamId,
        name: full.teams[0]!.name,
        owner: '김감독',
        logo: full.teams[0]!.logo,
        doneAt: CUP.drawAt,
      });
      await ctx.db.update(cupState).set({ doneAt: null });
      expect(await cupChampionView(ctx.db, CUP)).toBeNull();
      await ctx.db.update(cupState).set({ doneAt: CUP.drawAt });
      await ctx.db.update(cupState).set({ groups: 0 });
      expect((await cupHomeView(ctx.db, CUP, CUP.drawAt)).phase).toBe('cancelled');
    } finally {
      fake.uninstall();
    }
  });

  it('current cup reuses the shared cache without session reads, and entry writes invalidate it', async () => {
    const fake = installFakeEdgeCache();
    try {
      const a = await owner(8);
      await enter(a.cookie);
      const spy = spyDb(ctx.env.DB);
      const read = async () => {
        const res = await callJson({ ...ctx.env, DB: spy.DB }, 'GET', '/v1/cups/current', {
          cookie: a.cookie,
        });
        expect(res.status).toBe(200);
        return CupRes.parse(await res.json()).data;
      };
      expect((await read()).entries).toBe(1);
      expect(spy.seen.join(' ')).not.toMatch(/sessions|FROM .profiles./);
      await flushEdge();
      spy.seen.length = 0;
      expect((await read()).entries).toBe(1);
      expect(spy.seen).toEqual([]);
      await call('DELETE', `/v1/cups/${CUP.id}/entries/me`, { cookie: a.cookie });
      await flushEdge();
      expect((await read()).entries).toBe(0);
    } finally {
      fake.uninstall();
    }
  });

  it('T-11-290 우승 팝업 대회: 결승 뒤 일주일 안에 끝난 가장 최근 대회, 다음 대회 접수가 열려도 남는다', () => {
    // 제2회는 제1회 결승 10분 뒤 접수를 연다(T-11-251).
    const next = { ...planNextCup(CUP), id: 's1-2', season: 1 };
    const final = CUP.rounds.at(-1)!;
    const t = (ms: number) => new Date(Date.parse(final) + ms).toISOString();
    expect(recentCupFor(t(-1), [CUP, next])).toBeUndefined();
    expect(recentCupFor(t(0), [CUP, next])?.id).toBe('s1-1');
    // 제2회 접수가 열린 뒤에도(홈은 제2회를 보여 준다) 제1회 우승은 남는다.
    expect(recentCupFor(next.opensAt, [CUP, next])?.id).toBe('s1-1');
    expect(recentCupFor(t(7 * 86400_000 - 1), [next, CUP])?.id).toBe('s1-1');
    expect(recentCupFor(t(7 * 86400_000), [CUP, next])).toBeUndefined();
    // 둘 다 끝났으면 더 최근 것.
    const far = new Date(Date.parse(next.rounds.at(-1)!) + 60_000).toISOString();
    expect(recentCupFor(far, [CUP, next])?.id).toBe('s1-2');
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

  it('T-11-405 내 다음 경기 예상: 지금 두 팀 명단 기준 승 · 무 · 패 %, 상대가 없으면 null', async () => {
    const a = await owner(11);
    const b = await owner(8);
    await enter(a.cookie);
    await enter(b.cookie);
    const [ea, eb] = await Promise.all([me(a.cookie), me(b.cookie)]);
    await ctx.db.update(cupEntries).set({ grp: 1 }).where(eq(cupEntries.cupId, CUP.id));
    await ctx.db
      .insert(cupState)
      .values({ cupId: CUP.id, seed: 'test', groups: 1, drawnAt: CUP.drawAt });
    await ctx.db.insert(cupMatches).values({
      id: 'odds-g1',
      cupId: CUP.id,
      round: 'g1',
      grp: 1,
      slot: 0,
      at: CUP.rounds[0]!,
      homeTeamId: eb.entry!.teamId,
      awayTeamId: ea.entry!.teamId,
    });
    const strong = (await me(a.cookie)).nextOdds!;
    const weak = (await me(b.cookie)).nextOdds!;
    // 11명이 다 찬 팀이 유스 3명 섞인 팀보다 유리하고, 두 쪽에서 본 확률은 서로 뒤집힌다.
    expect(strong.win + strong.draw + strong.loss).toBe(100);
    expect(strong.win).toBeGreaterThan(strong.loss);
    expect(weak).toMatchObject({ win: strong.loss, loss: strong.win, draw: strong.draw });
    expect(weak.xg).toEqual({ mine: strong.xg.opp, opp: strong.xg.mine });
    // 상대가 아직 정해지지 않은 토너먼트 경기면 예상이 없다.
    await ctx.db.delete(cupMatches);
    await ctx.db.insert(cupMatches).values({
      id: 'odds-sf',
      cupId: CUP.id,
      round: 'sf',
      slot: 0,
      at: CUP.rounds[0]!,
      homeTeamId: ea.entry!.teamId,
    });
    expect(await me(a.cookie)).toMatchObject({ next: { id: 'odds-sf' }, nextOdds: null });
  });

  it('T-11-407 모든 경기 예상: 명단이 잠기면 cron이 한 번 계산해 두고, 끝난 경기에도 남는다', async () => {
    const a = await owner(11);
    const b = await owner(8);
    await enter(a.cookie);
    await enter(b.cookie);
    const [ea, eb] = await Promise.all([me(a.cookie), me(b.cookie)]);
    await ctx.db.update(cupEntries).set({ grp: 1 }).where(eq(cupEntries.cupId, CUP.id));
    await ctx.db
      .insert(cupState)
      .values({ cupId: CUP.id, seed: 'test', groups: 1, drawnAt: CUP.drawAt });
    const at = CUP.rounds[0]!;
    const row = (id: string, slot: number) => ({
      id,
      cupId: CUP.id,
      round: 'g1',
      grp: 1,
      slot,
      at,
      homeTeamId: eb.entry!.teamId,
      awayTeamId: ea.entry!.teamId,
    });
    await ctx.db.insert(cupMatches).values([row('all-1', 0), row('all-2', 1)]);
    const matches = async () =>
      CupRes.parse(await (await call('GET', `/v1/cups/${CUP.id}`)).json()).data.matches;
    const lock = Date.parse(at) - 60 * 60_000;
    // 잠기기 전에는 계산하지 않는다(내 경기 칸은 지금 명단으로 따로 계산한다).
    await runCup(ctx.db, new Date(lock - 60_000).toISOString(), [CUP]);
    expect((await matches()).map((m) => m.odds)).toEqual([null, null]);
    // 잠긴 뒤 cron: 두 경기 모두 홈 기준으로 채우고, 내 경기 칸과 같은 값이다.
    const log = await runCup(ctx.db, new Date(lock).toISOString(), [CUP]);
    expect(log).toContainEqual({ cup: CUP.id, step: 'odds', n: 2 });
    const [first] = await matches();
    const odds = first!.odds!;
    expect(odds.home + odds.draw + odds.away).toBe(100);
    expect(odds.away).toBeGreaterThan(odds.home);
    const weak = (await me(b.cookie)).nextOdds!;
    expect(weak).toMatchObject({ win: odds.home, draw: odds.draw, loss: odds.away });
    // 다음 cron은 다시 계산하지 않는다.
    expect(await runCup(ctx.db, new Date(lock + 5 * 60_000).toISOString(), [CUP])).toBeNull();
    // 저장해 둔 값이 있으면 내 경기 칸도 그 값을 쓴다(명단이 잠겨 같은 값이어야 한다).
    await ctx.db
      .update(cupMatches)
      .set({ oddsJson: JSON.stringify({ h: 10, d: 20, a: 70, xh: 0.5, xa: 2.1 }) })
      .where(eq(cupMatches.id, 'all-1'));
    expect((await me(a.cookie)).nextOdds).toEqual({
      win: 70,
      draw: 20,
      loss: 10,
      xg: { mine: 2.1, opp: 0.5 },
    });
    // cron이 늦어 예상 없이 경기 시각이 되면 경기를 치르면서 채운다.
    await ctx.db.update(cupMatches).set({ oddsJson: null }).where(eq(cupMatches.id, 'all-2'));
    await runCup(ctx.db, at, [CUP]);
    const played = await matches();
    expect(played.every((m) => m.played)).toBe(true);
    expect(played[0]!.odds).toEqual({ home: 10, draw: 20, away: 70 });
    expect(played[1]!.odds).toEqual(odds);
  });

  it('T-11-409 컵 공격 계수는 밸런스 설정을 따르고, 경기 전 예상 · 내 경기 칸이 같은 값을 쓴다', async () => {
    const a = await owner(11);
    const b = await owner(8);
    await enter(a.cookie);
    await enter(b.cookie);
    const [ea, eb] = await Promise.all([me(a.cookie), me(b.cookie)]);
    await ctx.db.update(cupEntries).set({ grp: 1 }).where(eq(cupEntries.cupId, CUP.id));
    await ctx.db
      .insert(cupState)
      .values({ cupId: CUP.id, seed: 'test', groups: 1, drawnAt: CUP.drawAt });
    const at = CUP.rounds[0]!;
    await ctx.db.insert(cupMatches).values({
      id: 'k-1',
      cupId: CUP.id,
      round: 'g1',
      grp: 1,
      slot: 0,
      at,
      homeTeamId: eb.entry!.teamId,
      awayTeamId: ea.entry!.teamId,
    });
    const lock = new Date(Date.parse(at) - 60 * 60_000).toISOString();
    const odds = async () => {
      await ctx.db.update(cupMatches).set({ oddsJson: null }).where(eq(cupMatches.id, 'k-1'));
      const live = (await me(b.cookie)).nextOdds!;
      await runCup(ctx.db, lock, [CUP]);
      const stored = CupRes.parse(await (await call('GET', `/v1/cups/${CUP.id}`)).json()).data
        .matches[0]!.odds!;
      expect(live).toMatchObject({ win: stored.home, draw: stored.draw, loss: stored.away });
      return stored;
    };
    // 기본값 0.45가 2회 컵까지의 0.3보다 강한 팀(원정) 승률을 높인다.
    const strong = await odds();
    await ctx.db.insert(balanceVersions).values({
      status: 'active',
      valuesJson: JSON.stringify({ cupAtkK: 0.3 }),
      createdBy: 'test',
      createdAt: lock,
      updatedAt: lock,
      activatedAt: lock,
    });
    const old = await odds();
    expect(strong.away).toBeGreaterThan(old.away);
    expect(strong.home).toBeLessThan(old.home);
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

  // T-11-322 owner_teams를 IN (...) 한 번으로 읽어 101팀부터 D1 바인딩 한도(100)를 넘겨 503이 났다.
  it.each([100, 101, 128])('신청 팀이 %i팀이어도 현재 대회에 팀이 빠짐없이 나온다', async (n) => {
    const at = OPEN;
    // 시드도 바인딩 한도에 걸리지 않게 한 줄씩 넣는다(한 batch).
    const rows = Array.from({ length: n }, (_, k) => [
      ctx.db
        .insert(profiles)
        .values({ id: `prf_many_${k}`, settingsJson: '{}', createdAt: at, lastSeenAt: at }),
      ctx.db.insert(ownerTeams).values({
        id: `tem_many_${k}`,
        profileId: `prf_many_${k}`,
        season: CUP.season,
        name: `지금팀${k}`,
        manager: `감독${k}`,
        formation: '4-3-3',
        slotsJson: '[]',
        filled: 11,
        ovr: 70,
        createdAt: at,
        updatedAt: at,
      }),
      ctx.db.insert(cupEntries).values({
        cupId: CUP.id,
        teamId: `tem_many_${k}`,
        profileId: `prf_many_${k}`,
        name: `신청팀${k}`,
        manager: '감독',
        ovr: 60,
        createdAt: at,
        updatedAt: at,
      }),
    ]).flat();
    await ctx.db.batch(rows as [(typeof rows)[number], ...typeof rows]);
    const res = await call('GET', '/v1/cups/current');
    expect(res.status).toBe(200);
    const cur = CupRes.parse(await res.json()).data;
    expect(cur.entries).toBe(n);
    expect(cur.teams.map((t) => t.teamId).sort()).toEqual(
      Array.from({ length: n }, (_, k) => `tem_many_${k}`).sort(),
    );
    // 신청 때 값이 아니라 지금 팀으로 읽혔다 = 모든 팀을 owner_teams에서 찾았다.
    expect(cur.teams.every((t) => t.name.startsWith('지금팀') && t.ovr === 70)).toBe(true);
    if (n !== 128) return;
    // 조 추첨(정원 128)도 바인딩 없이 참가 표와 이어 읽고, 추첨 뒤 화면에도 128팀이 모두 나온다.
    await drawCup(ctx.db, { ...CUP, capacity: 128 }, CUP.drawAt);
    const drawn = CupRes.parse(await (await call('GET', '/v1/cups/current')).json()).data;
    expect(drawn.groups).toHaveLength(32);
    expect(drawn.teams).toHaveLength(128);
    expect(drawn.teams.every((t) => t.name.startsWith('지금팀'))).toBe(true);
  });
});
