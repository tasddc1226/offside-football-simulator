// T-11-686 D1 export는 찍는 동안 운영 DB 요청을 막아 매일 돌릴 수 없다. 검증된 스냅샷은 달마다 한 번 정비 시간에 찍고
// (docs/operations/d1-consistent-recovery.md), 35일을 넘기면 stale로 알린다. 그 사이 복구는 D1 Time Travel이 맡는다.
const SNAPSHOT_STALE_MS = 35 * 24 * 60 * 60_000;

export const RECOVERY_MARKER_KEY = 'd1-snapshots/production/last-verified.json';
const PRODUCTION_DB = '2cfe462c-204e-4842-805c-5840fc9b1758';
export type BackupRecovery = {
  status: 'verified' | 'unverified' | 'stale';
  snapshotAt: number | null;
  verifiedAt: number | null;
};

/** Metadata checks do not replace a full periodic drill; the publisher has already restored R2 bytes. */
export async function inspectBackupRecovery(
  bucket: R2Bucket | undefined,
  now: number,
): Promise<BackupRecovery> {
  const unknown: BackupRecovery = { status: 'unverified', snapshotAt: null, verifiedAt: null };
  if (!bucket) return unknown;
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
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', content))]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
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
      !Array.isArray(manifest.chunks) ||
      !manifest.chunks.length
    )
      return unknown;
    if (manifest.chunks.length > 10000) return unknown;
    const prefix = marker.manifestKey.slice(0, -'manifest.json'.length);
    const expected = new Map<string, number>();
    for (const [i, chunk] of manifest.chunks.entries()) {
      if (
        chunk.object !== `${String(i + 1).padStart(4, '0')}.sql.gz` ||
        !Number.isSafeInteger(chunk.bytes) ||
        chunk.bytes <= 0 ||
        chunk.bytes > 64 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(chunk.sha256)
      )
        return unknown;
      expected.set(prefix + chunk.object, chunk.bytes);
    }
    // One bounded paginated listing, not one HEAD per chunk or a full payload download every hour.
    let cursor: string | undefined;
    let complete = false;
    for (let page = 0; page < 11; page++) {
      const listed = await bucket.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
      for (const item of listed.objects) {
        if (expected.has(item.key)) {
          if (expected.get(item.key) !== item.size) return unknown;
          expected.delete(item.key);
        }
      }
      if (!listed.truncated) {
        complete = true;
        break;
      }
      cursor = listed.cursor;
      if (!cursor) return unknown;
    }
    if (!complete || expected.size) return unknown;
    return {
      status: now - marker.at > SNAPSHOT_STALE_MS ? 'stale' : 'verified',
      snapshotAt: marker.at,
      verifiedAt: marker.verifiedAt,
    };
  } catch {
    return unknown;
  }
}
