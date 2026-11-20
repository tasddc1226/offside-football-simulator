// T-11-777 매일 백업(R2 `d1/<env>/<day>/`)을 운영 DB를 건드리지 않고 복원해 본다.
// 조각 목록(`d1-manifests/<env>/latest.json`)을 읽어 조각을 받고(크기·SHA-256 확인), 새 로컬 SQLite에 복원해
// 무결성·외래 키·표/행 수를 검사한다. 모두 통과하면 `d1-manifests/<env>/last-verified.json`을 올린다(--publish).
// SQL·행 내용·서명 URL은 출력하지 않는다. 받은 조각과 복원한 DB는 운영 자료다 — 작업 폴더를 끝나면 지운다.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(new URL('./restore-backup.py', import.meta.url));
export const LIVE_COPY_FORMAT = 'offside-d1-live-copy-v1';
export const VERIFIED_FORMAT = 'offside-d1-live-copy-verified-v1';
const MAX_CHUNK = 64 * 1024 * 1024;
const MAX_CHUNKS = 10000;
const BUCKET = 'offside-d1-backup';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export const latestKey = (env) => `d1-manifests/${env}/latest.json`;
export const dayKey = (env, day) => `d1-manifests/${env}/${day}.json`;
export const verifiedKey = (env) => `d1-manifests/${env}/last-verified.json`;

/** 조각 목록의 모양을 검사한다. 틀리면 던진다(검증 표시를 올리지 않는다). */
export function checkManifest(manifest, env) {
  const ok =
    manifest &&
    manifest.format === LIVE_COPY_FORMAT &&
    manifest.env === env &&
    /^\d{4}-\d\d-\d\d$/.test(manifest.day) &&
    manifest.prefix === `d1/${env}/${manifest.day}/` &&
    ['sealed', 'live-copy'].includes(manifest.consistency) &&
    Number.isSafeInteger(manifest.tables) &&
    manifest.tables > 0 &&
    Number.isSafeInteger(manifest.rows) &&
    manifest.rows >= 0 &&
    Number.isFinite(manifest.startedAt) &&
    Number.isFinite(manifest.finishedAt) &&
    manifest.finishedAt >= manifest.startedAt &&
    Array.isArray(manifest.chunks) &&
    manifest.chunks.length > 0 &&
    manifest.chunks.length <= MAX_CHUNKS &&
    manifest.chunks.every(
      (chunk, i) =>
        chunk.object === `${String(i + 1).padStart(4, '0')}.sql.gz` &&
        Number.isSafeInteger(chunk.bytes) &&
        chunk.bytes > 0 &&
        chunk.bytes <= MAX_CHUNK &&
        /^[a-f0-9]{64}$/.test(chunk.sha256),
    );
  if (!ok) throw new Error('Invalid live-copy manifest');
  return manifest;
}

function storage(env, fetcher) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN)
    throw new Error('Missing Cloudflare credentials');
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/r2/buckets/${BUCKET}/objects/`;
  return async (key, body) => {
    const response = await fetcher(base + encodeURIComponent(key), {
      method: body ? 'PUT' : 'GET',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        ...(body && { 'Content-Type': 'application/json' }),
      },
      ...(body && { body }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error('Backup storage request failed');
    if (body) {
      const value = await response.json();
      if (value.success !== true || value.errors?.length)
        throw new Error('Backup storage response failed');
    }
    return response;
  };
}

/** 조각 하나를 파일로 받으면서 크기와 해시를 확인한다. 선언된 크기를 넘으면 바로 끊는다. */
async function fetchChunk(request, key, chunk, file) {
  const stored = await request(key);
  const hash = createHash('sha256');
  let received = 0;
  await pipeline(
    Readable.fromWeb(stored.body),
    new Transform({
      transform(data, _encoding, next) {
        received += data.length;
        hash.update(data);
        next(received > chunk.bytes ? new Error('Stored chunk too large') : null, data);
      },
    }),
    createWriteStream(file, { flags: 'wx', mode: 0o600 }),
  );
  if (received !== chunk.bytes || hash.digest('hex') !== chunk.sha256)
    throw new Error('Stored chunk does not match the manifest');
}

/**
 * 백업 하나를 받아 복원해 본다. 통과한 결과(행 내용 없음)를 돌려주고, publish면 검증 표시를 올린다.
 * `restorer`는 테스트가 바꿔 끼운다(기본은 restore-backup.py).
 */
export async function verifyLiveCopy(
  { env = process.env, target = 'production', day, output, publish = false, now = Date.now() },
  fetcher = fetch,
  restorer = runRestore,
) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(target)) throw new Error('Invalid backup environment');
  if (day !== undefined && !/^\d{4}-\d\d-\d\d$/.test(day)) throw new Error('Invalid backup day');
  const request = storage(env, fetcher);
  const manifestKey = day ? dayKey(target, day) : latestKey(target);
  const manifestBytes = Buffer.from(await (await request(manifestKey)).arrayBuffer());
  if (manifestBytes.length > 2 * 1024 * 1024) throw new Error('Manifest too large');
  const manifest = checkManifest(JSON.parse(manifestBytes.toString('utf8')), target);
  await mkdir(output, { mode: 0o700 });
  // 조각(압축) + 복원한 DB. 압축률을 모르니 조각 합의 12배와 1GiB를 요구한다.
  const compressed = manifest.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  const space = await statfs(output);
  if (space.bavail * space.bsize < compressed * 12 + 1024 ** 3)
    throw new Error('Insufficient private workspace capacity');
  for (const [i, chunk] of manifest.chunks.entries())
    await fetchChunk(
      request,
      manifest.prefix + chunk.object,
      chunk,
      join(output, `${String(i + 1).padStart(4, '0')}.sql`),
    );
  const restored = restorer({
    source: output,
    destination: join(output, 'restored.sqlite'),
    chunks: manifest.chunks.length,
    tables: manifest.tables,
    rows: manifest.rows,
    // 마감 행은 앞 조각의 행을 바꿔 넣는다. 한 줄이 기본 키가 같은 행과 고유 키가 같은 행을 함께 밀어낼 수 있어
    // 복원한 행 수는 마감 행 수의 두 배까지 적을 수 있다.
    minRows: Math.max(0, manifest.rows - 2 * (manifest.seal?.rows ?? 0)),
  });
  const passed =
    restored.integrityOk === true &&
    restored.countsMatch === true &&
    restored.foreignKeyViolations === 0;
  const result = {
    day: manifest.day,
    consistency: manifest.consistency,
    chunks: manifest.chunks.length,
    compressedBytes: compressed,
    tables: restored.tables,
    rows: restored.rows,
    expectedRows: manifest.rows,
    integrityOk: restored.integrityOk === true,
    countsMatch: restored.countsMatch === true,
    foreignKeyViolations: restored.foreignKeyViolations,
    restoreSeconds: restored.restoreSeconds,
    databaseBytes: restored.databaseBytes,
    passed,
    published: false,
  };
  if (passed && publish) {
    await request(
      verifiedKey(target),
      Buffer.from(
        JSON.stringify({
          format: VERIFIED_FORMAT,
          env: target,
          day: manifest.day,
          consistency: manifest.consistency,
          at: manifest.finishedAt,
          verifiedAt: now,
          manifestKey: dayKey(target, manifest.day),
          manifestSha256: sha256(manifestBytes),
          restored: {
            tables: restored.tables,
            rows: restored.rows,
            foreignKeyViolations: 0,
            restoreSeconds: restored.restoreSeconds,
            databaseBytes: restored.databaseBytes,
          },
        }),
      ),
    );
    result.published = true;
  }
  return result;
}

function runRestore({ source, destination, chunks, tables, rows, minRows }) {
  let stdout;
  try {
    stdout = execFileSync(
      'python3',
      [
        script,
        '--source',
        source,
        '--destination',
        destination,
        '--chunks',
        String(chunks),
        '--tables',
        String(tables),
        '--rows',
        String(rows),
        '--min-rows',
        String(minRows),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 },
    );
  } catch (e) {
    // The tool exits 1 with a JSON verdict when a check fails; keep that verdict.
    stdout = typeof e?.stdout === 'string' ? e.stdout : '';
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error('Local restore failed');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      env: { type: 'string', default: 'production' },
      day: { type: 'string' },
      output: { type: 'string' },
      publish: { type: 'boolean', default: false },
    },
  });
  verifyLiveCopy({
    target: values.env,
    day: values.day,
    output: values.output,
    publish: values.publish,
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.passed) process.exitCode = 1;
    })
    .catch(() => {
      console.error(
        'Live-copy verification failed before a verdict. No verification marker was published. Inspect the private workspace; SQL and row contents are suppressed.',
      );
      process.exitCode = 1;
    });
}
