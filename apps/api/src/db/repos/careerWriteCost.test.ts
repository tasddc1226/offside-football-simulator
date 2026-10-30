import { afterEach, beforeEach, expect, it } from 'vitest';
import { CareerMetaSchema } from '@offside/contracts';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { TEST_CAREER } from '../../test/http.js';
import { createDb } from '../client.js';
import { createProfile } from './profiles.js';
import { putCareerSeason } from './careers.js';

const ID = '6dd535d6-6956-47eb-a36a-dc1645aff5c0';
const T0 = '2026-10-18T00:00:00.000Z';
const T1 = '2026-10-18T00:01:00.000Z';
const T2 = '2026-10-18T00:02:00.000Z';
let ctx: TestD1;
beforeEach(async () => {
  ctx = await createTestD1();
});
afterEach(async () => {
  await ctx.dispose();
});

async function inputFor(publicName: string | null = 'Alpha') {
  const profile = await createProfile(ctx.db);
  return {
    careerId: ID,
    profileId: profile.id,
    meta: CareerMetaSchema.parse(TEST_CAREER),
    publicName,
    eventsJson: '[]',
    season: {
      age: 18,
      club: 'Test FC',
      league: 'test',
      apps: 10,
      goals: 2,
      assists: 1,
      rating: 7,
      rank: 1,
      ovr: 60,
      honors: [],
    },
  };
}
const head = () =>
  ctx.env.DB.prepare('SELECT public_name, updated_at, status FROM careers WHERE id = ?')
    .bind(ID)
    .first();

it.each(['Alpha', null])(
  'unchanged public name %s avoids HOF index writes in one D1 batch',
  async (publicName) => {
    const input = await inputFor(publicName);
    const batches: number[][] = [];
    const client = new Proxy(ctx.env.DB, {
      get(target, key) {
        if (key === 'batch')
          return async (statements: D1PreparedStatement[]) => {
            const result = await target.batch(statements);
            batches.push(result.map((r) => r.meta.rows_written));
            return result;
          };
        const value: unknown = Reflect.get(target, key);
        return typeof value === 'function'
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    });
    const db = createDb(client);
    await putCareerSeason(db, { ...input, year: 2026, now: T0 });
    batches.length = 0;
    await putCareerSeason(db, { ...input, year: 2027, now: T1 });
    expect(batches).toHaveLength(1);
    // Hot-path write budget: new indexes must account for write amplification.
    expect(batches[0]![0]).toBe(4);
    expect(batches[0]![1]).toBe(0);
    const control = await ctx.env.DB.prepare(
      'UPDATE careers SET app_version = ?, public_name = ?, updated_at = ? WHERE id = ?',
    )
      .bind(TEST_CAREER.appVersion, publicName, T2, ID)
      .run();
    expect(batches[0]![0]).toBeLessThan(control.meta.rows_written);
  },
);

it('applies changed names and anonymity while retaining activity timestamps and seasons', async () => {
  const input = await inputFor();
  await putCareerSeason(ctx.db, { ...input, year: 2026, now: T0 });
  await putCareerSeason(ctx.db, { ...input, publicName: 'Beta', year: 2027, now: T1 });
  expect(await head()).toMatchObject({ public_name: 'Beta', updated_at: T1 });
  await putCareerSeason(ctx.db, { ...input, publicName: null, year: 2028, now: T2 });
  expect(await head()).toMatchObject({ public_name: null, updated_at: T2 });
  const count = await ctx.env.DB.prepare(
    'SELECT count(*) AS n FROM career_seasons WHERE career_id = ?',
  )
    .bind(ID)
    .first('n');
  expect(count).toBe(3);
});

it('concurrent stale revisions and duplicate retries cannot roll back the public name', async () => {
  const input = await inputFor();
  await putCareerSeason(ctx.db, { ...input, year: 2026, now: T0, uploadRevision: 10 });
  await Promise.all([
    putCareerSeason(ctx.db, {
      ...input,
      publicName: 'Gamma',
      year: 2026,
      now: T2,
      uploadRevision: 12,
    }),
    putCareerSeason(ctx.db, {
      ...input,
      publicName: 'Beta',
      year: 2026,
      now: T1,
      uploadRevision: 11,
    }),
  ]);
  await putCareerSeason(ctx.db, {
    ...input,
    publicName: 'Gamma',
    year: 2026,
    now: T2,
    uploadRevision: 12,
  });
  expect(await head()).toMatchObject({ public_name: 'Gamma', updated_at: T2 });
});

it.each(['moderated', 'retired', 'legacy'])(
  'preserves the %s public-name contract',
  async (mode) => {
    const input = await inputFor();
    await putCareerSeason(ctx.db, { ...input, year: 2026, now: T0 });
    if (mode === 'moderated')
      await ctx.env.DB.prepare(
        'UPDATE careers SET name_hidden_at = ?, public_name = NULL WHERE id = ?',
      )
        .bind(T0, ID)
        .run();
    if (mode === 'retired')
      await ctx.env.DB.prepare("UPDATE careers SET status = 'retired' WHERE id = ?").bind(ID).run();
    await putCareerSeason(ctx.db, {
      ...input,
      publicName: mode === 'legacy' ? undefined : 'Beta',
      year: 2027,
      now: T1,
    });
    expect(await head()).toMatchObject({
      public_name: mode === 'moderated' ? null : 'Alpha',
      status: mode === 'retired' ? 'retired' : 'active',
    });
  },
);

it('rolls back a name change together with the season when a later statement fails', async () => {
  const input = await inputFor();
  await putCareerSeason(ctx.db, { ...input, year: 2026, now: T0 });
  await ctx.env.DB.prepare(
    "CREATE TRIGGER reject_test_season BEFORE INSERT ON career_seasons WHEN NEW.year = 2027 BEGIN SELECT RAISE(ABORT, 'test rejection'); END",
  ).run();
  await expect(
    putCareerSeason(ctx.db, { ...input, publicName: 'Beta', year: 2027, now: T1 }),
  ).rejects.toThrow();
  expect(await head()).toMatchObject({ public_name: 'Alpha', updated_at: T0 });
});
