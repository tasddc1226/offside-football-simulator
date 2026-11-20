import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  LIVE_COPY_FORMAT,
  VERIFIED_FORMAT,
  dayKey,
  latestKey,
  verifiedKey,
  verifyLiveCopy,
} from './verify-live-copy.mjs';

const env = { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'secret-token' };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const DAY = '2026-11-20';

/** 메모리 R2. 조각은 저장한 gzip 바이트 그대로 돌려준다. */
function fakeStorage(parts, overrides = {}) {
  const chunks = parts.map((sql) => gzipSync(sql));
  const manifest = {
    format: LIVE_COPY_FORMAT,
    env: 'production',
    day: DAY,
    prefix: `d1/production/${DAY}/`,
    consistency: 'sealed',
    seal: { passes: 1, rows: 1 },
    tables: 2,
    rows: 4,
    startedAt: 1000,
    finishedAt: 2000,
    chunks: chunks.map((bytes, i) => ({
      object: `${String(i + 1).padStart(4, '0')}.sql.gz`,
      bytes: bytes.length,
      sha256: sha256(bytes),
    })),
    ...overrides,
  };
  const store = new Map();
  const content = Buffer.from(JSON.stringify(manifest));
  store.set(latestKey('production'), content);
  store.set(dayKey('production', DAY), content);
  chunks.forEach((bytes, i) =>
    store.set(`d1/production/${DAY}/${String(i + 1).padStart(4, '0')}.sql.gz`, bytes),
  );
  const calls = [];
  const fetcher = async (url, init) => {
    const key = decodeURIComponent(String(url).split('/objects/')[1]);
    calls.push({ method: init.method, key, auth: init.headers.Authorization });
    if (init.method === 'PUT') {
      store.set(key, Buffer.from(init.body));
      return Response.json({ success: true, errors: [] });
    }
    return store.has(key) ? new Response(store.get(key)) : new Response('', { status: 404 });
  };
  return { store, calls, fetcher, content };
}

const SQL = [
  "PRAGMA defer_foreign_keys = true;\nCREATE TABLE parent(id INTEGER PRIMARY KEY, v TEXT);\nCREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));\nINSERT INTO parent VALUES(1, 'old');\nINSERT INTO child VALUES(1, 2);\n",
  // 마감 조각: 복사 뒤에 생긴 부모와, 다시 넣은 행.
  "INSERT OR REPLACE INTO parent VALUES(2, 'late');\nINSERT OR REPLACE INTO parent VALUES(1, 'new');\n",
];

describe('T-11-777 live-copy restore verification', () => {
  const withDir = async (run) => {
    const dir = mkdtempSync(join(tmpdir(), 'offside-live-verify-'));
    try {
      return await run(join(dir, 'work'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('downloads by manifest, restores, and publishes a marker only after every check passes', async () => {
    const { store, calls, fetcher, content } = fakeStorage(SQL);
    const result = await withDir((output) =>
      verifyLiveCopy({ env, output, publish: true, now: 5000 }, fetcher),
    );
    expect(result).toMatchObject({
      day: DAY,
      consistency: 'sealed',
      chunks: 2,
      tables: 2,
      rows: 3,
      expectedRows: 4,
      integrityOk: true,
      countsMatch: true,
      foreignKeyViolations: 0,
      passed: true,
      published: true,
    });
    expect(JSON.parse(store.get(verifiedKey('production')).toString())).toMatchObject({
      format: VERIFIED_FORMAT,
      env: 'production',
      day: DAY,
      at: 2000,
      verifiedAt: 5000,
      manifestKey: dayKey('production', DAY),
      manifestSha256: sha256(content),
      restored: { tables: 2, rows: 3, foreignKeyViolations: 0 },
    });
    expect(calls.every((call) => call.auth === 'Bearer secret-token')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('late');
  });

  it('does not publish when a foreign key is broken, a chunk was altered, or the manifest is malformed', async () => {
    // 마감 조각이 없으면 child가 없는 부모를 가리킨다.
    const broken = fakeStorage([SQL[0]], { rows: 2, seal: null });
    const verdict = await withDir((output) =>
      verifyLiveCopy({ env, output, publish: true }, broken.fetcher),
    );
    expect(verdict).toMatchObject({ passed: false, published: false, foreignKeyViolations: 1 });
    expect(broken.store.has(verifiedKey('production'))).toBe(false);

    const altered = fakeStorage(SQL);
    altered.store.set(`d1/production/${DAY}/0002.sql.gz`, gzipSync('SELECT 1;\n'));
    await expect(
      withDir((output) => verifyLiveCopy({ env, output, publish: true }, altered.fetcher)),
    ).rejects.toThrow('does not match');
    expect(altered.store.has(verifiedKey('production'))).toBe(false);

    for (const overrides of [
      { format: 'other' },
      { env: 'staging' },
      { prefix: 'd1/production/2026-01-01/' },
      { chunks: [] },
    ]) {
      const bad = fakeStorage(SQL, overrides);
      await expect(
        withDir((output) => verifyLiveCopy({ env, output, publish: true }, bad.fetcher)),
      ).rejects.toThrow('Invalid live-copy manifest');
      expect(bad.calls.some((call) => call.method === 'PUT')).toBe(false);
    }
    await expect(
      verifyLiveCopy({ env: {}, output: '/nonexistent', publish: true }, altered.fetcher),
    ).rejects.toThrow('credentials');
  });

  it('verifies a named day without publishing by default', async () => {
    const { store, calls, fetcher } = fakeStorage(SQL);
    const result = await withDir((output) => verifyLiveCopy({ env, output, day: DAY }, fetcher));
    expect(result).toMatchObject({ passed: true, published: false });
    expect(calls[0]).toMatchObject({ method: 'GET', key: dayKey('production', DAY) });
    expect(store.has(verifiedKey('production'))).toBe(false);
  });
});
