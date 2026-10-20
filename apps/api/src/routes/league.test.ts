import {
  ErrorEnvelopeSchema,
  LeagueMeResponseSchema,
  LeagueResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { eq } from 'drizzle-orm';
import { closeSeasonSchedule, applySeasonSchedule } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { cards, careers, leagueSeasons, ownerTeams } from '../db/schema.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie } from '../test/http.js';

// T-11-418 오프사이드 리그 1차: 일정 · 신청 · 취소 · 자격.

const MeRes = successEnvelope(LeagueMeResponseSchema);
const LeagueRes = successEnvelope(LeagueResponseSchema);
// 시즌 1은 10/31 00:00(KST)에 끝나고 시즌 2가 바로 연다.
const S2 = '2026-10-30T15:00:00.000Z';
const BEFORE = '2026-10-22T03:00:00.000Z';
const PRESIGN = '2026-10-29T03:00:00.000Z';
const OPEN = '2026-11-01T03:00:00.000Z';
const CLOSED = '2026-11-04T15:30:00.000Z';
let seq = 0;

describe('/v1/leagues (T-11-418)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(OPEN));
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(1, S2, false));
  });
  afterEach(async () => {
    vi.useRealTimers();
    applySeasonSchedule([]);
    forgetSeasonSchedule();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const idem = () => ({ 'Idempotency-Key': `league-${++seq}-key` });
  const reason = async (res: Response) =>
    (ErrorEnvelopeSchema.parse(await res.json()).error.details as { reason?: string } | undefined)
      ?.reason;
  const me = async (cookie: string) =>
    MeRes.parse(await (await call('GET', '/v1/leagues/current/me', { cookie })).json()).data;
  const view = async () =>
    LeagueRes.parse(await (await call('GET', '/v1/leagues/current')).json()).data;
  const enter = (cookie: string) =>
    call('POST', '/v1/leagues/current/entries', { cookie, headers: idem() });

  /** 시즌 2 카드 n장으로 선발을 채운 구단주(n이 null이면 팀 없음). */
  async function owner(n: number | null) {
    const who = await issueGoogleCookie(ctx, { nickname: `리그${++seq}` });
    if (n === null) return who;
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = crypto.randomUUID();
      const at = '2026-10-31T00:00:00.000Z';
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
        serviceSeason: 2,
      });
      await ctx.db.insert(cards).values({
        careerId: id,
        ownerId: who.profileId,
        serviceSeason: 2,
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
    const res = await call('PUT', '/v1/owner-team', {
      cookie: who.cookie,
      body: {
        name: `리그팀${seq}`,
        manager: '김감독',
        formation: '4-3-3',
        slots: [...ids, ...Array(11 - n).fill(null)],
      },
    });
    expect(res.status).toBe(200);
    return who;
  }

  it('시즌 2 개막으로 기본 일정을 만든다: 개막 7일 전 사전 신청, 개막 뒤 5일, 배치 09:00, 14라운드 13:00(KST)', async () => {
    vi.setSystemTime(new Date(BEFORE));
    const soon = await view();
    expect(soon.phase).toBe('soon');
    expect(soon.league).toMatchObject({
      season: 2,
      startsAt: S2,
      opensAt: '2026-10-23T15:00:00.000Z',
      closesAt: '2026-11-04T15:00:00.000Z',
      drawAt: '2026-11-05T00:00:00.000Z',
      minFilled: 8,
    });
    expect(soon.league.rounds).toHaveLength(14);
    expect(soon.league.rounds[0]).toBe('2026-11-05T04:00:00.000Z');
    expect(soon.league.rounds.at(-1)).toBe('2026-11-18T04:00:00.000Z');
    // 사전 신청 전에는 신청할 수 없다.
    const a = await owner(null);
    expect(await me(a.cookie)).toEqual({ entry: null, canEnter: false, team: null });
    const r = await enter(a.cookie);
    expect([r.status, await reason(r)]).toEqual([409, 'LEAGUE_CLOSED']);
  });

  it('시즌 1 막바지 사전 신청: 시즌 2 팀이 없어도 받는다', async () => {
    vi.setSystemTime(new Date(PRESIGN));
    expect((await view()).phase).toBe('open');
    const a = await owner(null);
    expect(await me(a.cookie)).toEqual({ entry: null, canEnter: true, team: null });
    expect((await enter(a.cookie)).status).toBe(204);
    expect(await me(a.cookie)).toMatchObject({ entry: { createdAt: PRESIGN }, canEnter: false });
  });

  it('준비 인원은 감독 카드 정보를 읽지 않고 실제 선발 수를 유지한다', async () => {
    const a = await owner(8);
    await ctx.db
      .update(ownerTeams)
      .set({ coachId: 'unused-coach' })
      .where(eq(ownerTeams.profileId, a.profileId));
    const traced = spyDb(ctx.env.DB);
    const res = await callJson({ ...ctx.env, DB: traced.DB }, 'GET', '/v1/leagues/current/me', {
      cookie: a.cookie,
    });
    expect(res.status).toBe(200);
    expect(MeRes.parse(await res.json()).data.team?.filled).toBe(8);
    expect(traced.seen.filter((q) => /manager_careers/.test(q))).toEqual([]);
  });

  it('신청 · 다시 신청(멱등) · 취소 · 되살리기, 신청 수는 취소한 신청을 뺀다, 준비 상태는 선발 실카드 수', async () => {
    const a = await owner(8);
    const b = await owner(7);
    const before = await me(a.cookie);
    expect(before).toMatchObject({ entry: null, canEnter: true, team: { filled: 8 } });
    expect(typeof before.team?.ovr).toBe('number');
    expect((await me(b.cookie)).team?.filled).toBe(7);
    expect((await enter(a.cookie)).status).toBe(204);
    expect((await enter(a.cookie)).status).toBe(204);
    expect((await enter(b.cookie)).status).toBe(204);
    expect((await me(a.cookie)).canEnter).toBe(false);
    expect((await view()).entries).toBe(2);

    expect(
      (await call('DELETE', '/v1/leagues/current/entries/me', { cookie: a.cookie })).status,
    ).toBe(204);
    expect((await me(a.cookie)).entry).toBeNull();
    vi.setSystemTime(new Date(Date.parse(OPEN) + 60_000));
    expect((await view()).entries).toBe(1);
    expect((await enter(a.cookie)).status).toBe(204);
    expect((await me(a.cookie)).entry).not.toBeNull();
  });

  it('접수가 끝나면 신청 · 취소를 막는다', async () => {
    const a = await owner(8);
    expect((await enter(a.cookie)).status).toBe(204);
    vi.setSystemTime(new Date(CLOSED));
    expect((await view()).phase).toBe('closed');
    const r = await call('DELETE', '/v1/leagues/current/entries/me', { cookie: a.cookie });
    expect([r.status, await reason(r)]).toEqual([409, 'LEAGUE_CLOSED']);
    const b = await owner(8);
    const r2 = await enter(b.cookie);
    expect([r2.status, await reason(r2)]).toEqual([409, 'LEAGUE_CLOSED']);
    // 신청은 남아 있다.
    expect((await me(a.cookie)).entry).not.toBeNull();
  });

  it('운영 도구로 미룬 일정(league_seasons 행)을 기본 일정보다 먼저 쓴다', async () => {
    const later = ['2026-11-07T04:00:00.000Z'];
    await ctx.db.insert(leagueSeasons).values({
      season: 2,
      startsAt: S2,
      opensAt: S2,
      closesAt: '2026-11-06T15:00:00.000Z',
      drawAt: '2026-11-07T00:00:00.000Z',
      roundsJson: JSON.stringify(later),
      minFilled: 8,
      createdAt: OPEN,
      updatedAt: OPEN,
    });
    vi.setSystemTime(new Date(CLOSED));
    const v = await view();
    expect([v.phase, v.league.closesAt, v.league.rounds]).toEqual([
      'open',
      '2026-11-06T15:00:00.000Z',
      later,
    ]);
  });

  it('리그를 여는 시즌이 일정에 없으면 404', async () => {
    applySeasonSchedule([]);
    await ctx.env.DB.prepare("DELETE FROM app_meta WHERE key = 'season_schedule'").run();
    forgetSeasonSchedule();
    vi.setSystemTime(new Date(PRESIGN));
    const res = await call('GET', '/v1/leagues/current');
    expect([res.status, await reason(res)]).toEqual([404, 'LEAGUE_NOT_FOUND']);
  });

  it('공개 조회는 쿠키가 있어도 세션 · 프로필을 읽지 않는다', async () => {
    const a = await owner(null);
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await createApp().request(
      '/v1/leagues/current',
      { headers: { Cookie: a.cookie } },
      { ...ctx.env, DB },
    );
    expect(res.status).toBe(200);
    expect(seen.filter((q) => /"sessions"|from "profiles"|"profiles"\."id" = \?/.test(q))).toEqual(
      [],
    );
  });
});
