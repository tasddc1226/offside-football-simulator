import { describe, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { preflight, exportSnapshot, EXPORT_ACK, publishSnapshot } from './d1-snapshot.mjs';
import { requireDrillDatabase } from './d1-recovery-drill.mjs';
const ID = '11111111-1111-1111-1111-111111111111';
const py = new URL('./snapshot-backup.py', import.meta.url).pathname;
const sql =
  'CREATE TABLE parent(id INTEGER PRIMARY KEY);\nCREATE TABLE child(id INTEGER REFERENCES parent(id));\nINSERT INTO parent VALUES(1);\nINSERT INTO child VALUES(1);\n';
describe('consistent D1 snapshot pipeline', () => {
  it('preflights with GETs only and refuses export without exact query-blocking acknowledgement', async () => {
    const api = vi.fn(async (path) =>
      path.endsWith('/bookmark')
        ? { bookmark: 'b' }
        : { uuid: ID, name: 'offside-recovery-drill-test' },
    );
    await preflight(api, ID, 'offside-recovery-drill-test');
    expect(api.mock.calls.every((args) => args.length === 1)).toBe(true);
    await expect(exportSnapshot(api, ID, '')).rejects.toThrow('confirmation');
    expect(api).toHaveBeenCalledTimes(2);
    await expect(preflight(api, ID, 'offside-production')).rejects.toThrow('identity');
    for (const id of [
      '2cfe462c-204e-4842-805c-5840fc9b1758',
      '37688e3f-b905-4240-abdb-e23e778dfad9',
      'c6edc33e-e879-4ccf-9fc1-807aeb61561d',
    ])
      expect(() => requireDrillDatabase(id, 'offside-recovery-drill-test')).toThrow();
    expect(() => requireDrillDatabase(ID, 'offside-production')).toThrow();
  });
  it('keeps a stable export bookmark, bounds polling, and never treats an error as a complete snapshot', async () => {
    const api = vi
      .fn()
      .mockResolvedValueOnce({ success: true, at_bookmark: 'b', status: 'active' })
      .mockResolvedValueOnce({
        success: true,
        at_bookmark: 'b',
        status: 'complete',
        result: { signed_url: 'https://example.com/private?secret=test' },
      });
    const result = await exportSnapshot(api, ID, EXPORT_ACK(ID), { sleep: async () => {} });
    expect(result.bookmark).toBe('b');
    expect(api.mock.calls[1][1].current_bookmark).toBe('b');
    let now = 0;
    await expect(
      exportSnapshot(
        async () => ({ success: true, at_bookmark: 'b', status: 'active' }),
        ID,
        EXPORT_ACK(ID),
        {
          timeoutMs: 1000,
          now: () => now,
          sleep: async () => {
            now += 1000;
          },
        },
      ),
    ).rejects.toThrow('deadline');
    await expect(
      exportSnapshot(async () => ({ success: false, status: 'error' }), ID, EXPORT_ACK(ID)),
    ).rejects.toThrow('failed');
  });
  it('requires zero FK violations, verifies R2 bytes by restore and publishes completion last; corrupted storage never gets a marker', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshot-test-'));
    const env = { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_API_TOKEN: 'private' };
    try {
      writeFileSync(join(dir, 'source.sql'), sql);
      execFileSync('python3', [
        py,
        'pack',
        '--sql',
        join(dir, 'source.sql'),
        '--output',
        join(dir, 'packed'),
        '--database-id',
        ID,
        '--bookmark',
        'b',
      ]);
      const stored = new Map();
      const calls = [];
      const fetcher = async (url, init) => {
        const key = decodeURIComponent(String(url).split('/objects/')[1]);
        calls.push({ key, method: init.method });
        if (init.method === 'PUT') {
          stored.set(key, Buffer.from(init.body));
          return Response.json({ success: true });
        }
        return new Response(stored.get(key));
      };
      const result = await publishSnapshot(
        env,
        join(dir, 'packed'),
        'd1-snapshots/drill/test/',
        fetcher,
      );
      expect(result).toMatchObject({ verified: true, tables: 2, rows: 2 });
      expect(calls.at(-1).key).toBe('d1-snapshots/drill/test/manifest.json');
      expect([...stored.keys()].some((s) => s.includes('production'))).toBe(false);
      const manifest = JSON.parse(readFileSync(join(dir, 'packed', 'manifest.json')));
      const bad = join(dir, 'bad');
      execFileSync('python3', [
        py,
        'pack',
        '--sql',
        join(dir, 'source.sql'),
        '--output',
        bad,
        '--database-id',
        ID,
        '--bookmark',
        'b',
      ]);
      const badCalls = [];
      await expect(
        publishSnapshot(env, bad, 'd1-snapshots/drill/bad/', async (_url, init) => {
          badCalls.push(init.method);
          return init.method === 'PUT' ? Response.json({ success: true }) : new Response('corrupt');
        }),
      ).rejects.toThrow('hash');
      expect(badCalls).toEqual(['PUT', 'GET']);
      writeFileSync(join(dir, 'source.sql'), sql.replace('child VALUES(1)', 'child VALUES(99)'));
      const rejected = spawnSync('python3', [
        py,
        'pack',
        '--sql',
        join(dir, 'source.sql'),
        '--output',
        join(dir, 'invalid'),
        '--database-id',
        ID,
        '--bookmark',
        'b',
      ]);
      expect(rejected.status).toBe(1);
      expect(manifest.rows).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

it('advances production recovery assurance only after verified storage roundtrip', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-production-test-'));
  try {
    writeFileSync(join(dir, 'source.sql'), sql);
    execFileSync('python3', [
      py,
      'pack',
      '--sql',
      join(dir, 'source.sql'),
      '--output',
      join(dir, 'packed'),
      '--database-id',
      '2cfe462c-204e-4842-805c-5840fc9b1758',
      '--bookmark',
      'b',
      '--snapshot-at',
      '1793592000000',
    ]);
    const calls = [];
    const stored = new Map();
    await publishSnapshot(
      { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_API_TOKEN: 'private' },
      join(dir, 'packed'),
      'd1-snapshots/production/test/',
      async (url, init) => {
        const key = decodeURIComponent(String(url).split('/objects/')[1]);
        calls.push(key);
        if (init.method === 'PUT') {
          stored.set(key, Buffer.from(init.body));
          return Response.json({ success: true });
        }
        return new Response(stored.get(key));
      },
    );
    expect(calls.at(-1)).toBe('d1-snapshots/production/last-verified.json');
    const marker = JSON.parse(stored.get(calls.at(-1)).toString());
    expect(marker.at).toBe(1793592000000);
    expect(marker.manifestKey).toBe('d1-snapshots/production/test/manifest.json');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('refuses production capture outside the reviewed workflow before any export POST', async () => {
  const { capture } = await import('./d1-snapshot.mjs');
  const calls = [];
  const id = '2cfe462c-204e-4842-805c-5840fc9b1758';
  await expect(
    capture(
      {
        env: { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_API_TOKEN: 'private' },
        id,
        expectedName: 'offside-production',
        confirm: EXPORT_ACK(id),
      },
      async (url, init) => {
        calls.push(init.method);
        return Response.json({
          success: true,
          result: String(url).endsWith('/bookmark')
            ? { bookmark: 'b' }
            : { uuid: id, name: 'offside-production' },
        });
      },
    ),
  ).rejects.toThrow('maintenance workflow');
  expect(calls).toEqual(['GET', 'GET']);
});

it('proves R2 read/write/delete permissions with an owned probe before capture', async () => {
  const { verifyStorageAccess } = await import('./d1-snapshot.mjs');
  const calls = [];
  let stored;
  await verifyStorageAccess(
    { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_API_TOKEN: 'private' },
    async (url, init) => {
      calls.push({ url: String(url), method: init.method });
      if (init.method === 'PUT') {
        stored = init.body;
        return Response.json({ success: true });
      }
      return init.method === 'GET' ? new Response(stored) : Response.json({ success: true });
    },
  );
  expect(calls.map((c) => c.method)).toEqual(['PUT', 'GET', 'DELETE']);
  expect(calls.every((c) => decodeURIComponent(c.url).includes('/d1-snapshots/probes/'))).toBe(
    true,
  );
  const failed = [];
  await expect(
    verifyStorageAccess(
      { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_API_TOKEN: 'private' },
      async (_url, init) => {
        failed.push(init.method);
        return new Response('', { status: 403 });
      },
    ),
  ).rejects.toThrow('permission');
  expect(failed).toEqual(['PUT', 'DELETE']);
});
