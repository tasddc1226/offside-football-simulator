import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { putVerifiedLiveCopy, putVerifiedRecovery } from '../test/backupRecovery.js';
import { inspectBackupRecovery, LIVE_VERIFIED_KEY, RECOVERY_MARKER_KEY } from './backupRecovery.js';
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
    await bucket.delete('d1-snapshots/production/fixture/0001.sql.gz');
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('unverified');
    await putVerifiedRecovery(bucket, NOW);
    // 달마다 한 번 찍는 스냅샷이라 35일까지는 verified다(T-11-686).
    expect((await inspectBackupRecovery(bucket, NOW + 34 * 24 * 3600000)).status).toBe('verified');
    expect((await inspectBackupRecovery(bucket, NOW + 36 * 24 * 3600000)).status).toBe('stale');
    await bucket.put('d1-snapshots/production/fixture/manifest.json', '{"verified":true}');
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('unverified');
    await putVerifiedRecovery(bucket, NOW + 120000);
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('unverified');
  });
  it('T-11-777 복원 검증을 통과한 매일 백업도 복구 보증으로 본다(10일까지)', async () => {
    const bucket = ctx.env.BACKUP!;
    const DAY = 24 * 3600000;
    // 공식 스냅샷 표시를 지우고 매일 백업 표시만으로 판정한다.
    await bucket.delete(RECOVERY_MARKER_KEY);
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('unverified');
    const at = NOW - 3600000;
    const { day, manifestKey } = await putVerifiedLiveCopy(bucket, at);
    expect(await inspectBackupRecovery(bucket, NOW)).toEqual({
      status: 'verified',
      snapshotAt: at,
      verifiedAt: at + 60_000,
      source: 'live-copy',
    });
    expect((await inspectBackupRecovery(bucket, at + 9 * DAY)).status).toBe('verified');
    expect((await inspectBackupRecovery(bucket, at + 11 * DAY)).status).toBe('stale');
    // 오래된 공식 스냅샷(stale)이 있어도 신선한 매일 백업 검증이 앞선다.
    await putVerifiedRecovery(bucket, NOW - 40 * DAY);
    expect(await inspectBackupRecovery(bucket, NOW)).toMatchObject({
      status: 'verified',
      source: 'live-copy',
    });
    // 둘 다 신선하면 더 최근 사본을 쓴다.
    await putVerifiedRecovery(bucket, NOW - 60_000);
    expect((await inspectBackupRecovery(bucket, NOW)).source).toBe('native-export');
    await putVerifiedRecovery(bucket, NOW - 40 * DAY);
    // 조각이 사라졌거나, 목록이 바뀌었거나, 외래 키가 깨진 검증은 보증이 아니다(남은 건 stale 공식 스냅샷).
    await bucket.delete(`d1/production/${day}/0001.sql.gz`);
    expect(await inspectBackupRecovery(bucket, NOW)).toMatchObject({
      status: 'stale',
      source: 'native-export',
    });
    await putVerifiedLiveCopy(bucket, at);
    await bucket.put(manifestKey, '{"format":"offside-d1-live-copy-v1"}');
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('stale');
    await putVerifiedLiveCopy(bucket, at, 3);
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('stale');
    await bucket.put(LIVE_VERIFIED_KEY, 'not json');
    expect((await inspectBackupRecovery(bucket, NOW)).status).toBe('stale');
  });
});
