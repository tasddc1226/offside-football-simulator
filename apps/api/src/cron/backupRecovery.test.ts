import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { putVerifiedRecovery } from '../test/backupRecovery.js';
import { inspectBackupRecovery, RECOVERY_MARKER_KEY } from './backupRecovery.js';
const NOW = Date.parse('2026-11-02T04:00:00Z');
let ctx: TestD1;
beforeAll(async () => {
  ctx = await createTestD1();
});
afterAll(() => ctx.dispose());
describe('backup recovery assurance', () => {
  it('never treats a missing verified snapshot or drill evidence as production recovery assurance', async () => {
    const bucket = ctx.env.BACKUP!;
    expect((await inspectBackupRecovery(undefined, NOW)).status).toBe('unverified');
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('unverified');
    await bucket.put(RECOVERY_MARKER_KEY, JSON.stringify({ databaseId: 'drill' }));
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('unverified');
  });
  it('checks manifest hash, production identity and snapshot recency separately from live-copy completion', async () => {
    const bucket = ctx.env.BACKUP!;
    await putVerifiedRecovery(bucket, NOW);
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('verified');
    expect((await inspectBackupRecovery(bucket, NOW + 31 * 3600000)).status).toBe('stale');
    await bucket.put('d1-snapshots/production/fixture/manifest.json', '{"verified":true}');
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('unverified');
    await putVerifiedRecovery(bucket, NOW + 120000);
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('unverified');
  });
});
