import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { DAY_MS } from '../time.js';
import {
  RETENTION_STATE_KEY,
  RETENTION_REPORT_KEY,
  runCareerRetention,
  resumeCareerDetails,
  restoreCareerDetails,
} from './careerRetention.js';

const NOW = Date.parse('2027-02-01T19:00:00Z');
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();
let ctx: TestD1;
const env = () => ({ ...ctx.env, ENVIRONMENT: 'production' });
const run = (sql: string, ...params: unknown[]) =>
  ctx.env.DB.prepare(sql)
    .bind(...params)
    .run();
const state = async (observedDays = 31) =>
  run(
    `INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    RETENTION_STATE_KEY,
    JSON.stringify({ startedAt: ago(observedDays), nextReportAt: ago(1), nextArchiveAt: ago(1) }),
  );
const head = (id: string) =>
  ctx.env.DB.prepare('SELECT status, updated_at, detail_archive_key FROM careers WHERE id=?')
    .bind(id)
    .first<{ status: string; updated_at: string; detail_archive_key: string | null }>();
const details = (id: string) =>
  ctx.env.DB.prepare(
    'SELECT year, events_json, signals_json, growth_json, ovr, apps FROM career_seasons WHERE career_id=? ORDER BY year',
  )
    .bind(id)
    .all();
async function seed(id: string, n = 1, days = 91, season = 0, status = 'active') {
  await run(
    `INSERT INTO careers(id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at, service_season)
    VALUES (?, 'owner', 'FW', 'right', 'late', 'star', 2026, ?, 'test', ?, ?, ?)`,
    id,
    status,
    ago(days),
    ago(days),
    season,
  );
  for (let i = 0; i < n; i++)
    await run(
      `INSERT INTO career_seasons(career_id,year,age,club,league,apps,goals,assists,rating,rank,ovr,honors_json,mil,events_json,signals_json,growth_json,created_at)
    VALUES (?, ?, ?, 'club', 'k1', 30, 10, 5, 7, '1', 60, '[]', 0, ?, ?, ?, ?)`,
      id,
      2026 + i,
      18 + i,
      '[{"eventId":"example"}]',
      '{"headless":false}',
      '{"pot":70}',
      ago(days),
    );
}
beforeAll(async () => {
  ctx = await createTestD1();
  await run(
    "INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('owner','{}',?,?)",
    ago(100),
    ago(1),
  );
});
afterAll(() => ctx.dispose());

describe('dormant career automatic retention', () => {
  it('starts a persisted 30-day observation period, reports weekly, and skips nonproduction/missing storage', async () => {
    await seed('observe');
    expect(await runCareerRetention(ctx.env, NOW)).toMatchObject({ mode: 'skipped' });
    const noStorage = env();
    delete noStorage.BACKUP;
    expect(await runCareerRetention(noStorage, NOW)).toMatchObject({ mode: 'skipped' });
    const first = await runCareerRetention(env(), NOW);
    expect(first).toMatchObject({
      mode: 'observe',
      archived: 0,
      report: { active: 1, dormant: 1, candidates: 1 },
    });
    expect((await head('observe'))!.detail_archive_key).toBeNull();
    expect(await runCareerRetention(env(), NOW + DAY_MS)).toMatchObject({
      mode: 'observe',
      archived: 0,
    });
    expect(
      await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
        .bind(RETENTION_REPORT_KEY)
        .first(),
    ).not.toBeNull();
    await run('DELETE FROM careers WHERE id=?', 'observe');
  });

  it('archives only 1-3 season old unprotected careers; retains scores, owner, service season and archive contents', async () => {
    await state();
    await seed('eligible', 3, 90);
    await seed('recent', 1, 89);
    await seed('retired', 1, 120, 0, 'retired');
    await seed('current', 1, 120, 1);
    await seed('long', 4, 120);
    await seed('zero', 0, 120);
    await seed('record', 1, 120);
    await run(
      "INSERT INTO server_records(season,id,career_id,value,achieved_at) VALUES (0,'example','record',1,?)",
      ago(120),
    );
    await seed('honor', 1, 120);
    await run("UPDATE careers SET wall_of_honor_json='{}' WHERE id='honor'");
    for (const id of ['card', 'listing', 'first', 'number', 'recap']) await seed(id, 1, 120);
    await run(
      "INSERT INTO cards(career_id,service_season,pos,peak,legend_score,retire_value,transfers,created_at,updated_at) VALUES ('card',0,'FW',60,0,0,0,?,?)",
      ago(120),
      ago(120),
    );
    await run(
      "INSERT INTO market_listings(id,career_id,seller_id,season,price,fee,status,created_at) VALUES ('listing','listing','owner',0,1,0,'cancelled',?)",
      ago(120),
    );
    await run(
      "INSERT INTO server_firsts(season,id,career_id,achieved_at) VALUES (0,'example','first',?)",
      ago(120),
    );
    await run(
      "INSERT INTO retired_numbers(season,club_id,number,career_id,club,score,seq,granted_at) VALUES (0,'club',9,'number','club',1,1,?)",
      ago(120),
    );
    await run(
      "INSERT INTO owner_season_records(profile_id,season,players,retired,best_career_id,retired_numbers,wall_of_honor,firsts,created_at) VALUES ('owner',0,1,0,'recap',0,0,0,?)",
      ago(120),
    );
    const before = (await details('eligible')).results;
    const r = await runCareerRetention(env(), NOW);
    expect(r).toMatchObject({ mode: 'archive', archived: 1, raced: 0 });
    expect(r.bytes).toBeGreaterThan(0);
    const key = (await head('eligible'))!.detail_archive_key!;
    const object = await ctx.env.BACKUP!.get(key);
    const archive = (await new Response(
      object!.body.pipeThrough(new DecompressionStream('gzip')),
    ).json()) as { careerId: string; rows: unknown[] };
    expect(archive).toMatchObject({
      careerId: 'eligible',
      rows: before.map(({ year, events_json, signals_json, growth_json }) => ({
        year,
        events_json,
        signals_json,
        growth_json,
      })),
    });
    expect((await details('eligible')).results).toEqual(
      before.map((r) => ({ ...r, events_json: '[]', signals_json: null, growth_json: null })),
    );
    for (const id of [
      'recent',
      'retired',
      'current',
      'long',
      'zero',
      'record',
      'honor',
      'card',
      'listing',
      'first',
      'number',
      'recap',
    ])
      expect((await head(id))!.detail_archive_key, id).toBeNull();
    expect(await runCareerRetention(env(), NOW + DAY_MS)).toMatchObject({
      mode: 'idle',
      archived: 0,
    });
  });

  it('restores only for the owner, preserves newer data, is idempotent and preserves the object for historical backups', async () => {
    const h = (await head('eligible'))!;
    const key = h.detail_archive_key!;
    await restoreCareerDetails(env(), 'eligible', 'someone-else', key, ago(0));
    expect((await head('eligible'))!.detail_archive_key).toBe(key);
    expect(await ctx.env.BACKUP!.head(key)).not.toBeNull();
    await run(
      "UPDATE career_seasons SET events_json='[{\"new\":true}]' WHERE career_id='eligible' AND year=2028",
    );
    await resumeCareerDetails(env(), 'eligible', 'owner', key, h.updated_at, ago(0));
    expect((await head('eligible'))!.detail_archive_key).toBeNull();
    expect((await details('eligible')).results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          year: 2026,
          events_json: '[{"eventId":"example"}]',
          signals_json: '{"headless":false}',
        }),
        expect.objectContaining({ year: 2028, events_json: '[{"new":true}]' }),
      ]),
    );
    expect(await ctx.env.BACKUP!.head(key)).not.toBeNull();
    await resumeCareerDetails(env(), 'eligible', 'owner', null, ago(0), ago(0));
    expect((await head('eligible'))!.status).toBe('active');
  });

  it('failed R2 upload leaves all D1 details and archive pointer untouched', async () => {
    await state();
    await seed('r2-fail');
    const before = (await details('r2-fail')).results;
    const broken = new Proxy(ctx.env.BACKUP!, {
      get(t, p) {
        if (p === 'createMultipartUpload') return () => Promise.reject(new Error('R2 unavailable'));
        const v = Reflect.get(t, p);
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    await expect(runCareerRetention({ ...env(), BACKUP: broken }, NOW)).rejects.toThrow(
      'R2 unavailable',
    );
    expect((await details('r2-fail')).results).toEqual(before);
    expect((await head('r2-fail'))!.detail_archive_key).toBeNull();
    await run('DELETE FROM careers WHERE id=?', 'r2-fail');
  });

  it('a season upload during R2 put cancels compaction, so new progress wins', async () => {
    await state();
    await seed('racing');
    const wrapped = new Proxy(ctx.env.BACKUP!, {
      get(t, p) {
        if (p === 'createMultipartUpload')
          return async (...args: Parameters<R2Bucket['createMultipartUpload']>) => {
            await run("UPDATE careers SET updated_at=? WHERE id='racing'", ago(0));
            return t.createMultipartUpload(...args);
          };
        const v = Reflect.get(t, p);
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    expect(await runCareerRetention({ ...env(), BACKUP: wrapped }, NOW)).toMatchObject({
      archived: 0,
      raced: 1,
    });
    expect((await head('racing'))!.detail_archive_key).toBeNull();
    expect((await details('racing')).results[0]).toMatchObject({
      events_json: '[{"eventId":"example"}]',
    });
  });

  it('limits each archive run and continues the backlog before scheduling next month', async () => {
    await state();
    await run("DELETE FROM careers WHERE id='recent'");
    for (let i = 0; i < 51; i++) await seed(`batch-${i}`);
    expect(await runCareerRetention(env(), NOW)).toMatchObject({ archived: 50 });
    expect(await runCareerRetention(env(), NOW + DAY_MS)).toMatchObject({
      mode: 'archive',
      archived: 1,
    });
    expect(await runCareerRetention(env(), NOW + 2 * DAY_MS)).toMatchObject({
      mode: 'idle',
      archived: 0,
    });
  });

  it('overlapping invocation skips work and missing archive cannot clear its pointer', async () => {
    await run(
      "INSERT INTO app_meta(key,value) VALUES ('cron:career-retention:lease',?)",
      JSON.stringify({ token: 'other', expiresAt: Date.now() + DAY_MS }),
    );
    expect(await runCareerRetention(env(), NOW)).toMatchObject({ mode: 'busy', archived: 0 });
    await run("DELETE FROM app_meta WHERE key='cron:career-retention:lease'");
    await seed('missing-archive');
    const key = 'career-details/production/missing-archive/absent.json.gz';
    await run('UPDATE careers SET detail_archive_key=? WHERE id=?', key, 'missing-archive');
    await expect(
      resumeCareerDetails(env(), 'missing-archive', 'owner', key, ago(91), ago(0)),
    ).rejects.toThrow('archive is missing');
    expect((await head('missing-archive'))!.detail_archive_key).toBe(key);
    await run('DELETE FROM careers WHERE id=?', 'missing-archive');
  });

  it('removes only aged unreferenced objects; stop switch prevents all retention changes', async () => {
    const key = 'career-details/production/orphan/old.json.gz';
    await ctx.env.BACKUP!.put(key, 'orphan');
    const later = NOW + 400 * DAY_MS;
    expect(
      await runCareerRetention({ ...env(), CAREER_RETENTION_DISABLED: '1' }, later),
    ).toMatchObject({ mode: 'skipped' });
    expect(await ctx.env.BACKUP!.head(key)).not.toBeNull();
    // Do not archive more fixture careers during the sweep test.
    await state(1);
    const previousKeys = (
      await ctx.env.BACKUP!.list({ prefix: 'career-details/production/eligible/' })
    ).objects.map((o) => o.key);
    const result = await runCareerRetention(env(), later);
    expect(result.orphanObjects).toBeGreaterThan(0);
    expect(
      (await ctx.env.BACKUP!.list({ prefix: 'career-details/production/eligible/' })).objects.map(
        (o) => o.key,
      ),
    ).toEqual(expect.arrayContaining(previousKeys));
    expect(await ctx.env.BACKUP!.head(key)).toBeNull();
  });
});
