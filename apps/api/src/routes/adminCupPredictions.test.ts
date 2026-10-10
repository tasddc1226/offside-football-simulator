import { afterEach, beforeEach, expect, it, describe } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueAdminCookie, issueGoogleCookie, ADMIN_EMAIL } from '../test/http.js';
import { cupMatches, cupPredictions, ownerItems, auditLog, profiles } from '../db/schema.js';

const base = '/v1/admin/cups/s1-1';
const now = '2026-10-10T03:00:00.000Z';
describe('cup prediction operations', () => {
  let ctx: TestD1;
  let cookie: string;
  const call = (method: string, path: string, body?: unknown, auth = cookie) =>
    callJson({ ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL }, method, path, { cookie: auth, body });
  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueAdminCookie(ctx)).cookie;
  });
  afterEach(async () => await ctx.dispose());
  async function fixture(id = 'm1', played = true, round = 'g1') {
    await ctx.db.insert(cupMatches).values({
      id,
      cupId: 's1-1',
      round,
      grp: 1,
      slot: Number(id.slice(1)) || 1,
      homeTeamId: 'home',
      awayTeamId: 'away',
      at: now,
      playedAt: played ? now : null,
      homeGoals: played ? 1 : null,
      awayGoals: played ? 1 : null,
      winnerTeamId: round === 'g1' ? null : 'away',
    });
    return id;
  }
  async function predict(matchId: string, pick: 'home' | 'draw' | 'away', settled = false) {
    const user = await issueGoogleCookie(ctx);
    await ctx.db.insert(cupPredictions).values({
      cupId: 's1-1',
      matchId,
      profileId: user.profileId,
      pick,
      createdAt: now,
      updatedAt: now,
      ...(settled ? { correct: true, settledAt: now } : {}),
    });
    return user.profileId;
  }
  it('requires admin on every read and write and does not share private data', async () => {
    const user = await issueGoogleCookie(ctx);
    for (const [method, path] of [
      ['GET', `${base}/predictions`],
      ['GET', `${base}/matches/m1/predictions`],
      ['POST', `${base}/matches/m1/predictions/settle`],
    ]) {
      expect((await call(method!, path!, undefined, '')).status).toBe(401);
      expect((await call(method!, path!, undefined, user.cookie)).status).toBe(403);
    }
    const res = await call('GET', `${base}/predictions`);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
  it('scopes reports and detail to the cup, aggregates votes and outcomes', async () => {
    await fixture();
    await predict('m1', 'draw');
    await predict('m1', 'home');
    const r = await call('GET', `${base}/predictions`);
    expect(await r.json()).toMatchObject({
      data: {
        cupId: 's1-1',
        participants: 2,
        items: [
          { total: 2, home: 1, draw: 1, away: 0, pending: 2, hits: 0, match: { played: true } },
        ],
      },
    });
    expect((await call('GET', '/v1/admin/cups/s1-2/matches/m1/predictions')).status).toBe(404);
    expect((await call('GET', '/v1/admin/cups/s1-99/predictions')).status).toBe(404);
    expect(await (await call('GET', `${base}/matches/m1/predictions`)).json()).toMatchObject({
      data: { items: [{ correct: null }, { correct: null }], next: null },
    });
  });
  it('recovers unsettled and settled-but-unpaid hits once, audits operator and reason', async () => {
    await fixture();
    await predict('m1', 'draw');
    await predict('m1', 'draw', true);
    await predict('m1', 'away');
    const path = `${base}/matches/m1/predictions/settle`;
    expect((await call('POST', path, { reason: 'x' })).status).toBe(400);
    for (let i = 0; i < 2; i++)
      expect((await call('POST', path, { reason: 'Missing settlement recovery' })).status).toBe(
        200,
      );
    expect((await ctx.db.select().from(ownerItems)).map((r) => r.qty)).toEqual([1, 1]);
    const rows = await ctx.db.select().from(cupPredictions);
    expect(rows.filter((r) => r.correct && r.rewardedAt)).toHaveLength(2);
    expect(rows.filter((r) => r.correct === false && r.settledAt && !r.rewardedAt)).toHaveLength(1);
    const audit = await ctx.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.kind, 'CUP_PREDICTIONS_RECOVERED'));
    expect(audit).toHaveLength(2);
    expect(JSON.parse(audit[0]!.payloadJson)).toMatchObject({
      cupId: 's1-1',
      matchId: 'm1',
      reason: 'Missing settlement recovery',
    });
  });
  it('rejects unfinished matches even when kickoff has passed and wrong-cup writes', async () => {
    await fixture('m1', false);
    await predict('m1', 'home');
    expect(
      (await call('POST', `${base}/matches/m1/predictions/settle`, { reason: 'Test recovery' }))
        .status,
    ).toBe(409);
    expect(
      (
        await call('POST', '/v1/admin/cups/s1-2/matches/m1/predictions/settle', {
          reason: 'Test recovery',
        })
      ).status,
    ).toBe(404);
    expect(await ctx.db.select().from(ownerItems)).toHaveLength(0);
  });
  it('paginates by the existing match/profile key without missing or repeating users', async () => {
    await fixture();
    const ids = Array.from({ length: 51 }, (_, i) => `prf_page_${String(i).padStart(3, '0')}`);
    for (let i = 0; i < ids.length; i += 8) {
      const chunk = ids.slice(i, i + 8);
      await ctx.db.insert(profiles).values(
        chunk.map((id) => ({
          id,
          settingsJson: '{}',
          createdAt: now,
          lastSeenAt: now,
          nickname: id,
        })),
      );
      await ctx.db.insert(cupPredictions).values(
        chunk.map((profileId) => ({
          profileId,
          cupId: 's1-1',
          matchId: 'm1',
          pick: 'home' as const,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
    const first = (await (await call('GET', `${base}/matches/m1/predictions`)).json()) as {
      data: { items: { profileId: string }[]; next: string };
    };
    expect(first.data.items).toHaveLength(50);
    expect(first.data.next).toBe(ids[49]);
    const last = await (
      await call('GET', `${base}/matches/m1/predictions?after=${first.data.next}`)
    ).json();
    expect(last).toMatchObject({ data: { items: [{ profileId: ids[50] }], next: null } });
  });
  it('uses final penalty winner in knockout matches', async () => {
    await fixture('m1', true, 'qf');
    await predict('m1', 'away');
    await predict('m1', 'home');
    expect(
      (
        await call('POST', `${base}/matches/m1/predictions/settle`, {
          reason: 'Test penalty recovery',
        })
      ).status,
    ).toBe(200);
    expect(await ctx.db.select().from(ownerItems)).toHaveLength(1);
  });
});
