import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, putJson, seasonBody } from '../test/http.js';
import { careers, careerSeasons, profiles, cards } from '../db/schema.js';
import { APPEARANCE_OPTIONS, LOOK_RECORDS, validAppearance } from '@offside/contracts/avatar-look';

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
  afterAll(async () => ctx?.dispose());

  it('rejects unauthenticated, wrong owner, active career and unknown fields', async () => {
    expect(
      (await callJson(ctx.env, 'PUT', `/v1/careers/${ID}/look`, { body: { look: 'y6' } })).status,
    ).toBe(401);
    expect((await put({ look: 'y6' }, other.cookie)).status).toBe(409);
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
    for (const look of [code, code, null]) {
      const res = await put({ look });
      expect(res.status).toBe(200);
      expect(((await res.json()) as { data: unknown }).data).toEqual({ careerId: ID, look });
      const after = await snapshot();
      expect(after).toEqual({ ...before, career: { ...before.career, look } });
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
    expect((await put({ look: 'h12y7' })).status).toBe(200);
    expect((await put({ look: null })).status).toBe(200);
    expect((await put({ look: 'h12' })).status).toBe(409);
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
});
