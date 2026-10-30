import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { createApp } from '../app.js';
import { issueCookie } from '../test/http.js';
import { createDb } from '../db/client.js';
import { listPublicHof } from '../db/repos/careers.js';
import { squadOf } from '../routes/seasonRecap.js';
import {
  BACKUP_LAST_KEY,
  BACKUP_PAGE_BYTES,
  BACKUP_PAGE_PAUSE_MS,
  BACKUP_STATE_KEY,
  backupKey,
  backupToR2,
  chunkKey,
  gzipToR2,
} from './backup.js';
import { runSeasonEventsArchive, EVENT_ARCHIVE_META_KEY } from './seasonEventsArchive.js';
import {
  assessInfraHealth,
  D1_LIMIT_BYTES,
  INFRA_HEALTH_META_KEY,
  runInfraHealth,
} from './infraHealth.js';
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
  await run('DELETE FROM app_meta WHERE key = ?1', INFRA_HEALTH_META_KEY);
  await run("UPDATE careers SET status='active',legend_score=NULL,retired_at=NULL WHERE id='own'");
  await run("DELETE FROM app_meta WHERE key LIKE 'cron:season-events:%'");
  await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
});
/** 끝난 백업 기록과 그 마지막 조각 객체 — 점검이 R2 HEAD로 확인한다. */
async function completedBackup(key: string, finishedAt: number) {
  await run(
    'INSERT OR REPLACE INTO app_meta(key,value) VALUES (?1,?2)',
    BACKUP_LAST_KEY,
    JSON.stringify({ key, chunks: 1, finishedAt, day: key.slice(-11, -1) }),
  );
  await ctx.env.BACKUP!.put(chunkKey(key, 1), 'completed test backup');
}
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
      // T-11-274 백업 조각은 put으로 올린다.
      if (key === 'put')
        return async (...args: Parameters<R2Bucket['put']>) => {
          await hook();
          return target.put(...args);
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
    for (const key of ['club_ids_backfill', 'career_values_backfill'])
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
    const reads: number[] = [];
    const wrap = (stmt: D1PreparedStatement, query: string): D1PreparedStatement =>
      new Proxy(stmt, {
        get(target, key) {
          if (key === 'bind') return (...args: unknown[]) => wrap(target.bind(...args), query);
          if (key === 'raw')
            return async (options: { columnNames?: boolean }) => {
              if (query.includes('WITH candidates') && query.includes('large_backup_fixture')) {
                expect(query).toContain('octet_length("body")');
                expect(query).not.toContain('CAST(');
                reads.push(Date.now());
              }
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
    expect(result.chunks).toBe(1);
    const object = await ctx.env.BACKUP!.get(chunkKey(result.key, 1));
    const dump = gunzipSync(new Uint8Array(await object!.arrayBuffer())).toString();
    expect(dump.match(/INSERT INTO "large_backup_fixture"/g)).toHaveLength(14);
    expect(dump).toContain("X'00ff27'");
    expect(dump).toContain("quote''가");
    expect(sizes.length).toBeGreaterThan(2);
    expect(Math.max(...sizes)).toBeLessThan(BACKUP_PAGE_BYTES + 2048);
    for (let i = 1; i < reads.length; i++)
      expect(reads[i]! - reads[i - 1]!).toBeGreaterThanOrEqual(BACKUP_PAGE_PAUSE_MS - 2);
    expect(result.pauseMs).toBe(result.pages * BACKUP_PAGE_PAUSE_MS);
    await run('DROP TABLE large_backup_fixture');
  }, 60_000);

  it('backup byte sizing preserves UTF-8, BLOB, null and numeric lengths without loading TEXT via CAST', async () => {
    await run('CREATE TABLE backup_sizing_fixture(body TEXT, bytes BLOB, n REAL, empty TEXT)');
    await run(
      'INSERT INTO backup_sizing_fixture VALUES (?1,?2,?3,NULL)',
      `가😀\0${'wide'.repeat(100_000)}`,
      new Uint8Array([0, 255, 39]).buffer,
      -123.5,
    );
    const { results } = await ctx.env.DB.prepare(
      `SELECT octet_length(body) AS text_new, length(CAST(body AS BLOB)) AS text_old,
              octet_length(bytes) AS blob_new, length(CAST(bytes AS BLOB)) AS blob_old,
              octet_length(n) AS number_new, length(CAST(n AS BLOB)) AS number_old,
              coalesce(octet_length(empty),0) AS null_new
       FROM backup_sizing_fixture`,
    ).all<Record<string, number>>();
    expect(results[0]).toEqual({
      text_new: 400008,
      text_old: 400008,
      blob_new: 3,
      blob_old: 3,
      number_new: 6,
      number_old: 6,
      null_new: 0,
    });
    await run('DROP TABLE backup_sizing_fixture');
  });

  it('a concurrent backup cannot open a second upload; completion releases the lease', async () => {
    let opened!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      opened = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = backupToR2(
      ctx.env.DB,
      bucketWithHook(async () => {
        opened();
        await gate;
      }),
      'backup-lease',
      NOW,
    );
    await ready;
    try {
      await expect(backupToR2(ctx.env.DB, ctx.env.BACKUP!, 'backup-lease', NOW)).rejects.toThrow(
        'D1 backup already running',
      );
    } finally {
      release();
    }
    await first;
    expect(
      await ctx.env.DB.prepare("SELECT value FROM app_meta WHERE key='cron:backup:lease'").first(),
    ).toBeNull();
    expect(await ctx.env.BACKUP!.head(chunkKey(backupKey('backup-lease', NOW), 1))).not.toBeNull();
  });

  it('an expired backup lease recovers; upload failure releases it and preserves the completed object', async () => {
    const key = 'd1/backup-failure/2026-10-06/0001.sql.gz';
    await ctx.env.BACKUP!.put(key, 'previous completed backup');
    await run(
      "INSERT INTO app_meta(key,value) VALUES ('cron:backup:lease',?1)",
      JSON.stringify({ token: 'crashed', expiresAt: Date.now() - 1 }),
    );
    const failing = bucketWithHook(async () => {
      throw new Error('upload unavailable');
    });
    await expect(backupToR2(ctx.env.DB, failing, 'backup-failure', NOW)).rejects.toThrow(
      'upload unavailable',
    );
    expect(
      await ctx.env.DB.prepare("SELECT value FROM app_meta WHERE key='cron:backup:lease'").first(),
    ).toBeNull();
    expect(await (await ctx.env.BACKUP!.get(key))!.text()).toBe('previous completed backup');
  });

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
      JSON.stringify({ ts: new Date(NOW).toISOString(), level: 'info' }),
    );
    await run(
      'INSERT OR REPLACE INTO app_meta(key,value) VALUES (?1,?2)',
      EVENT_ARCHIVE_META_KEY,
      JSON.stringify({ at: NOW }),
    );
    await completedBackup('d1/production/2026-10-07/', NOW - 3_600_000);
    const health = await runInfraHealth(env(), NOW);
    expect(health!.sizeBytes).toBeGreaterThan(0);
    expect(health!.issues).toEqual([]);
    expect(await runInfraHealth(env(), NOW + 300_000)).toBeNull();
    await ctx.env.BACKUP!.delete('d1/production/2026-10-07/0001.sql.gz');
    expect((await runInfraHealth(env(), NOW + 3_600_000))!.issues).toContain(
      'backup-object-missing-or-unavailable',
    );
    // 조각 이어받기가 6시간 넘게 끝나지 않으면 막힌 것으로 본다.
    await run(
      'INSERT OR REPLACE INTO app_meta(key,value) VALUES (?1,?2)',
      BACKUP_STATE_KEY,
      JSON.stringify({ day: '2026-10-07', startedAt: NOW - 7 * 3_600_000 }),
    );
    expect((await runInfraHealth(env(), NOW + 2 * 3_600_000))!.issues).toContain('backup-stalled');
    // 끝난 백업이 30시간보다 오래됐으면 완료 기록이 있어도 경보.
    const stale = assessInfraHealth(
      NOW,
      1000,
      [],
      { ts: new Date(NOW).toISOString(), level: 'info' },
      { at: NOW },
      true,
      {
        last: { key: 'd1/production/2026-10-06/', chunks: 3, finishedAt: NOW - 31 * 3_600_000 },
        inProgress: null,
      },
    );
    expect(stale.issues).toEqual(['backup-not-completed']);
    const forecast = assessInfraHealth(
      NOW,
      D1_LIMIT_BYTES * 0.5,
      [{ at: NOW - DAY_MS, sizeBytes: D1_LIMIT_BYTES * 0.45 }],
      { ts: new Date(NOW).toISOString(), level: 'error' },
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

describe('infrastructure report cadence', () => {
  const report = async () => {
    const row = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?1')
      .bind(INFRA_HEALTH_META_KEY)
      .first<{ value: string }>();
    return row ? JSON.parse(row.value) : null;
  };

  it.each([23_000, 52_000])(
    'records off-second cron timestamps (%i ms) once per UTC hour',
    async (offset) => {
      const at = NOW + offset;
      const first = await runInfraHealth(env(), at);
      expect(first?.at).toBe(at);
      expect(first?.samples).toHaveLength(1);
      expect(await runInfraHealth(env(), at)).toBeNull();
      expect(await runInfraHealth(env(), at + 300_000)).toBeNull();
      expect(await runInfraHealth(env(), NOW - 300_000)).toBeNull();
      const next = await runInfraHealth(env(), NOW + 3_600_000 + 52_000);
      expect(next?.samples).toHaveLength(2);
      expect((await report()).at).toBe(next?.at);
    },
  );

  it('catches up on the next tick after missing several hours without inventing samples', async () => {
    await runInfraHealth(env(), NOW + 23_000);
    const next = await runInfraHealth(env(), NOW + 3 * 3_600_000 + 300_000 + 52_000);
    expect(next?.samples).toHaveLength(2);
    expect(next?.growthBytesPerDay).toBeNull();
  });

  it('a failed report write preserves the prior hour and retries within the failed hour', async () => {
    const prior = await runInfraHealth(env(), NOW + 23_000);
    const DB = new Proxy(ctx.env.DB, {
      get(target, key) {
        if (key === 'prepare')
          return (sql: string) => {
            if (sql.startsWith('INSERT INTO app_meta')) throw new Error('report write unavailable');
            return target.prepare(sql);
          };
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const at = NOW + 3_600_000 + 23_000;
    await expect(runInfraHealth({ ...env(), DB }, at)).rejects.toThrow('report write unavailable');
    expect(await report()).toEqual(prior);
    const retried = await runInfraHealth(env(), at + 300_000);
    expect(retried?.samples).toHaveLength(2);
    expect((await report()).at).toBe(at + 300_000);
  });

  it('concurrent invocations commit exactly one report and cannot overwrite a newer hour', async () => {
    await run(
      'INSERT OR REPLACE INTO app_meta(key,value) VALUES (?1,?2)',
      DAILY_META_KEY,
      JSON.stringify({ ts: new Date(NOW).toISOString(), level: 'info' }),
    );
    await completedBackup('d1/production/2026-10-07/', NOW - 3_600_000);
    const race = async (times: number[]) => {
      let ready!: () => void;
      let release!: () => void;
      const arrived = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let calls = 0;
      const BACKUP = new Proxy(ctx.env.BACKUP!, {
        get(target, key) {
          if (key === 'head')
            return async () => {
              calls++;
              if (calls === times.length) ready();
              await gate;
              return null;
            };
          const value = Reflect.get(target, key) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const pending = times.map((at) => runInfraHealth({ ...env(), BACKUP }, at));
      await arrived;
      return { pending, release };
    };
    const sameHour = await race([NOW + 23_000, NOW + 52_000]);
    sameHour.release();
    const results = await Promise.all(sameHour.pending);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await report()).samples).toHaveLength(1);

    // Hold an old-hour invocation in R2 while a new-hour invocation commits.
    const old = await race([NOW + 3_600_000 + 23_000]);
    const newest = await runInfraHealth(env(), NOW + 2 * 3_600_000 + 52_000);
    old.release();
    expect(await old.pending[0]).toBeNull();
    expect(await report()).toEqual(newest);
    expect(newest?.samples).toHaveLength(2);
  });

  it('does not access D1 outside production', async () => {
    const { DB, seen } = spyDb(ctx.env.DB);
    expect(await runInfraHealth({ ...env(), DB, ENVIRONMENT: 'staging' }, NOW + 23_000)).toBeNull();
    expect(seen).toEqual([]);
  });
});
