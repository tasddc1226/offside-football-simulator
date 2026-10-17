import { gunzipSync } from 'node:zlib';
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import type { Bindings } from '../env.js';
import {
  BACKUP_LAST_KEY,
  BACKUP_STATE_KEY,
  backupDay,
  backupKey,
  backupToR2,
  chunkKey,
  fixedParts,
  runBackupStep,
  type BackupResult,
  type BackupState,
} from './backup.js';
import { cleanupExpired } from './cleanup.js';
import { DAILY_META_KEY, runDaily } from './daily.js';
import { archiveGrowth, KEEP_DAYS } from './growthArchive.js';

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
const meta = async <T>(key: string): Promise<T | null> => {
  const row = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?1')
    .bind(key)
    .first<{ value: string }>();
  return row ? (JSON.parse(row.value) as T) : null;
};
/** 접두사 아래 조각을 번호 순으로 풀어 이어 붙인 SQL — 한 파일로 받았을 때와 같다. */
async function dumpOf(bucket: R2Bucket, prefix: string): Promise<{ sql: string; chunks: number }> {
  const keys = (await bucket.list({ prefix })).objects.map((o) => o.key).sort();
  let sql = '';
  for (const key of keys) {
    const obj = await bucket.get(key);
    expect(obj!.httpMetadata?.contentEncoding).toBe('gzip');
    sql += gunzipText(await obj!.arrayBuffer());
  }
  return { sql, chunks: keys.length };
}

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
  it('만료된 멱등 키·지난 시도 기록·만료된 지 한 달 넘은 세션만 지운다', async () => {
    const idem = `INSERT INTO idempotency (owner_profile_id, key, request_hash, response_status, response_body, created_at, expires_at) VALUES ('prf_1', ?1, 'h', 200, '{}', ?2, ?3)`;
    await run(idem, 'old', ago(2 * DAY), ago(HOUR));
    await run(idem, 'live', ago(HOUR), later(HOUR));
    const att = `INSERT INTO auth_attempts (id, kind, subject, window_start, count) VALUES (?1, 'GOOGLE_START', ?1, ?2, 1)`;
    await run(att, 'att_old', ago(2 * DAY));
    await run(att, 'att_new', ago(HOUR));
    const ses = `INSERT INTO sessions (id, profile_id, channel, token_hash, created_at, expires_at, revoked_at, last_seen_at) VALUES (?1, 'prf_1', 'web', ?1, ?2, ?3, ?4, ?2)`;
    await run(ses, 'ses_expired_long_ago', ago(90 * DAY), ago(40 * DAY), null);
    await run(ses, 'ses_revoked_not_expired', ago(90 * DAY), later(DAY), ago(40 * DAY));
    await run(ses, 'ses_expired_recently', ago(40 * DAY), ago(DAY), null);
    await run(ses, 'ses_live', ago(DAY), later(DAY), null);
    const tkt = `INSERT INTO app_auth_tickets (id, session_id, challenge, code_verifier, expires_at) VALUES (?1, 'ses_live', 'c', 'v', ?2)`;
    await run(tkt, 'tkt_old', ago(2 * DAY));
    await run(tkt, 'tkt_new', ago(HOUR));
    const rep = `INSERT INTO chat_reports (message_id, profile_id, reason, author_profile_id, nickname, body, created_at) VALUES (?1, 'prf_1', 'spam', 'prf_2', 'n', 'b', ?2)`;
    await run(rep, 'msg_old', ago(91 * DAY));
    await run(rep, 'msg_new', ago(89 * DAY));
    const mute = `INSERT INTO chat_mutes (profile_id, until, created_at) VALUES (?1, ?2, ?2)`;
    await run(mute, 'prf_done', ago(HOUR));
    await run(mute, 'prf_muted', later(DAY));
    const tr = `INSERT INTO translations (key, text, created_at) VALUES (?1, 't', ?2)`;
    await run(tr, 'tr_old', ago(31 * DAY));
    await run(tr, 'tr_new', ago(29 * DAY));

    expect(await cleanupExpired(ctx.env.DB, NOW)).toEqual({
      push_news_events: 0,
      notifications: 0,
      push_deliveries: 0,
      push_devices: 0,
      idempotency: 1,
      auth_attempts: 1,
      sessions: 1,
      app_auth_tickets: 1,
      chat_reports: 1,
      chat_mutes: 1,
      translations: 1,
      api_status_buckets: 0,
      client_errors: 0,
    });
    expect(await count('translations')).toBe(1);
    expect(await count('chat_reports')).toBe(1);
    expect(await count('chat_mutes')).toBe(1);
    expect(await count('app_auth_tickets')).toBe(1);
    expect(await count('idempotency')).toBe(1);
    expect(await count('auth_attempts')).toBe(1);
    const left = await ctx.env.DB.prepare('SELECT id FROM sessions ORDER BY id').all<{
      id: string;
    }>();
    expect(left.results.map((r) => r.id)).toEqual([
      'ses_expired_recently',
      'ses_live',
      'ses_revoked_not_expired',
    ]);
  });
});

describe('T-10-070 D1 → R2 백업', () => {
  it('SQL(gzip)로 올리고, 빈 D1에 그대로 실행하면 같은 데이터가 된다', async () => {
    const evidence = JSON.stringify({
      clubId: 'pl-0',
      club: '구단',
      number: 10,
      grantedAt: '2026-09-28T00:00:00.000Z',
    });
    await ctx.env.DB.prepare(
      "INSERT INTO careers (id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at, wall_of_honor_json) VALUES ('honor', 'prf_1', 'FW', '오른발', 'poacher', 'late', 2026, 'retired', '1.0.0', '2026-09-28', '2026-09-28', ?)",
    )
      .bind(evidence)
      .run();
    const r = await backupToR2(ctx.env.DB, bucket(), 'restore', NOW);
    expect(r.key).toBe('d1/restore/2026-09-28/');
    expect(r.rows).toBeGreaterThan(0);
    expect(r.chunks).toBe(1);

    const { sql } = await dumpOf(bucket(), r.key);
    expect(sql).toContain('PRAGMA defer_foreign_keys = true;');
    expect(sql).toContain(`INSERT INTO "profiles"`);
    expect(sql).not.toContain('__rowid');

    // 빈 D1(마이그레이션 없음)에 복구한다.
    const fresh = await createTestD1({ migrate: false });
    try {
      for (const stmt of splitSqlQuery(sql)) {
        if (stmt.trim()) await fresh.env.DB.prepare(stmt).run();
      }
      expect(
        await fresh.env.DB.prepare(
          "SELECT wall_of_honor_json FROM careers WHERE id = 'honor'",
        ).first(),
      ).toEqual({ wall_of_honor_json: evidence });
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

  // T-11-088 로컬 R2는 조각 크기를 검사하지 않고 로컬 gzip은 조각 경계에 딱 맞게 나와서, 운영처럼 들쭉날쭉한
  // 덩어리를 직접 넣어 본다. 운영 R2는 마지막 말고 크기가 다른 조각이 있으면 complete를 거부한다.
  it('조각은 마지막 말고 모두 같은 크기로 자른다', async () => {
    const chunks = [7, 3, 11, 1, 9, 5].map((n, i) => new Uint8Array(n).fill(i));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((x) => c.enqueue(x));
        c.close();
      },
    });
    const parts: Blob[] = [];
    for await (const p of fixedParts(stream, 8)) parts.push(p);
    expect(parts.map((p) => p.size)).toEqual([8, 8, 8, 8, 4]);
    const joined = new Uint8Array(await new Blob(parts).arrayBuffer());
    expect([...joined]).toEqual(chunks.flatMap((x) => [...x]));
  });

  // T-11-274 조각 상한을 1MiB로 낮춰 여러 객체로 갈라지게 한다. 번호 순으로 이으면 한 파일과 같다.
  it('큰 DB는 조각 객체 여러 개로 나눠 올린다', { timeout: 60_000 }, async () => {
    // 압축이 잘 안 되는 값으로 압축 후 조각 상한을 넘긴다.
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
      const r = await backupToR2(big.env.DB, big.env.BACKUP!, 'big', NOW, {
        chunkBytes: 1024 * 1024,
      });
      expect(r.bytes).toBeGreaterThan(8 * 1024 * 1024);
      expect(r.chunks).toBeGreaterThan(3);
      const { sql, chunks } = await dumpOf(big.env.BACKUP!, r.key);
      expect(chunks).toBe(r.chunks);
      expect(sql.match(/^INSERT INTO "profiles"/gm)).toHaveLength(320);
      // 마지막 조각만 인덱스를 만든다 — 조각마다 완전한 SQL이지만 순서대로 실행해야 한다.
      const last = gunzipText(
        await (await big.env.BACKUP!.get(chunkKey(r.key, r.chunks)))!.arrayBuffer(),
      );
      expect(last).toContain('CREATE INDEX');
      const first = gunzipText(
        await (await big.env.BACKUP!.get(chunkKey(r.key, 1)))!.arrayBuffer(),
      );
      expect(first).toContain('PRAGMA defer_foreign_keys = true;');
      expect(first).not.toContain('CREATE INDEX');
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
      chunkKey(backupKey('test', NOW), 1),
    ]);
  });

  it('T-11-274 5분 cron이 한 번에 한 조각씩 이어받고, 끝나면 기록을 남기며 같은 날은 다시 시작하지 않는다', async () => {
    await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
    const at = NOW + 60_000;
    // 예산 0ms: 단계마다 페이지 하나만 읽고 조각을 닫는다.
    const steps: Awaited<ReturnType<typeof runBackupStep>>[] = [];
    for (let i = 0; i < 500; i++) {
      const r = await runBackupStep(ctx.env.DB, bucket(), 'step', at + i * 300_000, { stepMs: 0 });
      steps.push(r);
      if (r!.done) break;
      const state = await meta<BackupState>(BACKUP_STATE_KEY);
      expect(state).toMatchObject({ day: '2026-09-28', chunk: r!.chunk, rows: r!.rows });
    }
    expect(steps.length).toBeGreaterThan(3);
    expect(steps.at(-1)).toMatchObject({ done: true, day: '2026-09-28' });
    expect(await meta(BACKUP_STATE_KEY)).toBeNull();
    const last = (await meta<BackupResult>(BACKUP_LAST_KEY))!;
    expect(last).toMatchObject({
      key: 'd1/step/2026-09-28/',
      day: '2026-09-28',
      steps: steps.length,
    });
    expect(last.chunks).toBe(steps.length);
    expect(last.finishedAt).toBeGreaterThanOrEqual(last.startedAt);
    // 이어 붙이면 한 번에 만든 백업과 같은 SQL이다(머리글과, 백업 진행 상태가 담기는 app_meta 행만 빼고).
    const { sql, chunks } = await dumpOf(bucket(), last.key);
    expect(chunks).toBe(last.chunks);
    const whole = await backupToR2(ctx.env.DB, bucket(), 'whole', at);
    const body = (s: string) =>
      s
        .split('\n')
        .filter(
          (l) => !l.startsWith('-- offside D1 backup') && !l.startsWith('INSERT INTO "app_meta"'),
        )
        .join('\n');
    expect(body(sql)).toBe(body((await dumpOf(bucket(), whole.key)).sql));
    expect(sql.match(/^INSERT INTO "profiles"/gm)!.length).toBeGreaterThan(0);
    // 그날 백업이 끝났으면 같은 날 안에서는 할 일이 없고, UTC 19:00을 넘긴 다음 날 첫 틱에 새로 시작한다.
    expect(await runBackupStep(ctx.env.DB, bucket(), 'step', at + 20 * HOUR)).toBeNull();
    expect(backupDay(at + 20 * HOUR)).toBe('2026-09-28');
    const fresh = await runBackupStep(ctx.env.DB, bucket(), 'step', at + DAY, { stepMs: 0 });
    expect(fresh).toMatchObject({ day: '2026-09-29', chunk: 1 });
    await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
  });

  it('T-11-274 조각 업로드가 실패하면 위치를 바꾸지 않아 다음 단계가 같은 조각을 다시 만든다. 잠금이 있으면 건너뛴다', async () => {
    await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
    const first = await runBackupStep(ctx.env.DB, bucket(), 'redo', NOW, { stepMs: 0 });
    expect(first).toMatchObject({ chunk: 1, done: false });
    const before = await meta<BackupState>(BACKUP_STATE_KEY);
    const failing = new Proxy(bucket(), {
      get(target, key) {
        if (key === 'put') return () => Promise.reject(new Error('r2 down'));
        const value = Reflect.get(target, key) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(
      runBackupStep(ctx.env.DB, failing, 'redo', NOW + 300_000, { stepMs: 0 }),
    ).rejects.toThrow('r2 down');
    expect(await meta(BACKUP_STATE_KEY)).toEqual(before);
    expect(await meta('cron:backup:lease')).toBeNull();
    expect(await bucket().head(chunkKey(before!.key, 2))).toBeNull();
    // 다른 호출이 잠금을 쥐고 있으면 이번 틱은 건너뛴다.
    await run(
      "INSERT INTO app_meta(key,value) VALUES ('cron:backup:lease',?1)",
      JSON.stringify({ token: 'busy', expiresAt: Date.now() + 60_000 }),
    );
    expect(
      await runBackupStep(ctx.env.DB, bucket(), 'redo', NOW + 600_000, { stepMs: 0 }),
    ).toBeNull();
    await run("DELETE FROM app_meta WHERE key = 'cron:backup:lease'");
    const redo = await runBackupStep(ctx.env.DB, bucket(), 'redo', NOW + 600_000, { stepMs: 0 });
    expect(redo).toMatchObject({ chunk: 2 });
    expect(await bucket().head(chunkKey(before!.key, 2))).not.toBeNull();
    await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
  });

  it('R2 바인딩이 없어도 정리·보관 단계는 돈다(백업은 5분 cron 몫)', async () => {
    const noBackup: Bindings = { ...ctx.env };
    delete noBackup.BACKUP;
    const r = await runDaily(noBackup, NOW);
    expect(r).not.toHaveProperty('backup');
    expect(r.growthArchive).toBe('skipped');
    expect(r.cleanup).not.toHaveProperty('error');
    expect(r.anomalies).not.toHaveProperty('error');
  });

  it('T-11-082 마지막 결과를 app_meta에 남긴다', async () => {
    await runDaily(ctx.env, NOW);
    const row = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?1')
      .bind(DAILY_META_KEY)
      .first<{ value: string }>();
    expect(JSON.parse(row!.value)).toMatchObject({ job: 'daily', level: 'info' });
  });

  it('T-11-082 단계가 실패하면 결과를 남긴 뒤 실행을 실패로 끝낸다', async () => {
    // 옮길 성장 기록을 하나 두고 R2를 끊는다 — 성장 기록 이관 단계가 실패한다.
    await run(
      `INSERT INTO careers (id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at)
       VALUES ('car_fail', 'prf_1', 'FW', '오른발', 't', 't', 2026, 'active', 'test', ?1, ?1)`,
      ago(60 * DAY),
    );
    await run(
      `INSERT INTO career_seasons (career_id, year, age, club, league, apps, goals, assists, rating, rank, ovr, honors_json, mil, events_json, growth_json, created_at)
       VALUES ('car_fail', 2026, 18, 'c', 'l', 1, 0, 0, 6.5, '1', 60, '[]', 0, '[]', '{"v":1}', ?1)`,
      ago(30 * DAY),
    );
    const broken = {
      createMultipartUpload: () => Promise.reject(new Error('r2 down')),
    } as unknown as R2Bucket;
    try {
      await expect(runDaily({ ...ctx.env, BACKUP: broken }, NOW)).rejects.toThrow(
        'daily job failed',
      );
      const row = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?1')
        .bind(DAILY_META_KEY)
        .first<{ value: string }>();
      expect(JSON.parse(row!.value)).toMatchObject({
        level: 'error',
        growthArchive: { error: 'r2 down' },
      });
    } finally {
      await run("DELETE FROM career_seasons WHERE career_id = 'car_fail'");
      await run("DELETE FROM careers WHERE id = 'car_fail'");
    }
  });
});

describe('T-11-100 오래된 성장 기록을 R2로 옮기기', () => {
  it('KEEP_DAYS 지난 시즌의 성장 기록만 NDJSON으로 올리고 D1에서 비운다. 다시 돌면 할 일이 없다', async () => {
    await run(
      `INSERT INTO careers (id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at)
       VALUES ('car_g', 'prf_1', 'FW', '오른발', 't', 't', 2026, 'active', 'test', ?1, ?1)`,
      ago(60 * DAY),
    );
    const season = (year: number, createdAt: string, growth: string | null) =>
      run(
        `INSERT INTO career_seasons (career_id, year, age, club, league, apps, goals, assists, rating, rank, ovr, honors_json, mil, events_json, growth_json, created_at)
         VALUES ('car_g', ?1, ?2, 'c', 'l', 1, 0, 0, 6.5, '1', 60, '[]', 0, '[]', ?3, ?4)`,
        year,
        year - 2008,
        growth,
        createdAt,
      );
    const g = (o0: number) => JSON.stringify({ v: 1, o0, ph: [o0], s0: [1.5, 2], s1: [2, 3] });
    const old = ago((KEEP_DAYS + 10) * DAY);
    await season(2026, old, g(55));
    await season(2027, old, g(56)); // 같은 시각
    await season(2028, ago((KEEP_DAYS + 1) * DAY), g(57));
    await season(2029, ago((KEEP_DAYS + 1) * DAY), null); // 성장 기록 없음
    await season(2030, ago(DAY), g(60)); // 아직 보관 기간 안

    const r = await archiveGrowth(ctx.env.DB, bucket(), 'test', NOW);
    expect(r).toMatchObject({ rows: 3 });
    const lines = gunzipText(await (await bucket().get(r.key!))!.arrayBuffer())
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { careerId: string; year: number; growth: { o0: number } });
    expect(lines.map((l) => [l.careerId, l.year, l.growth.o0])).toEqual([
      ['car_g', 2026, 55],
      ['car_g', 2027, 56],
      ['car_g', 2028, 57],
    ]);
    const { results } = await ctx.env.DB.prepare(
      `SELECT year, growth_json IS NOT NULL AS has FROM career_seasons WHERE career_id = 'car_g' ORDER BY year`,
    ).all<{ year: number; has: number }>();
    expect(results.map((x) => [x.year, x.has])).toEqual([
      [2026, 0],
      [2027, 0],
      [2028, 0],
      [2029, 0],
      [2030, 1],
    ]);
    // 같은 날 다시 돌면 옮길 행이 없다(이미 올린 파일도 덮어쓰지 않는다).
    expect(await archiveGrowth(ctx.env.DB, bucket(), 'test', NOW)).toMatchObject({
      key: null,
      rows: 0,
    });
    // 옮긴 뒤 옛 시즌이 성장 기록과 함께 다시 올라오면 다음 실행이 다시 옮긴다.
    await run(
      `UPDATE career_seasons SET growth_json = ?1 WHERE career_id = 'car_g' AND year = 2026`,
      g(58),
    );
    const again = await archiveGrowth(ctx.env.DB, bucket(), 'test', NOW + 1);
    expect(again.rows).toBe(1);
    expect((await bucket().list({ prefix: 'growth/test/' })).objects).toHaveLength(2);
  });
});
