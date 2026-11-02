const SNAPSHOT_STALE_MS = 30 * 60 * 60_000;

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
      chunks: unknown[];
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
    return {
      status: now - marker.at > SNAPSHOT_STALE_MS ? 'stale' : 'verified',
      snapshotAt: marker.at,
      verifiedAt: marker.verifiedAt,
    };
  } catch {
    return unknown;
  }
}
