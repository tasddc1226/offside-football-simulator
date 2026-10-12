import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie } from '../test/http.js';
import { applyMembership } from './apply.js';
import { handleMemberAppleNotification } from './notifications.js';
import { refreshMembershipChain } from './service.js';
import { MEMBERSHIP_PRODUCT } from '@offside/contracts/membership';
import type { AppleNotification, AppleTransaction } from '../iap/apple.js';
vi.mock('./service.js', () => ({ refreshMembershipChain: vi.fn() }));
let ctx: TestD1;
const NOW = '2026-10-12T00:00:00.000Z';
const note: AppleNotification = {
  notificationUUID: 'event',
  notificationType: 'DID_RENEW',
  data: { environment: 'Production' },
};
const tx: AppleTransaction = {
  transactionId: 'transaction',
  originalTransactionId: 'chain',
  productId: MEMBERSHIP_PRODUCT,
  bundleId: 'com.offsidelab.app',
  environment: 'Production',
};
beforeEach(async () => {
  ctx = await createTestD1();
  vi.mocked(refreshMembershipChain).mockReset();
  const { profileId } = await issueGoogleCookie(ctx);
  await applyMembership(
    ctx.db,
    profileId,
    {
      store: 'apple',
      environment: 'production',
      chainId: 'chain',
      status: 'active',
      paidUntil: '2026-11-12T00:00:00.000Z',
      graceUntil: null,
      autoRenew: true,
      verifiedAt: NOW,
      periods: [],
    },
    null,
  );
});
afterEach(async () => ctx.dispose());
it('deduplicates successful events after a fresh verification', async () => {
  expect(await handleMemberAppleNotification(ctx.env, ctx.db, note, tx, NOW)).toBe('membership');
  expect(await handleMemberAppleNotification(ctx.env, ctx.db, note, tx, NOW)).toBe('membership');
  expect(refreshMembershipChain).toHaveBeenCalledTimes(1);
});
it('keeps a failed event retryable without storing sensitive upstream errors', async () => {
  vi.mocked(refreshMembershipChain).mockRejectedValueOnce(new Error('PRIVATE_TOKEN'));
  await expect(handleMemberAppleNotification(ctx.env, ctx.db, note, tx, NOW)).rejects.toThrow(
    'UPSTREAM',
  );
  expect(await handleMemberAppleNotification(ctx.env, ctx.db, note, tx, NOW)).toBe('membership');
  const row = await ctx.db.$client
    .prepare('SELECT attempts,status,error_code FROM membership_events')
    .first();
  expect(row).toMatchObject({ attempts: 2, status: 'done', error_code: null });
});
it('rejects inconsistent environment and never binds an unknown chain', async () => {
  expect(
    await handleMemberAppleNotification(
      ctx.env,
      ctx.db,
      note,
      { ...tx, environment: 'Sandbox' },
      NOW,
    ),
  ).toBe('invalid');
  expect(
    await handleMemberAppleNotification(
      ctx.env,
      ctx.db,
      note,
      { ...tx, originalTransactionId: 'unknown' },
      NOW,
    ),
  ).toBe('ignored');
  expect(refreshMembershipChain).not.toHaveBeenCalled();
});
