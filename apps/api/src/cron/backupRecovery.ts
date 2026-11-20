// T-11-686 D1 export는 찍는 동안 운영 DB 요청을 막아 매일 돌릴 수 없다. 검증된 스냅샷은 달마다 한 번 정비 시간에 찍고
// (docs/operations/d1-consistent-recovery.md), 35일을 넘기면 stale로 알린다. 그 사이 복구는 D1 Time Travel이 맡는다.
const SNAPSHOT_STALE_MS = 35 * 24 * 60 * 60_000;
// T-11-777 매일 백업은 마감으로 외래 키를 맞추고, 워크플로(d1-backup-verify.yml)가 매일 R2에서 받아 복원해 본 뒤
// 표시를 올린다. 운영 DB를 막지 않는다. 검증이 10일 동안 통과하지 못하면 stale이다. 둘 중 하나라도 신선하면 verified다.
const LIVE_STALE_MS = 10 * 24 * 60 * 60_000;
export const LIVE_VERIFIED_KEY = 'd1-manifests/production/last-verified.json';

export const RECOVERY_MARKER_KEY = 'd1-snapshots/production/last-verified.json';
const PRODUCTION_DB = '2cfe462c-204e-4842-805c-5840fc9b1758';
export type BackupRecovery = {
  status: 'verified' | 'unverified' | 'stale';
  snapshotAt: number | null;
  verifiedAt: number | null;
  /** 판정에 쓴 사본. native-export: 정비 때 찍는 공식 export, live-copy: 복원 검증을 통과한 매일 백업. */
  source?: 'native-export' | 'live-copy';
};

const sha256Hex = async (content: ArrayBuffer) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', content))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

/** One bounded paginated listing, not one HEAD per chunk or a full payload download every hour. */
async function chunksPresent(
  bucket: R2Bucket,
  prefix: string,
  expected: Map<string, number>,
): Promise<boolean> {
  let cursor: string | undefined;
  for (let page = 0; page < 11; page++) {
    const listed = await bucket.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const item of listed.objects) {
      if (expected.has(item.key)) {
        if (expected.get(item.key) !== item.size) return false;
        expected.delete(item.key);
      }
    }
    if (!listed.truncated) return expected.size === 0;
    cursor = listed.cursor;
    if (!cursor) return false;
  }
  return false;
}

type Chunk = { object: string; bytes: number; sha256: string };
/** 조각 이름·크기·해시 모양을 검사하고 `접두사+이름 → 크기`를 돌려준다. 틀리면 null. */
function expectedChunks(prefix: string, chunks: unknown): Map<string, number> | null {
  if (!Array.isArray(chunks) || !chunks.length || chunks.length > 10000) return null;
  const expected = new Map<string, number>();
  for (const [i, chunk] of (chunks as Chunk[]).entries()) {
    if (
      chunk.object !== `${String(i + 1).padStart(4, '0')}.sql.gz` ||
      !Number.isSafeInteger(chunk.bytes) ||
      chunk.bytes <= 0 ||
      chunk.bytes > 64 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(chunk.sha256)
    )
      return null;
    expected.set(prefix + chunk.object, chunk.bytes);
  }
  return expected;
}

/** 복원 검증을 통과한 매일 백업(T-11-777). 표시 → 조각 목록(해시) → 조각 존재·크기 순으로 확인한다. */
async function inspectLiveCopy(bucket: R2Bucket, now: number): Promise<BackupRecovery | null> {
  const markerObject = await bucket.get(LIVE_VERIFIED_KEY);
  if (!markerObject || markerObject.size > 16 * 1024) return null;
  const marker = await markerObject.json<{
    format: string;
    env: string;
    day: string;
    at: number;
    verifiedAt: number;
    manifestKey: string;
    manifestSha256: string;
    restored: { foreignKeyViolations: number };
  }>();
  if (
    marker.format !== 'offside-d1-live-copy-verified-v1' ||
    marker.env !== 'production' ||
    !/^\d{4}-\d\d-\d\d$/.test(marker.day) ||
    !Number.isFinite(marker.at) ||
    !Number.isFinite(marker.verifiedAt) ||
    marker.verifiedAt < marker.at ||
    marker.verifiedAt > now + 60_000 ||
    marker.manifestKey !== `d1-manifests/production/${marker.day}.json` ||
    !/^[a-f0-9]{64}$/.test(marker.manifestSha256) ||
    marker.restored?.foreignKeyViolations !== 0
  )
    return null;
  const object = await bucket.get(marker.manifestKey);
  if (!object || object.size > 2 * 1024 * 1024) return null;
  const content = await object.arrayBuffer();
  if ((await sha256Hex(content)) !== marker.manifestSha256) return null;
  const manifest = JSON.parse(new TextDecoder().decode(content)) as {
    format: string;
    env: string;
    day: string;
    prefix: string;
    finishedAt: number;
    chunks: unknown;
  };
  const prefix = `d1/production/${marker.day}/`;
  if (
    manifest.format !== 'offside-d1-live-copy-v1' ||
    manifest.env !== 'production' ||
    manifest.day !== marker.day ||
    manifest.prefix !== prefix ||
    manifest.finishedAt !== marker.at
  )
    return null;
  const expected = expectedChunks(prefix, manifest.chunks);
  if (!expected || !(await chunksPresent(bucket, prefix, expected))) return null;
  return {
    status: now - marker.at > LIVE_STALE_MS ? 'stale' : 'verified',
    snapshotAt: marker.at,
    verifiedAt: marker.verifiedAt,
    source: 'live-copy',
  };
}

/** 두 사본 중 더 나은 판정을 고른다: verified가 stale보다, 같은 상태면 더 최근 사본이 앞선다. */
export async function inspectBackupRecovery(
  bucket: R2Bucket | undefined,
  now: number,
): Promise<BackupRecovery> {
  const unknown: BackupRecovery = { status: 'unverified', snapshotAt: null, verifiedAt: null };
  if (!bucket) return unknown;
  const [native, live] = await Promise.all([
    inspectNativeExport(bucket, now),
    inspectLiveCopy(bucket, now).catch(() => null),
  ]);
  const rank = (r: BackupRecovery | null) =>
    !r ? 0 : r.status === 'verified' ? 2 : r.status === 'stale' ? 1 : 0;
  const candidates = [native, live].filter((r): r is BackupRecovery => rank(r) > 0);
  candidates.sort((a, b) => rank(b) - rank(a) || (b.snapshotAt ?? 0) - (a.snapshotAt ?? 0));
  return candidates[0] ?? unknown;
}

/** Metadata checks do not replace a full periodic drill; the publisher has already restored R2 bytes. */
async function inspectNativeExport(bucket: R2Bucket, now: number): Promise<BackupRecovery> {
  const unknown: BackupRecovery = { status: 'unverified', snapshotAt: null, verifiedAt: null };
  try {
    const markerObject = await bucket.get(RECOVERY_MARKER_KEY);
    if (!markerObject || markerObject.size > 16 * 1024) return unknown;
    const marker = await markerObject.json<{
      format: string;
      databaseId: string;
      at: number;
      verifiedAt: number;
      manifestKey: string;
      manifestSha256: string;
    }>();
    if (
      marker.format !== 'offside-d1-snapshot-v1' ||
      marker.databaseId !== PRODUCTION_DB ||
      !Number.isFinite(marker.at) ||
      !Number.isFinite(marker.verifiedAt) ||
      marker.verifiedAt < marker.at ||
      marker.at > now + 60_000 ||
      marker.verifiedAt > now + 60_000 ||
      !/^d1-snapshots\/production\/[a-zA-Z0-9_-]+\/manifest\.json$/.test(marker.manifestKey) ||
      !/^[a-f0-9]{64}$/.test(marker.manifestSha256)
    )
      return unknown;
    const object = await bucket.get(marker.manifestKey);
    if (!object || object.size > 2 * 1024 * 1024) return unknown;
    const content = await object.arrayBuffer();
    const hash = await sha256Hex(content);
    if (hash !== marker.manifestSha256) return unknown;
    const manifest = JSON.parse(new TextDecoder().decode(content)) as {
      format: string;
      consistency: string;
      databaseId: string;
      createdAt: number;
      verified: boolean;
      chunks: { object: string; bytes: number; sha256: string }[];
    };
    if (
      manifest.format !== marker.format ||
      manifest.consistency !== 'd1-native-export' ||
      manifest.databaseId !== PRODUCTION_DB ||
      manifest.createdAt !== marker.at ||
      manifest.verified !== true ||
      !Array.isArray(manifest.chunks)
    )
      return unknown;
    const prefix = marker.manifestKey.slice(0, -'manifest.json'.length);
    const expected = expectedChunks(prefix, manifest.chunks);
    if (!expected || !(await chunksPresent(bucket, prefix, expected))) return unknown;
    return {
      status: now - marker.at > SNAPSHOT_STALE_MS ? 'stale' : 'verified',
      snapshotAt: marker.at,
      verifiedAt: marker.verifiedAt,
      source: 'native-export',
    };
  } catch {
    return unknown;
  }
}
