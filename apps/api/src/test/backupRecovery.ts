import { LIVE_VERIFIED_KEY, RECOVERY_MARKER_KEY } from '../cron/backupRecovery.js';

export async function putVerifiedRecovery(bucket: R2Bucket, at: number) {
  const manifestKey = 'd1-snapshots/production/fixture/manifest.json';
  const content = JSON.stringify({
    format: 'offside-d1-snapshot-v1',
    consistency: 'd1-native-export',
    databaseId: '2cfe462c-204e-4842-805c-5840fc9b1758',
    createdAt: at,
    verified: true,
    chunks: [{ object: '0001.sql.gz', bytes: 7, sha256: '0'.repeat(64) }],
  });
  const hash = [
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))),
  ]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  await bucket.put('d1-snapshots/production/fixture/0001.sql.gz', 'fixture');
  await bucket.put(manifestKey, content);
  await bucket.put(
    RECOVERY_MARKER_KEY,
    JSON.stringify({
      format: 'offside-d1-snapshot-v1',
      databaseId: '2cfe462c-204e-4842-805c-5840fc9b1758',
      at,
      verifiedAt: at,
      manifestKey,
      manifestSha256: hash,
    }),
  );
}

/** T-11-777 복원 검증을 통과한 매일 백업 표시(조각 1개). `violations`를 주면 검증 실패 표시를 흉내 낸다. */
export async function putVerifiedLiveCopy(bucket: R2Bucket, at: number, violations = 0) {
  const day = new Date(at).toISOString().slice(0, 10);
  const manifestKey = `d1-manifests/production/${day}.json`;
  const content = JSON.stringify({
    format: 'offside-d1-live-copy-v1',
    env: 'production',
    day,
    prefix: `d1/production/${day}/`,
    consistency: 'sealed',
    finishedAt: at,
    chunks: [{ object: '0001.sql.gz', bytes: 7, sha256: '0'.repeat(64) }],
  });
  const hash = [
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))),
  ]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  await bucket.put(`d1/production/${day}/0001.sql.gz`, 'fixture');
  await bucket.put(manifestKey, content);
  await bucket.put(
    LIVE_VERIFIED_KEY,
    JSON.stringify({
      format: 'offside-d1-live-copy-verified-v1',
      env: 'production',
      day,
      at,
      verifiedAt: at + 60_000,
      manifestKey,
      manifestSha256: hash,
      restored: { foreignKeyViolations: violations },
    }),
  );
  return { day, manifestKey };
}
