import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { putCareerSeason, type PutCareerSeasonInput } from './careers.js';
import { createDb } from '../client.js';
import { retryTransientWrite } from '../retry.js';
let ctx: TestD1;
beforeAll(async () => {
  ctx = await createTestD1();
  await ctx.env.DB.prepare(
    "INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('owner','{}','2026-10-17','2026-10-17')",
  ).run();
});
afterAll(() => ctx.dispose());
const input = (careerId: string, revision = 10, goals = 2): PutCareerSeasonInput => ({
  careerId,
  profileId: 'owner',
  year: 2026,
  meta: {
    pos: 'FW',
    foot: '오른발',
    type: 'poacher',
    trait: 'late',
    startYear: 2026,
    appVersion: 'test',
  },
  season: {
    age: 18,
    club: 'club',
    league: 'league',
    apps: 10,
    goals,
    assists: 1,
    rating: 7,
    rank: 1,
    ovr: 55,
    honors: [],
    mil: false,
  },
  eventsJson: '[{"phase":1}]',
  now: '2026-10-17T09:00:00Z',
  uploadRevision: revision,
});
const count = async (id: string) =>
  (await ctx.env.DB.prepare('SELECT count(*) AS n FROM season_telemetry WHERE career_id=?')
    .bind(id)
    .first<{ n: number }>())!.n;
describe('season upload recovery', () => {
  it('response loss, duplicate delivery and older revisions do not append telemetry or overwrite newer progress', async () => {
    await putCareerSeason(ctx.db, input('retry'));
    await Promise.all([
      putCareerSeason(ctx.db, input('retry')),
      putCareerSeason(ctx.db, input('retry')),
    ]);
    expect(await count('retry')).toBe(1);
    await putCareerSeason(ctx.db, input('retry', 20, 5));
    await putCareerSeason(ctx.db, input('retry', 10, 2));
    expect(await count('retry')).toBe(2);
    expect(
      await ctx.env.DB.prepare(
        'SELECT goals, upload_revision FROM career_seasons WHERE career_id=?',
      )
        .bind('retry')
        .first(),
    ).toEqual({ goals: 5, upload_revision: 20 });
  });
  it('legacy clients remain accepted and exact payload replay is deduplicated', async () => {
    const old = input('legacy');
    delete old.uploadRevision;
    await putCareerSeason(ctx.db, old);
    await putCareerSeason(ctx.db, old);
    await putCareerSeason(ctx.db, { ...old, season: { ...old.season, goals: 3 } });
    expect(await count('legacy')).toBe(2);
  });
  it('an uncertain committed batch can safely be retried', async () => {
    let loseResponse = true;
    const DB = new Proxy(ctx.env.DB, {
      get(target, key) {
        if (key === 'batch')
          return async (...args: Parameters<D1Database['batch']>) => {
            const result = await target.batch(...args);
            if (loseResponse) {
              loseResponse = false;
              throw new Error('D1_ERROR: Network connection lost.');
            }
            return result;
          };
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    expect(await putCareerSeason(createDb(DB), input('uncertain'))).toBe('active');
    expect(await count('uncertain')).toBe(1);
  });
  it('SQL errors and overload are not retried', async () => {
    const write = vi
      .fn()
      .mockRejectedValue(new Error('D1 DB is overloaded. Requests queued for too long.'));
    await expect(retryTransientWrite(write)).rejects.toThrow('overloaded');
    expect(write).toHaveBeenCalledTimes(1);
  });
});
