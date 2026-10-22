import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { createDb } from '../client.js';
import { appMeta } from '../schema.js';
import { createTestD1, spyDb, type TestD1 } from '../../test/d1.js';
import { ensureHofBackfilled } from './hofBackfill.js';

const KEYS = ['club_ids_backfill', 'career_values_backfill'];
describe('HOF backfill metadata stays request-local and bounded', () => {
  let ctx: TestD1;
  beforeAll(async () => {
    ctx = await createTestD1();
  });
  afterAll(async () => {
    await ctx.dispose();
  });

  it('completed backfills use one indexed metadata statement, no snapshots or writes', async () => {
    await ctx.db.delete(appMeta).where(inArray(appMeta.key, KEYS));
    await ctx.db.insert(appMeta).values(KEYS.map((key) => ({ key, value: '1' })));
    const traced = spyDb(ctx.env.DB);
    expect(await ensureHofBackfilled(createDb(traced.DB))).toBe(false);
    expect(traced.seen).toHaveLength(1);
    expect(traced.seen[0]).toContain('"app_meta"."key" in');
    expect(traced.trips.n).toBe(1);
  });

  it('removing completion markers after a previous request still runs unfinished pages, then completes normally', async () => {
    await ctx.db.delete(appMeta).where(inArray(appMeta.key, KEYS));
    const traced = spyDb(ctx.env.DB);
    expect(await ensureHofBackfilled(createDb(traced.DB))).toBe(true);
    const rows = await ctx.db.select().from(appMeta).where(inArray(appMeta.key, KEYS));
    expect(new Map(rows.map((r) => [r.key, r.value]))).toEqual(new Map(KEYS.map((k) => [k, '1'])));
    expect(await ensureHofBackfilled(createDb(traced.DB))).toBe(false);
  });
});
