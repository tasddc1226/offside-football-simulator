import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { getAttemptCount, recordAttempt } from './authAttempts.js';

describe('authAttempts repo', () => {
  let ctx: TestD1;

  beforeAll(async () => {
    ctx = await createTestD1();
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it('같은 윈도우에서는 카운트가 누적된다', async () => {
    const subject = 'subject-accumulate';
    const t0 = '2026-09-02T00:00:00.000Z';
    expect(await getAttemptCount(ctx.db, 'RECOVERY_ISSUE', subject, t0)).toBe(0);

    await recordAttempt(ctx.db, 'RECOVERY_ISSUE', subject, t0);
    expect(await getAttemptCount(ctx.db, 'RECOVERY_ISSUE', subject, '2026-09-02T00:30:00.000Z')).toBe(1);

    await recordAttempt(ctx.db, 'RECOVERY_ISSUE', subject, '2026-09-02T00:30:00.000Z');
    expect(await getAttemptCount(ctx.db, 'RECOVERY_ISSUE', subject, '2026-09-02T00:59:00.000Z')).toBe(2);
  });

  it('윈도우(1시간)가 지나면 카운트가 리셋된다', async () => {
    const subject = 'subject-reset';
    const t0 = '2026-09-02T00:00:00.000Z';
    await recordAttempt(ctx.db, 'RECOVERY_ISSUE', subject, t0);
    await recordAttempt(ctx.db, 'RECOVERY_ISSUE', subject, t0);

    const afterWindow = '2026-09-02T01:00:00.001Z';
    expect(await getAttemptCount(ctx.db, 'RECOVERY_ISSUE', subject, afterWindow)).toBe(0);

    await recordAttempt(ctx.db, 'RECOVERY_ISSUE', subject, afterWindow);
    expect(await getAttemptCount(ctx.db, 'RECOVERY_ISSUE', subject, afterWindow)).toBe(1);
  });

  it('kind와 subject가 다르면 독립적으로 집계된다', async () => {
    const t0 = '2026-09-02T00:00:00.000Z';
    await recordAttempt(ctx.db, 'RECOVERY_REDEEM', 'ip-1:ses-1', t0);

    expect(await getAttemptCount(ctx.db, 'RECOVERY_REDEEM', 'ip-2:ses-1', t0)).toBe(0);
    expect(await getAttemptCount(ctx.db, 'RECOVERY_ISSUE', 'ip-1:ses-1', t0)).toBe(0);
    expect(await getAttemptCount(ctx.db, 'RECOVERY_REDEEM', 'ip-1:ses-1', t0)).toBe(1);
  });
});
