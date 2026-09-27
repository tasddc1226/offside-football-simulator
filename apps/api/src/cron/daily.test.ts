import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy, unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import type { Bindings } from '../env.js';
import { backupKey, backupToR2 } from './backup.js';
import { cleanupExpired } from './cleanup.js';
import { runDaily } from './daily.js';

const NOW = Date.parse('2026-09-28T19:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const later = (ms: number) => new Date(NOW + ms).toISOString();
const HOUR = 60 * 60 * 1000;
const gunzipText = (buf: ArrayBuffer) => new TextDecoder().decode(gunzipSync(new Uint8Array(buf)));
/** 압축이 잘 안 되는 값(무작위 40KB base64). */
const noise = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(30_000))));
const DAY = 24 * HOUR;

let ctx: TestD1;
/** 로컬 R2(Miniflare, wrangler.jsonc 최상위 r2_buckets). */
const bucket = () => ctx.env.BACKUP!;
const run = (sql: string, ...args: unknown[]) =>
  ctx.env.DB.prepare(sql)
    .bind(...args)
    .run();
const count = async (table: string) =>
  (await ctx.env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())!.n;

beforeAll(async () => {
  ctx = await createTestD1();
  await run(
    `INSERT INTO profiles (id, settings_json, created_at, last_seen_at, nickname) VALUES (?1, '{}', ?2, ?2, ?3)`,
    'prf_1',
    ago(DAY),
    'it\'s "me"',
  );
});
afterAll(() => ctx.dispose());

describe('T-10-070 매일 정리', () => {
  it('만료된 멱등 키·지난 시도 기록·오래된 만료 세션만 지운다', async () => {
    const idem = `INSERT INTO idempotency (owner_profile_id, key, request_hash, response_status, response_body, created_at, expires_at) VALUES ('prf_1', ?1, 'h', 200, '{}', ?2, ?3)`;
    await run(idem, 'old', ago(2 * DAY), ago(HOUR));
    await run(idem, 'live', ago(HOUR), later(HOUR));
    const att = `INSERT INTO auth_attempts (id, kind, subject, window_start, count) VALUES (?1, 'GOOGLE_START', ?1, ?2, 1)`;
    await run(att, 'att_old', ago(2 * DAY));
    await run(att, 'att_new', ago(HOUR));
    const ses = `INSERT INTO sessions (id, profile_id, channel, token_hash, created_at, expires_at, revoked_at, last_seen_at) VALUES (?1, 'prf_1', 'web', ?1, ?2, ?3, ?4, ?2)`;
    await run(ses, 'ses_expired_long_ago', ago(90 * DAY), ago(40 * DAY), null);
    await run(ses, 'ses_revoked_long_ago', ago(90 * DAY), later(DAY), ago(40 * DAY));
    await run(ses, 'ses_expired_recently', ago(40 * DAY), ago(DAY), null);
    await run(ses, 'ses_live', ago(DAY), later(DAY), null);

    expect(await cleanupExpired(ctx.env.DB, NOW)).toEqual({
      idempotency: 1,
      auth_attempts: 1,
      sessions: 2,
    });
    expect(await count('idempotency')).toBe(1);
    expect(await count('auth_attempts')).toBe(1);
    const left = await ctx.env.DB.prepare('SELECT id FROM sessions ORDER BY id').all<{
      id: string;
    }>();
    expect(left.results.map((r) => r.id)).toEqual(['ses_expired_recently', 'ses_live']);
  });
});

describe('T-10-070 D1 → R2 백업', () => {
  it('SQL(gzip)로 올리고, 빈 D1에 그대로 실행하면 같은 데이터가 된다', async () => {
    const r = await backupToR2(ctx.env.DB, bucket(), 'restore', NOW);
    expect(r.key).toBe('d1/restore/2026-09-28.sql.gz');
    expect(r.rows).toBeGreaterThan(0);

    const obj = await bucket().get(r.key);
    expect(obj!.httpMetadata?.contentEncoding).toBe('gzip');
    const sql = gunzipText(await obj!.arrayBuffer());
    expect(sql).toContain('PRAGMA defer_foreign_keys = true;');
    expect(sql).toContain(`INSERT INTO "profiles"`);
    expect(sql).not.toContain('__rowid');

    // 빈 D1(마이그레이션 없음)에 복구한다.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const fresh = await getPlatformProxy<Bindings>({
      configPath: path.resolve(here, '../../wrangler.jsonc'),
      persist: false,
    });
    try {
      for (const stmt of splitSqlQuery(sql)) {
        if (stmt.trim()) await fresh.env.DB.prepare(stmt).run();
      }
      for (const t of ['profiles', 'sessions', 'idempotency', 'auth_attempts']) {
        const n = await fresh.env.DB.prepare(`SELECT count(*) AS n FROM ${t}`).first<{
          n: number;
        }>();
        expect(n!.n, t).toBe(await count(t));
      }
      const p = await fresh.env.DB.prepare(
        `SELECT nickname FROM profiles WHERE id = 'prf_1'`,
      ).first<{
        nickname: string;
      }>();
      expect(p!.nickname).toBe('it\'s "me"');
    } finally {
      await fresh.dispose();
    }
  });

  it('큰 DB는 여러 조각(멀티파트)으로 나눠 올린다', async () => {
    // 압축이 잘 안 되는 값으로 압축 후 8MiB(조각 크기)를 넘긴다.
    const big = await createTestD1();
    try {
      const stmt = big.env.DB.prepare(
        `INSERT INTO profiles (id, settings_json, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?3)`,
      );
      for (let b = 0; b < 8; b++) {
        await big.env.DB.batch(
          Array.from({ length: 40 }, (_, i) => stmt.bind(`prf_${b}_${i}`, noise(), ago(DAY))),
        );
      }
      const r = await backupToR2(big.env.DB, big.env.BACKUP!, 'big', NOW);
      expect(r.bytes).toBeGreaterThan(8 * 1024 * 1024);
      const obj = await big.env.BACKUP!.get(r.key);
      const sql = gunzipText(await obj!.arrayBuffer());
      expect(sql.match(/^INSERT INTO "profiles"/gm)).toHaveLength(320);
    } finally {
      await big.dispose();
    }
  });

  it('30일 지난 매일 백업은 지우고 매달 1일 백업은 남긴다', async () => {
    for (const day of ['2026-08-01', '2026-08-15', '2026-08-29', '2026-09-20'])
      await bucket().put(`d1/test/${day}.sql.gz`, '');
    await bucket().put('d1/other/2026-08-15.sql.gz', '');
    const r = await backupToR2(ctx.env.DB, bucket(), 'test', NOW);
    expect(r.pruned).toBe(1);
    const keys = async (prefix: string) =>
      (await bucket().list({ prefix })).objects.map((o) => o.key);
    expect([...(await keys('d1/test/')), ...(await keys('d1/other/'))].sort()).toEqual([
      'd1/other/2026-08-15.sql.gz',
      'd1/test/2026-08-01.sql.gz',
      'd1/test/2026-08-29.sql.gz',
      'd1/test/2026-09-20.sql.gz',
      backupKey('test', NOW),
    ]);
  });

  it('R2 바인딩이 없으면 정리만 하고 백업은 건너뛴다', async () => {
    const noBackup: Bindings = { ...ctx.env };
    delete noBackup.BACKUP;
    const r = await runDaily(noBackup, NOW);
    expect(r.backup).toBe('skipped');
    expect(r.cleanup).not.toHaveProperty('error');
  });
});
