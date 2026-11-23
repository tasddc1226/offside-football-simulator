import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
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
  latestManifestKey,
  manifestKey,
  partialUniqueKeys,
  singleUniqueKeys,
  runBackupStep,
  type BackupResult,
  type BackupState,
} from './backup.js';
import { BACKUP_CONTROL_KEY, setBackupControl } from './backupControl.js';
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
    // T-11-777 저장한 바이트 그대로 받게 Content-Encoding을 붙이지 않는다.
    expect(obj!.httpMetadata?.contentEncoding).toBeUndefined();
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
    // T-11-662 시도 기록은 운영 기록 DB에 있다.
    const ops = ctx.env.OPS_DB!;
    await ops
      .prepare(att)
      .bind('att_old', ago(2 * DAY))
      .run();
    await ops.prepare(att).bind('att_new', ago(HOUR)).run();
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
    // T-11-802 게임 안 의견은 180일.
    const vox = `INSERT INTO user_voices (id, profile_id, kind, body, body_key, platform, app_version, lang, created_at) VALUES (?1, 'prf_1', 'bug', 'b', ?1, 'web', 'dev', 'ko', ?2)`;
    await run(vox, 'vox_old', ago(181 * DAY));
    await run(vox, 'vox_new', ago(179 * DAY));

    expect(await cleanupExpired(ctx.env.DB, NOW, {}, ops)).toEqual({
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
      user_voices: 1,
      translations: 1,
      api_status_buckets: 0,
      client_errors: 0,
    });
    expect(
      (await ctx.env.DB.prepare('SELECT id FROM user_voices').all<{ id: string }>()).results,
    ).toEqual([{ id: 'vox_new' }]);
    expect(await count('translations')).toBe(1);
    expect(await count('chat_reports')).toBe(1);
    expect(await count('chat_mutes')).toBe(1);
    expect(await count('app_auth_tickets')).toBe(1);
    expect(await count('idempotency')).toBe(1);
    expect(
      (await ops.prepare('SELECT count(*) AS n FROM auth_attempts').first<{ n: number }>())!.n,
    ).toBe(1);
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
      for (const t of ['profiles', 'sessions', 'idempotency']) {
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

  it('정지 중에는 다음 조각을 쓰지 않고 기한이 지나면 같은 위치에서 이어 간다', async () => {
    await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
    const step = () => runBackupStep(ctx.env.DB, bucket(), 'pause-test', NOW, { stepMs: 0 });
    expect(await step()).toMatchObject({ chunk: 1 });
    const cursor = await meta(BACKUP_STATE_KEY);
    await setBackupControl(ctx.env.DB, 'pause', 0, 'admin');
    expect(await step()).toBeNull();
    expect(await meta(BACKUP_STATE_KEY)).toEqual(cursor);
    await run(
      "UPDATE app_meta SET value=json_set(value,'$.pausedUntil',0) WHERE key=?",
      BACKUP_CONTROL_KEY,
    );
    expect(await step()).toMatchObject({ chunk: 2 });
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
          (l) =>
            !l.startsWith('-- offside D1 backup') &&
            !l.startsWith('INSERT INTO "app_meta"') &&
            !l.startsWith('INSERT OR REPLACE INTO "app_meta"'),
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

  // T-11-777 복사가 여러 틱에 걸치는 동안 새로 생긴 부모 행이 빠지면 복원한 DB의 외래 키가 깨진다.
  describe('T-11-777 마감', () => {
    /** 조각을 이어 새 SQLite에 한 트랜잭션으로 넣는다(주간 복원 검증과 같은 방식, 외래 키 강제 없음). */
    const restore = (sql: string) => {
      const db = new DatabaseSync(':memory:');
      db.exec(`BEGIN;\n${sql}\nCOMMIT;`);
      return db;
    };
    const career = (id: string, profile: string) =>
      run(
        "INSERT INTO careers (id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at) VALUES (?1, ?2, 'FW', '오른발', 'poacher', 'late', 2026, 'active', '1.0.0', '2026-09-28', '2026-09-28')",
        id,
        profile,
      );
    const stepUntil = async (env: string, stop: (s: BackupState | null) => boolean) => {
      for (let i = 0; i < 800; i++) {
        const r = await runBackupStep(ctx.env.DB, bucket(), env, NOW + i * 300_000, { stepMs: 0 });
        const state = await meta<BackupState>(BACKUP_STATE_KEY);
        if (r?.done || stop(state)) return state;
      }
      throw new Error('backup did not reach the expected position');
    };

    it('조건부 고유 인덱스의 열을 스키마에서 읽는다(운영 스키마의 두 인덱스 포함)', async () => {
      const { results } = await ctx.env.DB.prepare(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND type = 'index'",
      ).all<{ type: string; name: string; sql: string }>();
      const keys = partialUniqueKeys(results);
      expect(keys.get('market_listings')).toEqual([['career_id']]);
      expect(keys.get('manager_careers')).toEqual([['profile_id']]);
      // 조건 없는 고유 인덱스 · 식 인덱스 · 일반 인덱스는 대상이 아니다.
      expect(
        partialUniqueKeys([
          { type: 'index', name: 'a', sql: 'CREATE UNIQUE INDEX a ON t (x)' },
          { type: 'index', name: 'b', sql: 'CREATE UNIQUE INDEX b ON t (lower(x)) WHERE y = 1' },
          { type: 'index', name: 'c', sql: 'CREATE INDEX c ON t (x) WHERE y = 1' },
          { type: 'index', name: 'd', sql: 'CREATE UNIQUE INDEX d ON "t" ("x", y DESC) WHERE z' },
        ]),
      ).toEqual(new Map([['t', [['x', 'y']]]]));
    });

    it('T-11-814 고유 값이 새 행으로 옮겨 가도 옛 주인 행은 남고 그 값만 비운다', async () => {
      const { results } = await ctx.env.DB.prepare(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND type = 'index'",
      ).all<{ type: string; name: string; sql: string }>();
      const keys = singleUniqueKeys(results).get('profiles')!;
      expect(keys).toContainEqual({ col: 'google_sub', lower: false });
      expect(keys).toContainEqual({ col: 'nickname', lower: true });
      // 여러 열 · 조건부 고유 인덱스는 대상이 아니다.
      expect(
        singleUniqueKeys([
          { type: 'index', name: 'a', sql: 'CREATE UNIQUE INDEX a ON t (x, y)' },
          { type: 'index', name: 'b', sql: 'CREATE UNIQUE INDEX b ON t (x) WHERE y = 1' },
          { type: 'index', name: 'c', sql: 'CREATE INDEX c ON t (x)' },
        ]).size,
      ).toBe(0);

      await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
      await run('CREATE TABLE seal_owners (id TEXT PRIMARY KEY, sub TEXT, nick TEXT)');
      await run('CREATE UNIQUE INDEX seal_owners_sub_unique ON seal_owners (`sub`)');
      await run('CREATE UNIQUE INDEX seal_owners_nick_unique ON seal_owners (lower("nick"))');
      await run(
        'CREATE TABLE seal_owned (id INTEGER PRIMARY KEY, owner TEXT NOT NULL REFERENCES seal_owners(id) ON DELETE CASCADE)',
      );
      await run(
        "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 260) INSERT INTO seal_owners SELECT 'o' || i, 'g' || i, 'nick' || i FROM n",
      );
      await run(
        "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 260) INSERT INTO seal_owned SELECT i, 'o' || i FROM n",
      );
      try {
        const at = (st: BackupState, t: string) => st.tables.indexOf(t);
        const copied = (st: BackupState, t: string, top: number) =>
          st.table > at(st, t) || (st.table === at(st, t) && st.after >= top);
        const state = await stepUntil(
          'sealk',
          (st) => !!st && copied(st, 'seal_owners', 260) && copied(st, 'seal_owned', 260),
        );
        expect(state?.phase).toBe('copy');
        // 복사한 뒤: o1의 연결과 닉네임이 새 행으로 옮겨 간다(대소문자만 다른 닉네임).
        await run("UPDATE seal_owners SET sub = NULL, nick = 'renamed' WHERE id = 'o1'");
        await run("INSERT INTO seal_owners VALUES ('o1b', 'g1', 'NICK1')");
        await stepUntil('sealk', () => false);
        const last = (await meta<BackupResult>(BACKUP_LAST_KEY))!;
        expect(last.consistency).toBe('sealed');
        const { sql } = await dumpOf(bucket(), last.key);
        const db = restore(sql);
        try {
          expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
          expect(db.prepare('SELECT count(*) AS n FROM seal_owners').get()).toEqual({ n: 261 });
          // 옛 주인은 남는다. 옮겨 간 값은 비고(복사한 때의 값이라 새 닉네임은 모른다), 새 행이 그 값을 갖는다.
          expect(
            db
              .prepare(
                "SELECT id, sub, nick FROM seal_owners WHERE id IN ('o1', 'o1b') ORDER BY id",
              )
              .all(),
          ).toEqual([
            { id: 'o1', sub: null, nick: null },
            { id: 'o1b', sub: 'g1', nick: 'NICK1' },
          ]);
          expect(
            db.prepare("SELECT count(*) AS n FROM seal_owned WHERE owner = 'o1'").get(),
          ).toEqual({
            n: 1,
          });
        } finally {
          db.close();
        }
      } finally {
        await run('DROP TABLE seal_owned');
        await run('DROP TABLE seal_owners');
      }
    });

    it('조건부 고유 키가 겹치는 새 행과 옛 사본, 복사 뒤 커진 작은 표도 복원된다', async () => {
      await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
      // 큰 표(200행 초과)라 마지막에 통째로 다시 읽지 않는다 — 닫힌 매물의 옛 사본이 'open'으로 남는 경우다.
      await run(
        'CREATE TABLE seal_listings (id TEXT PRIMARY KEY, card TEXT NOT NULL, status TEXT NOT NULL)',
      );
      await run(
        "CREATE UNIQUE INDEX seal_listings_open_unique ON seal_listings (`card`) WHERE status = 'open'",
      );
      await run(
        "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 260) INSERT INTO seal_listings SELECT 'l' || i, 'c' || i, 'open' FROM n",
      );
      await run('CREATE TABLE seal_small (id INTEGER PRIMARY KEY, v TEXT)');
      await run(
        "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 100) INSERT INTO seal_small SELECT i, 'a' FROM n",
      );
      try {
        const at = (st: BackupState, t: string) => st.tables.indexOf(t);
        // 두 표의 마지막 행까지 복사한 위치에서 멈춘다(표가 끝 순서라 표 번호가 넘어가기 전이다).
        const copied = (st: BackupState, t: string, top: number) =>
          st.table > at(st, t) || (st.table === at(st, t) && st.after >= top);
        const state = await stepUntil(
          'sealu',
          (st) => !!st && copied(st, 'seal_listings', 260) && copied(st, 'seal_small', 100),
        );
        expect(state?.phase).toBe('copy');
        // 복사한 뒤: l1을 닫고 같은 카드를 다시 올린다. 작은 표는 5배로 커진다.
        // 같은 카드의 닫힌 매물을 한 번에 읽는 양(400)보다 많이 쌓아 둔다 — 밀려난 l1은 그 키에서 최근 행이다.
        await run(
          "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 450) INSERT INTO seal_listings SELECT 'h' || i, 'c1', 'sold' FROM n",
        );
        await run("UPDATE seal_listings SET status = 'sold' WHERE id = 'l1'");
        await run("INSERT INTO seal_listings VALUES ('l1b', 'c1', 'open')");
        await run(
          "WITH RECURSIVE n(i) AS (SELECT 101 UNION ALL SELECT i + 1 FROM n WHERE i < 600) INSERT INTO seal_small SELECT i, 'b' FROM n",
        );
        await stepUntil('sealu', () => false);
        const last = (await meta<BackupResult>(BACKUP_LAST_KEY))!;
        expect(last.consistency).toBe('sealed');
        const { sql } = await dumpOf(bucket(), last.key);
        // 고유 인덱스는 마감 행보다 먼저, 한 번만 만든다.
        expect(sql.match(/CREATE UNIQUE INDEX seal_listings_open_unique/g)).toHaveLength(1);
        expect(sql.indexOf('CREATE UNIQUE INDEX seal_listings_open_unique')).toBeLessThan(
          sql.indexOf('INSERT OR REPLACE INTO "seal_listings"'),
        );
        const db = restore(sql);
        try {
          expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
          expect(
            db
              .prepare(
                "SELECT id, status FROM seal_listings WHERE card = 'c1' AND id LIKE 'l%' ORDER BY id",
              )
              .all(),
          ).toEqual([
            { id: 'l1', status: 'sold' },
            { id: 'l1b', status: 'open' },
          ]);
          expect(db.prepare('SELECT count(*) AS n FROM seal_listings').get()).toEqual({ n: 711 });
          expect(db.prepare('SELECT count(*) AS n FROM seal_small').get()).toEqual({ n: 600 });
        } finally {
          db.close();
        }
      } finally {
        await run('DROP TABLE seal_listings');
        await run('DROP TABLE seal_small');
      }
    });

    it('복사 뒤에 생긴 부모 행과 다시 넣은 행을 덧붙여 복원한 DB의 외래 키가 맞는다', async () => {
      await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
      await run("INSERT INTO app_meta(key,value) VALUES ('seal:replaced','\"old\"')");
      // profiles(부모)는 지나고 careers(자식)는 아직인 위치에서 멈춘다.
      const at = (s: BackupState, t: string) => s.tables.indexOf(t);
      const state = await stepUntil(
        'seal',
        (s) => !!s && s.table > at(s, 'profiles') && s.table <= at(s, 'careers'),
      );
      expect(state?.phase).toBe('copy');
      await run(
        "INSERT INTO profiles (id, settings_json, created_at, last_seen_at) VALUES ('prf_seal', '{}', ?1, ?1)",
        ago(HOUR),
      );
      await career('car_seal', 'prf_seal');
      // app_meta를 지난 뒤 지우고 다시 넣으면 rowid가 바뀐다 — 앞 조각의 옛 행과 키가 겹친다.
      await stepUntil('seal', (s) => !!s && (s.phase === 'seal' || s.table > at(s, 'app_meta')));
      await run("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('seal:replaced','\"new\"')");
      await stepUntil('seal', () => false);
      const last = (await meta<BackupResult>(BACKUP_LAST_KEY))!;
      expect(last).toMatchObject({ consistency: 'sealed', restoreVerified: false });
      expect(last.seal!.rows).toBeGreaterThanOrEqual(2);

      const { sql } = await dumpOf(bucket(), last.key);
      expect(sql).toMatch(/^INSERT OR REPLACE INTO "profiles" .*'prf_seal'/m);
      // 인덱스는 마감 행 뒤에 만든다.
      expect(sql.lastIndexOf('INSERT OR REPLACE INTO')).toBeLessThan(sql.indexOf('CREATE INDEX'));
      const db = restore(sql);
      try {
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
        expect(db.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
        expect(db.prepare("SELECT profile_id FROM careers WHERE id='car_seal'").get()).toEqual({
          profile_id: 'prf_seal',
        });
        expect(db.prepare("SELECT value FROM app_meta WHERE key='seal:replaced'").all()).toEqual([
          { value: '"new"' },
        ]);
      } finally {
        db.close();
      }

      // 조각 목록: 번호 순 조각의 크기와 해시가 R2 객체와 같다.
      const manifest = await (await bucket().get(manifestKey('seal', last.day)))!.json<{
        format: string;
        consistency: string;
        rows: number;
        chunks: { object: string; bytes: number; sha256: string }[];
      }>();
      expect(manifest).toMatchObject({
        format: 'offside-d1-live-copy-v1',
        consistency: 'sealed',
        rows: last.rows,
      });
      expect(manifest.chunks).toHaveLength(last.chunks);
      for (const chunk of manifest.chunks) {
        const body = new Uint8Array(
          await (await bucket().get(last.key + chunk.object))!.arrayBuffer(),
        );
        expect(body.byteLength).toBe(chunk.bytes);
        expect(createHash('sha256').update(body).digest('hex')).toBe(chunk.sha256);
      }
      expect(await (await bucket().get(latestManifestKey('seal')))!.json()).toEqual(manifest);
      await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%' OR key='seal:replaced'");
      await run("DELETE FROM careers WHERE id='car_seal'");
      await run("DELETE FROM profiles WHERE id='prf_seal'");
    });

    it('마감 전에 시작한 백업(위치 기록 없음)은 마감 없이 live-copy로 끝난다', async () => {
      await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
      await runBackupStep(ctx.env.DB, bucket(), 'legacy', NOW, { stepMs: 0 });
      await run(
        "UPDATE app_meta SET value=json_remove(value,'$.hwm','$.phase','$.objects') WHERE key=?1",
        BACKUP_STATE_KEY,
      );
      await stepUntil('legacy', () => false);
      const last = (await meta<BackupResult>(BACKUP_LAST_KEY))!;
      expect(last.consistency).toBe('live-copy');
      expect(last).not.toHaveProperty('seal');
      expect(await bucket().head(manifestKey('legacy', last.day))).toBeNull();
      await run("DELETE FROM app_meta WHERE key LIKE 'cron:backup:%'");
    });

    it('30일 지난 조각 목록도 지우고 latest와 매달 1일 목록은 남긴다', async () => {
      for (const day of ['2026-08-01', '2026-08-15'])
        await bucket().put(manifestKey('prune', day), '{}');
      const r = await backupToR2(ctx.env.DB, bucket(), 'prune', NOW);
      expect(r.pruned).toBe(1);
      const keys = (await bucket().list({ prefix: 'd1-manifests/prune/' })).objects.map(
        (o) => o.key,
      );
      expect(keys.sort()).toEqual([
        manifestKey('prune', '2026-08-01'),
        manifestKey('prune', r.day),
        latestManifestKey('prune'),
      ]);
    });
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
