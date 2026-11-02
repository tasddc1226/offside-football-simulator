import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, unlink, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(new URL('./snapshot-backup.py', import.meta.url));
const MAX_CHUNK = 64 * 1024 * 1024;
export const EXPORT_ACK = (id) => `EXPORT_BLOCKS_QUERIES:${id}`;
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function client(env = process.env, fetcher = fetch) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN)
    throw new Error('Missing Cloudflare credentials');
  return async (path, body, method = body === undefined ? 'GET' : 'POST', timeoutMs = 15_000) => {
    const r = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!r.ok) throw new Error('Cloudflare request failed');
    const value = await r.json();
    if (value.success !== true || value.errors?.length)
      throw new Error('Cloudflare observation failed');
    return value.result;
  };
}

export async function preflight(api, id, expectedName) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(expectedName))
    throw new Error('Invalid database identity');
  const db = await api(`/d1/database/${id}`);
  if (db.uuid !== id || db.name !== expectedName) throw new Error('Database identity mismatch');
  const bookmark = await api(`/d1/database/${id}/time_travel/bookmark`);
  if (typeof bookmark.bookmark !== 'string' || !bookmark.bookmark)
    throw new Error('Time Travel unavailable');
  return {
    databaseId: id,
    databaseName: db.name,
    sizeBytes: db.file_size ?? null,
    bookmark: bookmark.bookmark,
    exportBlocksQueries: true,
    isolatedCloneSupported: false,
  };
}

/** Native export is a single provider snapshot. Never fall back to the multi-hour live copy. */
export async function exportSnapshot(
  api,
  id,
  confirm,
  {
    timeoutMs = 120_000,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
  } = {},
) {
  if (confirm !== EXPORT_ACK(id))
    throw new Error('Explicit query-blocking export confirmation required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300_000)
    throw new Error('Invalid export deadline');
  const started = now();
  let bookmark;
  while (now() - started < timeoutMs) {
    const result = await api(
      `/d1/database/${id}/export`,
      {
        output_format: 'polling',
        ...(bookmark && { current_bookmark: bookmark }),
      },
      'POST',
      Math.min(30_000, Math.max(1000, timeoutMs - (now() - started))),
    );
    if (result.success !== true || result.status === 'error')
      throw new Error('Native export failed');
    if (
      typeof result.at_bookmark !== 'string' ||
      !result.at_bookmark ||
      (bookmark && bookmark !== result.at_bookmark)
    )
      throw new Error('Export snapshot bookmark changed or missing');
    bookmark = result.at_bookmark;
    if (result.status === 'complete') {
      const url = new URL(result.result?.signed_url);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('Invalid export download');
      return { bookmark, url: url.href, exportMs: now() - started };
    }
    await sleep(500);
  }
  // No more polls: Cloudflare cancels an abandoned export. This is not an immediate unlock guarantee.
  throw new Error(
    'Export deadline exceeded; polling stopped; verify provider cancellation and database availability',
  );
}

export async function download(url, destination, fetcher = fetch) {
  const response = await fetcher(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(60 * 60_000),
  });
  if (!response.ok || !response.body) throw new Error('Snapshot download failed');
  let bytes = 0;
  await pipeline(
    Readable.fromWeb(response.body),
    new Transform({
      transform(chunk, _encoding, next) {
        bytes += chunk.length;
        next(bytes > 16 * 1024 ** 3 ? new Error('Export download bound exceeded') : null, chunk);
      },
    }),
    createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
  );
}

export async function publishSnapshot(env, output, prefix, fetcher = fetch) {
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  if (
    manifest.format !== 'offside-d1-snapshot-v1' ||
    manifest.verified !== true ||
    !Array.isArray(manifest.chunks) ||
    !manifest.chunks.length ||
    manifest.chunks.length > 10000
  )
    throw new Error('Unverified snapshot cannot be published');
  if (!/^d1-snapshots\/(production|drill)\/[a-zA-Z0-9_-]+\/$/.test(prefix))
    throw new Error('Invalid snapshot prefix');
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/r2/buckets/offside-d1-backup/objects/`;
  const roundtrip = join(output, 'roundtrip');
  await mkdir(roundtrip, { mode: 0o700 });
  const request = async (key, body) => {
    const response = await fetcher(base + encodeURIComponent(prefix + key), {
      method: body ? 'PUT' : 'GET',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        ...(body && { 'Content-Type': 'application/octet-stream' }),
      },
      ...(body && { body }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error('Snapshot storage request failed');
    if (body) {
      const value = await response.json();
      if (value.success !== true || value.errors?.length)
        throw new Error('Snapshot storage response failed');
    }
    return response;
  };
  for (const [index, chunk] of manifest.chunks.entries()) {
    const number = String(index + 1).padStart(4, '0');
    if (
      chunk.file !== `${number}.sql` ||
      chunk.object !== `${number}.sql.gz` ||
      chunk.bytes > MAX_CHUNK ||
      chunk.bytes <= 0
    )
      throw new Error('Invalid snapshot chunk');
    if ((await stat(join(output, chunk.file))).size > MAX_CHUNK)
      throw new Error('Local chunk too large');
    const bytes = await readFile(join(output, chunk.file));
    if (bytes.length !== chunk.bytes || sha256(bytes) !== chunk.sha256)
      throw new Error('Local snapshot hash mismatch');
    await request(chunk.object, bytes);
    const stored = await request(chunk.object);
    // Bound remote reads as well; never trust an object's declared length alone.
    const file = join(roundtrip, chunk.file);
    let received = 0;
    await pipeline(
      Readable.fromWeb(stored.body),
      new Transform({
        transform(data, _encoding, next) {
          received += data.length;
          next(received > MAX_CHUNK ? new Error('Stored chunk too large') : null, data);
        },
      }),
      createWriteStream(file, { flags: 'wx', mode: 0o600 }),
    );
    if (received !== chunk.bytes || sha256(await readFile(file)) !== chunk.sha256)
      throw new Error('Stored snapshot hash mismatch');
  }
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(roundtrip, 'manifest.json'), JSON.stringify(manifest), {
    flag: 'wx',
    mode: 0o600,
  });
  const verified = JSON.parse(
    execFileSync(
      'python3',
      [
        script,
        'verify',
        '--source',
        roundtrip,
        '--destination',
        join(roundtrip, 'restored.sqlite'),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
  if (!verified.countsMatch || !verified.integrityOk || verified.foreignKeyViolations !== 0)
    throw new Error('Stored snapshot restore failed');
  await unlink(join(roundtrip, 'restored.sqlite'));
  // Only a verified R2 roundtrip gets a completion marker. Incomplete unique prefixes are never advertised as recoverable.
  await request('manifest.json', Buffer.from(JSON.stringify(manifest)));
  if (
    manifest.databaseId === '2cfe462c-204e-4842-805c-5840fc9b1758' &&
    prefix.startsWith('d1-snapshots/production/')
  ) {
    // Only a production snapshot can advance production recovery assurance. Never touched by drills.
    const marker = {
      format: manifest.format,
      databaseId: manifest.databaseId,
      at: manifest.createdAt,
      verifiedAt: Date.now(),
      manifestKey: prefix + 'manifest.json',
      manifestSha256: sha256(Buffer.from(JSON.stringify(manifest))),
    };
    const markerUrl = base + encodeURIComponent('d1-snapshots/production/last-verified.json');
    const response = await fetcher(markerUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: JSON.stringify(marker),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || (await response.json()).success !== true)
      throw new Error('Recovery marker update not confirmed');
  }
  return {
    prefix,
    tables: verified.tables,
    rows: verified.rows,
    chunks: manifest.chunks.length,
    verified: true,
  };
}

export async function capture(
  { env = process.env, id, expectedName, output, confirm, timeoutMs = 120_000 },
  fetcher = fetch,
) {
  const api = client(env, fetcher);
  const info = await preflight(api, id, expectedName);
  if (expectedName === 'offside-production') {
    if (
      id !== '2cfe462c-204e-4842-805c-5840fc9b1758' ||
      env.GITHUB_WORKFLOW !== 'D1 consistent snapshot (manual)' ||
      env.GITHUB_REF !== 'refs/heads/main' ||
      env.OFFSIDE_SNAPSHOT_MAINTENANCE_APPROVED !== 'true'
    )
      throw new Error('Production capture requires the reviewed maintenance workflow');
  } else if (!/^offside-recovery-drill-[a-zA-Z0-9_-]+$/.test(expectedName)) {
    throw new Error('Capture target must be production or a dedicated recovery drill database');
  }
  if (confirm !== EXPORT_ACK(id))
    throw new Error('Explicit query-blocking export confirmation required');
  await mkdir(output, { mode: 0o700 });
  if (!Number.isSafeInteger(info.sizeBytes) || info.sizeBytes < 0)
    throw new Error('Database size unavailable; capture refused');
  const space = await statfs(output);
  if (
    Number.isFinite(info.sizeBytes) &&
    space.bavail * space.bsize < info.sizeBytes * 4 + 1024 ** 3
  )
    throw new Error('Insufficient private workspace capacity');
  const snapshotAt = Date.now();
  const snapshot = await exportSnapshot(api, id, confirm, { timeoutMs });
  const sql = join(output, 'native.sql');
  await download(snapshot.url, sql, fetcher); // No account Authorization header on signed download URLs.
  const packed = join(output, 'packed');
  execFileSync(
    'python3',
    [
      script,
      'pack',
      '--sql',
      sql,
      '--output',
      packed,
      '--database-id',
      id,
      '--bookmark',
      snapshot.bookmark,
      '--snapshot-at',
      String(snapshotAt),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await unlink(sql);
  const prefix = `d1-snapshots/${expectedName === 'offside-production' ? 'production' : 'drill'}/${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${randomUUID()}/`;
  const result = await publishSnapshot(env, packed, prefix, fetcher);
  return { ...info, ...result, exportMs: snapshot.exportMs, snapshotBookmark: snapshot.bookmark };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string', default: 'preflight' },
      'database-id': { type: 'string' },
      'expected-name': { type: 'string' },
      output: { type: 'string' },
      confirm: { type: 'string' },
      'timeout-ms': { type: 'string', default: '120000' },
    },
  });
  const run = async () => {
    if (!['preflight', 'capture'].includes(values.mode)) throw new Error('Invalid snapshot mode');
    const env = process.env;
    const id = values['database-id'];
    const expectedName = values['expected-name'];
    const result =
      values.mode === 'preflight'
        ? await preflight(client(env), id, expectedName)
        : await capture({
            env,
            id,
            expectedName,
            output: values.output,
            confirm: values.confirm,
            timeoutMs: Number(values['timeout-ms']),
          });
    console.log(JSON.stringify(result, null, 2));
  };
  run().catch(() => {
    console.error(
      'Snapshot operation failed. No verified snapshot completion marker was intentionally published on failure. Inspect private workspace and provider status; signed URLs and SQL are suppressed.',
    );
    process.exitCode = 1;
  });
}
