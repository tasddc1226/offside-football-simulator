import { RECOVERY_MARKER_KEY } from '../cron/backupRecovery.js';

export async function putVerifiedRecovery(bucket: R2Bucket, at: number) {
  const manifestKey = 'd1-snapshots/production/fixture/manifest.json';
  const content = JSON.stringify({
    format: 'offside-d1-snapshot-v1',
    consistency: 'd1-native-export',
    databaseId: '2cfe462c-204e-4842-805c-5840fc9b1758',
    createdAt: at,
    verified: true,
    chunks: [{}],
  });
  const hash = [
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))),
  ]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
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
