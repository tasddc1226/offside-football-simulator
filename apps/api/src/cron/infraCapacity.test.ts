import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { createApp } from '../app.js';
import { issueCookie } from '../test/http.js';
import { createDb } from '../db/client.js';
import { listPublicHof } from '../db/repos/careers.js';
import { squadOf } from '../routes/seasonRecap.js';
import { backupToR2, BACKUP_PAGE_BYTES, gzipToR2 } from './backup.js';
import { runSeasonEventsArchive, EVENT_ARCHIVE_META_KEY } from './seasonEventsArchive.js';
import { assessInfraHealth, D1_LIMIT_BYTES, runInfraHealth } from './infraHealth.js';
import { DAILY_META_KEY } from './daily.js';
import { DAY_MS } from '../time.js';

const NOW = Date.parse('2026-10-08T01:00:00Z');
const OLD = new Date(NOW - 8 * DAY_MS).toISOString();
let ctx: TestD1;
const run = (sql: string, ...params: unknown[]) =>
  ctx.env.DB.prepare(sql)
    .bind(...params)
    .run();
const env = () => ({ ...ctx.env, ENVIRONMENT: 'production' });
beforeAll(async () => {
  ctx = await createTestD1();
  await run(
    "INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('owner','{}',?1,?1),('others','{}',?1,?1)",
    OLD,
  );
  await run(
    `WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<400)
    INSERT INTO careers(id,profile_id,pos,foot,type,trait,start_year,status,app_version,created_at,updated_at,retired_at,retire_age,legend_score,service_season)
    SELECT 'other-'||x,'others','FW','right','poacher','late',2026,'retired','1',?1,?1,?1,30,100,0 FROM n`,
    OLD,
  );
  await run(
    `INSERT INTO careers(id,profile_id,pos,foot,type,trait,start_year,status,app_version,created_at,updated_at)
    VALUES ('own','owner','FW','right','poacher','late',2026,'active','1',?1,?1)`,
    OLD,
  );
});
afterAll(() => ctx.dispose());
beforeEach(async () => {
  await run('DELETE FROM career_seasons');
  await run("UPDATE careers SET status='active',legend_score=NULL,retired_at=NULL WHERE id='own'");
  await run("DELETE FROM app_meta WHERE key LIKE 'cron:season-events:%'");
});
const season = (year: number, events: string, at = OLD) =>
  run(
    `INSERT INTO career_seasons(career_id,year,age,club,league,apps,goals,assists,rating,rank,ovr,honors_json,events_json,signals_json,growth_json,mil,created_at)
   VALUES ('own',?1,18,'club','league',20,4,2,7,2,65,'[]',?2,'{"proof":true}','{"growth":true}',0,?3)`,
    year,
    events,
    at,
  );

function bucketWithHook(hook: () => Promise<void>) {
  return new Proxy(ctx.env.BACKUP!, {
    get(target, key) {
      if (key === 'createMultipartUpload')
        return async (...args: Parameters<R2Bucket['createMultipartUpload']>) => {
          await hook();
          return target.createMultipartUpload(...args);
        };
      const value = Reflect.get(target, key) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

describe('capacity safeguards', () => {
  it('owner recap searches the owner index rather than all retired careers and preserves decoded fields', async () => {
    await run(
      "UPDATE careers SET status='retired',retire_age=30,legend_score=500,retired_at=?1 WHERE id='own'",
      OLD,
    );
    const query = squadOf(ctx.db, 'owner', 0, new Date(NOW).toISOString());
    const compiled = query.toSQL();
    const plan = await ctx.env.DB.prepare(`EXPLAIN QUERY PLAN ${compiled.sql}`)
      .bind(...compiled.params)
      .all<{ detail: string }>();
    expect(plan.results.map((r) => r.detail).join('\n')).toContain(
      'careers_profile_status_legend_idx (profile_id=? AND status=?',
    );
    expect((await query).map((r) => ({ id: r.id, pos: r.pos }))).toEqual([
      { id: 'own', pos: 'FW' },
    ]);
    await run(
      "UPDATE careers SET status='active',legend_score=NULL,retired_at=NULL WHERE id='own'",
    );
  });

  it('HOF count uses a covering index and the result matches all eligible careers', async () => {
    const { DB, seen } = spyDb(ctx.env.DB);
    expect((await listPublicHof(createDb(DB), 3)).total).toBe(400);
    expect(
      seen.some((s) => s.includes('count(*)') && s.includes('INDEXED BY careers_hof_count_idx')),
    ).toBe(true);
    const plan = await ctx.env.DB.prepare(
      `EXPLAIN QUERY PLAN SELECT count(*) FROM careers INDEXED BY careers_hof_count_idx
      WHERE status='retired' AND hidden=0 AND legend_score IS NOT NULL AND retire_age>=25`,
    ).all<{ detail: string }>();
    expect(
      plan.results.some((r) => r.detail.includes('COVERING INDEX careers_hof_count_idx')),
    ).toBe(true);
  });

  it('public HOF anchors on primary before count while authenticated reads keep using primary', async () => {
    for (const key of ['club_ids_backfill', 'career_values_backfill', 'card_values_backfill'])
      await run("INSERT OR REPLACE INTO app_meta(key,value) VALUES (?1,'1')", key);
    const { cookie } = await issueCookie(ctx);
    const primary: string[] = [];
    const replica: string[] = [];
    const constraints: string[] = [];
    const DB = new Proxy(ctx.env.DB, {
      get(target, key) {
        if (key === 'prepare')
          return (query: string) => {
            primary.push(query);
            return target.prepare(query);
          };
        if (key === 'withSession')
          return (constraint: D1SessionConstraint) => {
            constraints.push(constraint);
            return new Proxy(target.withSession(constraint), {
              get(session, property) {
                if (property === 'prepare')
                  return (query: string) => {
                    replica.push(query);
                    return session.prepare(query);
                  };
                const value = Reflect.get(session, property) as unknown;
                return typeof value === 'function' ? value.bind(session) : value;
              },
            });
          };
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const app = createApp();
    expect((await app.request('/v1/hof', {}, { ...ctx.env, DB })).status).toBe(200);
    expect(constraints).toEqual(['first-primary']);
    expect(replica).toHaveLength(2);
    expect(replica[1]).toContain('count(*)');
    expect([...primary, ...replica].some((s) => s.includes('"sessions"'))).toBe(false);
    expect(
      (await app.request('/v1/owner/season-recap', { headers: { cookie } }, { ...ctx.env, DB }))
        .status,
    ).toBe(200);
    expect(primary.some((s) => s.includes('"sessions"'))).toBe(true);
    expect(constraints).toHaveLength(1);
    expect(
      (await app.request('/v1/hof', {}, { ...ctx.env, DB, D1_READ_SESSIONS_DISABLED: '1' })).status,
    ).toBe(200);
    expect(constraints).toHaveLength(1);
  });

  it('archives old active-career telemetry in bounded batches while keeping summaries/signals/growth and recent events', async () => {
    const events = JSON.stringify([{ text: '가'.repeat(80_000) }]);
    for (let i = 0; i < 12; i++) await season(2026 + i, events);
    await season(2040, '["recent"]', new Date(NOW).toISOString());
    const result = await runSeasonEventsArchive(env(), NOW);
    expect(result).toMatchObject({ archived: 12, raced: 0 });
    expect(result!.objects).toBeGreaterThan(1);
    const rows = (await ctx.env.DB.prepare('SELECT * FROM career_seasons ORDER BY year').all())
      .results;
    expect(
      rows
        .slice(0, 12)
        .every(
          (r) =>
            r.events_json === '[]' &&
            r.signals_json === '{"proof":true}' &&
            r.growth_json === '{"growth":true}' &&
            r.apps === 20,
        ),
    ).toBe(true);
    expect(rows.at(-1)!.events_json).toBe('["recent"]');
    const objects = await ctx.env.BACKUP!.list({ prefix: 'season-events/production/' });
    const archived = [];
    for (const object of objects.objects) {
      const content = await ctx.env.BACKUP!.get(object.key);
      archived.push(
        ...gunzipSync(new Uint8Array(await content!.arrayBuffer()))
          .toString()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line)),
      );
    }
    expect(archived).toHaveLength(12);
    expect(archived[0]).toMatchObject({ version: 1, careerId: 'own', events: JSON.parse(events) });
    expect(await runSeasonEventsArchive(env(), NOW + 300_000)).toBeNull();
  });

  it('R2 failure never clears events; a simultaneous upsert preserves the newer value', async () => {
    await season(2026, '["original"]');
    const failing = bucketWithHook(async () => {
      throw new Error('R2 unavailable');
    });
    await expect(runSeasonEventsArchive({ ...env(), BACKUP: failing }, NOW)).rejects.toThrow(
      'R2 unavailable',
    );
    expect(
      await ctx.env.DB.prepare('SELECT events_json FROM career_seasons').first('events_json'),
    ).toBe('["original"]');
    const racing = bucketWithHook(async () => {
      await run('UPDATE career_seasons SET events_json=\'["newer"]\'');
    });
    expect(await runSeasonEventsArchive({ ...env(), BACKUP: racing }, NOW)).toMatchObject({
      archived: 0,
      raced: 1,
    });
    expect(
      await ctx.env.DB.prepare('SELECT events_json FROM career_seasons').first('events_json'),
    ).toBe('["newer"]');
  });

  it('offloads a legacy escape-heavy single row without doubling the D1 binding value', async () => {
    const events = JSON.stringify([{ text: '"'.repeat(600_000) }]);
    await season(2026, events);
    expect(await runSeasonEventsArchive(env(), NOW)).toMatchObject({ archived: 1, raced: 0 });
    expect(
      await ctx.env.DB.prepare('SELECT events_json FROM career_seasons').first('events_json'),
    ).toBe('[]');
  });

  it('an active lease or emergency stop skips offload', async () => {
    await season(2026, '["keep"]');
    await run(
      "INSERT INTO app_meta(key,value) VALUES ('cron:season-events:lease',?1)",
      JSON.stringify({ token: 'busy', expiresAt: Date.now() + 60_000 }),
    );
    expect(await runSeasonEventsArchive(env(), NOW)).toBeNull();
    expect(
      await runSeasonEventsArchive({ ...env(), SEASON_EVENTS_ARCHIVE_DISABLED: '1' }, NOW),
    ).toBeNull();
  });

  it('backup bounds large multibyte/BLOB responses before RPC and includes every row', async () => {
    await run('CREATE TABLE large_backup_fixture(id INTEGER PRIMARY KEY, body TEXT, bytes BLOB)');
    const text = `quote'가${'가'.repeat(135_000)}`;
    for (let i = 1; i <= 14; i++)
      await run(
        'INSERT INTO large_backup_fixture VALUES (?1,?2,?3)',
        i,
        text,
        new Uint8Array([0, 255, 39]).buffer,
      );
    const sizes: number[] = [];
    const wrap = (stmt: D1PreparedStatement, query: string): D1PreparedStatement =>
      new Proxy(stmt, {
        get(target, key) {
          if (key === 'bind') return (...args: unknown[]) => wrap(target.bind(...args), query);
          if (key === 'raw')
            return async (options: { columnNames?: boolean }) => {
              const value = await target.raw<unknown[]>({ ...options, columnNames: true });
              if (query.includes('WITH candidates') && query.includes('large_backup_fixture'))
                sizes.push(new TextEncoder().encode(JSON.stringify(value)).length);
              return value;
            };
          const value = Reflect.get(target, key) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    const bounded = new Proxy(ctx.env.DB, {
      get(target, key) {
        if (key === 'prepare') return (query: string) => wrap(target.prepare(query), query);
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const result = await backupToR2(bounded, ctx.env.BACKUP!, 'capacity-test', NOW);
    const object = await ctx.env.BACKUP!.get(result.key);
    const dump = gunzipSync(new Uint8Array(await object!.arrayBuffer())).toString();
    expect(dump.match(/INSERT INTO "large_backup_fixture"/g)).toHaveLength(14);
    expect(dump).toContain("X'00ff27'");
    expect(dump).toContain("quote''가");
    expect(sizes.length).toBeGreaterThan(2);
    expect(Math.max(...sizes)).toBeLessThan(BACKUP_PAGE_BYTES + 2048);
    await run('DROP TABLE large_backup_fixture');
  }, 60_000);

  it('R2 part failure cancels a backpressured gzip producer and aborts the upload', async () => {
    const abort = vi.fn(async () => {});
    const bucket = {
      createMultipartUpload: async () => ({
        uploadPart: async () => {
          throw new Error('part failed');
        },
        abort,
      }),
    } as unknown as R2Bucket;
    await expect(
      gzipToR2(bucket, 'failure', 'text/plain', async (write) => {
        for (let i = 0; i < 500; i++) {
          const noise = btoa(
            String.fromCharCode(...crypto.getRandomValues(new Uint8Array(30_000))),
          );
          await write(noise);
        }
      }),
    ).rejects.toThrow('part failed');
    expect(abort).toHaveBeenCalledOnce();
  }, 10_000);

  it('hourly health uses supported D1 metadata and ignores partial-day growth estimates', async () => {
    await run(
      'INSERT OR REPLACE INTO app_meta(key,value) VALUES (?1,?2)',
      DAILY_META_KEY,
      JSON.stringify({
        ts: new Date(NOW).toISOString(),
        level: 'info',
        backup: { key: 'd1/production/2026-10-08.sql.gz' },
      }),
    );
    await run(
      'INSERT OR REPLACE INTO app_meta(key,value) VALUES (?1,?2)',
      EVENT_ARCHIVE_META_KEY,
      JSON.stringify({ at: NOW }),
    );
    expect(await runInfraHealth(env(), NOW + 300_000)).toBeNull();
    await ctx.env.BACKUP!.put('d1/production/2026-10-08.sql.gz', 'completed test backup');
    const health = await runInfraHealth(env(), NOW);
    expect(health!.sizeBytes).toBeGreaterThan(0);
    expect(health!.issues).toEqual([]);
    await ctx.env.BACKUP!.delete('d1/production/2026-10-08.sql.gz');
    expect((await runInfraHealth(env(), NOW))!.issues).toContain(
      'backup-object-missing-or-unavailable',
    );
    const forecast = assessInfraHealth(
      NOW,
      D1_LIMIT_BYTES * 0.5,
      [{ at: NOW - DAY_MS, sizeBytes: D1_LIMIT_BYTES * 0.45 }],
      { ts: new Date(NOW).toISOString(), level: 'error', backup: { error: 'redacted' } },
      null,
      true,
    );
    expect(forecast.daysToLimit).toBeCloseTo(10);
    expect(forecast.issues).toEqual([
      'd1-storage-less-than-30-days',
      'daily-job-failed',
      'backup-not-completed',
      'season-events-archive-stale',
    ]);
    expect(
      assessInfraHealth(NOW, 1000, [{ at: NOW - 300_000, sizeBytes: 1 }], null, null, false)
        .growthBytesPerDay,
    ).toBeNull();
  });
});
