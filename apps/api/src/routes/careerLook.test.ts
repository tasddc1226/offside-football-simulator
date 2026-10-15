import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestD1, syncCards, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, putJson, seasonBody } from '../test/http.js';
import { careers, careerSeasons, profiles, cards } from '../db/schema.js';
import { APPEARANCE_OPTIONS, LOOK_RECORDS, validAppearance } from '@offside/contracts/avatar-look';

import { putRetirement, retiredLookPolicy, updateRetiredLook } from '../db/repos/careers.js';

const ID = '00000000-0000-4000-8000-000000000609';
describe('retired appearance-only write', () => {
  let ctx: TestD1;
  let owner: Awaited<ReturnType<typeof issueCookie>>;
  let other: Awaited<ReturnType<typeof issueCookie>>;
  const put = (body: unknown, cookie = owner.cookie) =>
    putJson(ctx, cookie, `/v1/careers/${ID}/look`, body);
  beforeAll(async () => {
    ctx = await createTestD1();
    owner = await issueCookie(ctx);
    other = await issueCookie(ctx);
    expect(
      (await putJson(ctx, owner.cookie, `/v1/careers/${ID}/seasons/2026`, seasonBody())).status,
    ).toBe(200);
  });
  beforeEach(async () => {
    await ctx.db.delete(cards);
    await ctx.db
      .update(careers)
      .set({ status: 'retired', look: null, retiredLookUsed: 0, snapshotJson: null })
      .where(eq(careers.id, ID));
  });
  afterAll(async () => ctx?.dispose());

  it('rejects unauthenticated, wrong owner, active career and unknown fields', async () => {
    expect(
      (await callJson(ctx.env, 'PUT', `/v1/careers/${ID}/look`, { body: { look: 'y6' } })).status,
    ).toBe(401);
    expect((await put({ look: 'y6' }, other.cookie)).status).toBe(409);
    await ctx.db.update(careers).set({ status: 'active' }).where(eq(careers.id, ID));
    expect((await put({ look: 'y6' })).status).toBe(409);
    await ctx.db
      .update(careers)
      .set({
        status: 'retired',
        retiredAt: '2026-10-01T00:00:00.000Z',
        retireAge: 38,
        legendScore: 999,
        peak: 88,
        value: 12345,
        potReal: 94,
        title: 'champion',
        look: null,
      })
      .where(eq(careers.id, ID));
    for (const body of [
      { look: 'y6', peak: 200 },
      { look: 'y6', snapshot: {} },
      { look: 'y6', profileId: other.profileId },
      { look: 's6' },
      { look: 'x0' },
      { look: 'y1y2' },
      { look: 'y01' },
      { look: '' },
    ]) {
      expect((await put(body)).status).toBe(400);
    }
    expect((await ctx.db.select().from(careers).where(eq(careers.id, ID)))[0]?.look).toBeNull();
  });

  it('edits pre-existing retired rows with no cosmetic data or snapshot, changing ONLY look', async () => {
    const snapshot = async () => ({
      career: (await ctx.db.select().from(careers).where(eq(careers.id, ID)))[0]!,
      seasons: await ctx.db.select().from(careerSeasons),
      profiles: await ctx.db.select().from(profiles),
      cards: await ctx.db.select().from(cards),
    });
    const before = await snapshot();
    const code = 's5h11d2y8e2a7w5g5b9k6';
    for (const look of [code, code]) {
      const res = await put({ look });
      expect(res.status).toBe(200);
      expect(((await res.json()) as { data: unknown }).data).toEqual({ careerId: ID, look });
      const after = await snapshot();
      expect(after).toEqual({ ...before, career: { ...before.career, look, retiredLookUsed: 2 } });
    }
  });

  it('requires stored title evidence for rare items, preserves already-worn legacy items', async () => {
    expect((await put({ look: 'h12' })).status).toBe(409);
    // Selected summary title alone does not grant an item; only the stored earned-title list does.
    expect((await put({ look: 'a8' })).status).toBe(409);
    await ctx.db
      .update(careers)
      .set({ snapshotJson: JSON.stringify({ titles: [{ id: 'ballon', year: 2030 }] }) })
      .where(eq(careers.id, ID));
    expect((await put({ look: 'h12y6' })).status).toBe(200);
    await ctx.db.update(careers).set({ snapshotJson: null }).where(eq(careers.id, ID));
    expect((await put({ look: 'h12y7' })).status).toBe(409);
    // A pre-policy legacy look may be retained during the one available edit.
    await ctx.db.update(careers).set({ retiredLookUsed: 0 }).where(eq(careers.id, ID));
    expect((await put({ look: 'h12y7' })).status).toBe(200);
    await ctx.db.update(careers).set({ retiredLookUsed: 0 }).where(eq(careers.id, ID));
    expect((await put({ look: null })).status).toBe(200);
    expect((await put({ look: 'h12' })).status).toBe(409);
  });

  it('spends one change only; no-op and lost-response retries are idempotent', async () => {
    expect((await put({ look: null })).status).toBe(200);
    expect((await retiredLookPolicy(ctx.db, ID))?.remaining).toBe(1);
    expect((await put({ look: 'y6' })).status).toBe(200);
    expect((await put({ look: 'y6' })).status).toBe(200);
    const blocked = await put({ look: 'y7' });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({
      error: { details: { reason: 'LOOK_ALREADY_USED' } },
    });
    expect((await put({ look: null })).status).toBe(409);
    const r = await callJson(ctx.env, 'GET', `/v1/careers/${ID}/look`, { cookie: owner.cookie });
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await r.json()).toMatchObject({
      data: { remaining: 0, lockedReason: 'used', look: 'y6' },
    });
    expect(
      (await callJson(ctx.env, 'GET', `/v1/careers/${ID}/look`, { cookie: other.cookie })).status,
    ).toBe(409);
    expect((await callJson(ctx.env, 'GET', `/v1/careers/${ID}/look`)).status).toBe(401);
  });

  it('gives a retiree who spent the change on the dot character one more change (T-11-243)', async () => {
    await ctx.db.update(careers).set({ look: 'y6', retiredLookUsed: 1 }).where(eq(careers.id, ID));
    expect(await retiredLookPolicy(ctx.db, ID)).toMatchObject({
      remaining: 1,
      lockedReason: null,
      look: 'y6',
    });
    expect((await put({ look: 'y7' })).status).toBe(200);
    expect(
      (await ctx.db.select().from(careers).where(eq(careers.id, ID)))[0]?.retiredLookUsed,
    ).toBe(2);
    expect((await put({ look: 'y8' })).status).toBe(409);
    expect(await retiredLookPolicy(ctx.db, ID)).toMatchObject({
      remaining: 0,
      lockedReason: 'used',
      look: 'y7',
    });
  });

  it('allows exactly one of concurrent different appearances', async () => {
    const results = await Promise.all([put({ look: 'y6' }), put({ look: 'y7' })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await retiredLookPolicy(ctx.db, ID))?.remaining).toBe(0);
  });

  it('permanently locks transferred cards, including reacquisition, even after a stale check', async () => {
    await ctx.db.update(careers).set({ peak: 88 }).where(eq(careers.id, ID));
    await syncCards(ctx);
    expect((await retiredLookPolicy(ctx.db, ID))?.remaining).toBe(1);
    // Purchase completes between the editor/preflight read and the actual write.
    await ctx.db
      .update(cards)
      .set({ ownerId: other.profileId, transfers: 1 })
      .where(eq(cards.careerId, ID));
    expect(await updateRetiredLook(ctx.db, ID, owner.profileId, 'y6')).toBeUndefined();
    const blocked = await put({ look: 'y6' });
    expect(await blocked.json()).toMatchObject({
      error: { details: { reason: 'LOOK_TRANSFERRED' } },
    });
    await ctx.db
      .update(cards)
      .set({ ownerId: owner.profileId, transfers: 2 })
      .where(eq(cards.careerId, ID));
    expect((await put({ look: 'y6' })).status).toBe(409);
    expect(await retiredLookPolicy(ctx.db, ID)).toMatchObject({
      remaining: 0,
      lockedReason: 'transferred',
      look: null,
    });
    expect(
      (await ctx.db.select().from(careers).where(eq(careers.id, ID)))[0]?.retiredLookUsed,
    ).toBe(0);
  });

  it('a delayed first retirement writer cannot replace edited cosmetics or reset the allowance', async () => {
    expect((await put({ look: 'y6' })).status).toBe(200);
    await putRetirement(ctx.db, {
      careerId: ID,
      look: 'y8',
      bonusRate: 0,
      now: '2026-10-13T00:00:00.000Z',
      summary: {
        retireAge: 38,
        peak: 88,
        legendScore: 999,
        apps: 100,
        goals: 50,
        assists: 12,
        trophies: 1,
        awards: 1,
        caps: 1,
        ballon: 0,
        lastClub: '서울 FC',
      },
    });
    expect(await retiredLookPolicy(ctx.db, ID)).toMatchObject({
      look: 'y6',
      remaining: 0,
      lockedReason: 'used',
    });
  });

  it('rejects missing career without creating or restoring any retirement record', async () => {
    expect(
      (
        await putJson(ctx, owner.cookie, '/v1/careers/00000000-0000-4000-8000-000000000610/look', {
          look: 'y6',
        })
      ).status,
    ).toBe(404);
    expect(await ctx.db.select().from(careers)).toHaveLength(1);
  });
});

it('wire limits accept all normal values and record item definitions', () => {
  for (const [code, limit] of Object.entries(APPEARANCE_OPTIONS)) {
    for (let value = 0; value < limit; value++)
      expect(validAppearance(`${code}${value}`)).toBe(true);
    expect(validAppearance(`${code}${limit}`)).toBe(false);
  }
  expect(LOOK_RECORDS).toHaveLength(6);
  // T-11-243 13개 항목을 모두 고른 가장 긴 코드(키퍼 용품 포함)도 받는다.
  expect(validAppearance('s1h2d1y14e2a3w4g2b5k6l5u4n3')).toBe(true);
  expect(validAppearance('s1h2d1y14e2a3w4g2b5k6l5u4n3s1')).toBe(false);
});
