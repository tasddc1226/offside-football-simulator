import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { cupMatches, cupPredictions, ownerItems } from '../db/schema.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { callJson, issueGoogleCookie, issueCookie, deleteProfile } from '../test/http.js';
import { predictionSettlementStatements } from '../team/cupPredictions.js';
import { playCupMatch } from '../team/cup.js';
import { planCup } from '@offside/contracts/cup';

const NOW = '2026-10-10T03:00:00.000Z';
const AT = '2026-10-11T12:00:00.000Z';
const CUP = planCup({ id: 's1-1', season: 1, edition: 1, opensOn: '2026-10-09' });
const path = '/v1/cups/s1-1';
describe('cup predictions', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });
  const match = async (id: string, round = 'g1', at = AT) => {
    await ctx.db.insert(cupMatches).values({
      id,
      cupId: 's1-1',
      round,
      grp: 1,
      slot: Number(id.replace(/\D/g, '')) || 0,
      homeTeamId: 'home',
      awayTeamId: 'away',
      at,
    });
    return (await ctx.db.select().from(cupMatches).where(eq(cupMatches.id, id)))[0]!;
  };
  const pick = (cookie: string, id: string, choice: string) =>
    callJson(ctx.env, 'PUT', `${path}/matches/${id}/prediction`, {
      cookie,
      body: { pick: choice },
    });
  const settle = (id: string) =>
    ctx.env.DB.batch(predictionSettlementStatements(ctx.env.DB, id, AT));
  const qty = async () => (await ctx.db.select().from(ownerItems))[0]?.qty ?? 0;

  it('allows non-entrants, upserts one pick, returns aggregate counts without account data or session reads', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    await match('m1');
    expect((await pick(a.cookie, 'm1', 'home')).status).toBe(200);
    expect((await pick(a.cookie, 'm1', 'draw')).status).toBe(200);
    await pick(b.cookie, 'm1', 'away');
    expect(await ctx.db.select().from(cupPredictions)).toHaveLength(2);
    const { DB, seen } = spyDb(ctx.env.DB);
    const r = await callJson({ ...ctx.env, DB }, 'GET', `${path}/predictions`, {
      cookie: a.cookie,
    });
    expect(r.headers.get('cache-control')).toContain('s-maxage=30');
    expect(await r.json()).toMatchObject({
      data: { items: [{ matchId: 'm1', home: 0, draw: 1, away: 1 }] },
    });
    expect(seen.join(' ')).not.toMatch(/\b(sessions|profiles)\b/i);
    const own = await callJson(ctx.env, 'GET', `${path}/predictions/me`, { cookie: a.cookie });
    expect(await own.json()).toMatchObject({
      data: { items: [{ matchId: 'm1', pick: 'draw', correct: null, rewarded: false }] },
    });
    expect(own.headers.get('cache-control')).toContain('no-store');
  });

  it('requires an account and closes at kickoff even before processing, including edits', async () => {
    const a = await issueGoogleCookie(ctx);
    const guest = await issueCookie(ctx);
    await match('m1');
    expect((await pick(guest.cookie, 'm1', 'home')).status).toBe(403);
    expect((await pick(a.cookie, 'm1', 'home')).status).toBe(200);
    vi.setSystemTime(new Date(AT));
    expect((await pick(a.cookie, 'm1', 'away')).status).toBe(409);
    expect((await ctx.db.select().from(cupPredictions))[0]?.pick).toBe('home');
  });

  it('rejects knockout draws and undecided or missing fixtures', async () => {
    const a = await issueGoogleCookie(ctx);
    await match('m1', 'qf');
    await match('m2');
    expect((await pick(a.cookie, 'm1', 'draw')).status).toBe(409);
    await ctx.db.update(cupMatches).set({ awayTeamId: null }).where(eq(cupMatches.id, 'm2'));
    expect((await pick(a.cookie, 'm2', 'home')).status).toBe(409);
    expect((await pick(a.cookie, 'missing', 'home')).status).toBe(409);
  });

  it('settles draws and penalty winners; every correct match earns one with no cap and no duplicate grants', async () => {
    const a = await issueGoogleCookie(ctx);
    for (let i = 1; i <= 5; i++) {
      const id = `m${i}`;
      await match(id, i === 2 ? 'qf' : 'g1');
      await pick(a.cookie, id, i === 1 ? 'draw' : i === 2 ? 'away' : 'home');
      await ctx.db
        .update(cupMatches)
        .set({
          playedAt: AT,
          homeGoals: i <= 2 ? 1 : 2,
          awayGoals: 1,
          winnerTeamId: i === 1 ? null : i === 2 ? 'away' : 'home',
          pensHome: i === 2 ? 3 : null,
          pensAway: i === 2 ? 4 : null,
        })
        .where(eq(cupMatches.id, id));
      await settle(id);
      await settle(id);
    }
    expect(await qty()).toBe(5);
    expect(
      (await ctx.db.select().from(cupPredictions)).every((p) => p.correct && p.rewardedAt === AT),
    ).toBe(true);
    await match('m6');
    await pick(a.cookie, 'm6', 'away');
    await ctx.db
      .update(cupMatches)
      .set({ playedAt: AT, homeGoals: 3, awayGoals: 0, winnerTeamId: 'home' })
      .where(eq(cupMatches.id, 'm6'));
    await settle('m6');
    expect(await qty()).toBe(5);
    expect(
      (await ctx.db.select().from(cupPredictions).where(eq(cupPredictions.matchId, 'm6')))[0],
    ).toMatchObject({ correct: false, rewardedAt: null });
  });

  it('account deletion removes predictions before later settlement and does not recreate inventory', async () => {
    const a = await issueGoogleCookie(ctx);
    const m = await match('m1');
    await pick(a.cookie, 'm1', 'home');
    expect((await deleteProfile(ctx.env, a.cookie, 'prediction-delete')).status).toBe(204);
    expect(await ctx.db.select().from(cupPredictions)).toEqual([]);
    await playCupMatch(ctx.db, CUP, m, new Map(), AT);
    expect(await qty()).toBe(0);
  });

  it('match processing commits the result and reward together; a failed inventory write rolls both back', async () => {
    const a = await issueGoogleCookie(ctx);
    const m = await match('m1');
    await pick(a.cookie, 'm1', 'home');
    await ctx.env.DB.exec(
      "CREATE TRIGGER fail_reward BEFORE INSERT ON owner_items BEGIN SELECT RAISE(ABORT, 'test rollback'); END",
    );
    await expect(playCupMatch(ctx.db, CUP, m, new Map(), AT)).rejects.toThrow();
    expect((await ctx.db.select().from(cupMatches))[0]?.playedAt).toBeNull();
    expect((await ctx.db.select().from(cupPredictions))[0]?.settledAt).toBeNull();
    await ctx.env.DB.exec('DROP TRIGGER fail_reward');
    await Promise.all([
      playCupMatch(ctx.db, CUP, m, new Map(), AT),
      playCupMatch(ctx.db, CUP, m, new Map(), AT),
    ]);
    expect(await qty()).toBe(1);
    expect((await ctx.db.select().from(cupMatches))[0]).toMatchObject({ playedAt: AT, forfeit: 1 });
    expect((await pick(a.cookie, 'm1', 'away')).status).toBe(409);
  });
});
