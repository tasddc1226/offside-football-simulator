import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueGoogleCookie } from '../test/http.js';
import { applyMembership } from './apply.js';
import { handleGoogleMemberNotification } from './googleNotifications.js';
import { refreshMembershipChain } from './service.js';
import { tokenHash } from './types.js';
import { ANDROID_PACKAGE } from '../iap/google.js';
vi.mock('./service.js', () => ({ refreshMembershipChain: vi.fn() }));
let ctx: TestD1;
const NOW = '2026-10-12T00:00:00.000Z';
const envelope = (event: Record<string, unknown>) => ({
  message: {
    messageId: 'message',
    data: btoa(JSON.stringify({ packageName: ANDROID_PACKAGE, ...event })),
  },
});
beforeEach(async () => {
  ctx = await createTestD1();
  vi.mocked(refreshMembershipChain).mockReset();
  const { profileId } = await issueGoogleCookie(ctx);
  await applyMembership(
    ctx.db,
    profileId,
    {
      store: 'google',
      environment: 'production',
      chainId: await tokenHash('purchase-token'),
      status: 'active',
      paidUntil: '2026-11-12T00:00:00.000Z',
      graceUntil: null,
      autoRenew: true,
      verifiedAt: NOW,
      periods: [],
    },
    'encrypted',
  );
});
afterEach(async () => ctx.dispose());
it('refreshes once for a repeated notification and persists no raw purchase token', async () => {
  const body = envelope({
    subscriptionNotification: { purchaseToken: 'purchase-token', notificationType: 2 },
  });
  expect(await handleGoogleMemberNotification(ctx.env, ctx.db, body, NOW)).toBe('membership');
  expect(await handleGoogleMemberNotification(ctx.env, ctx.db, body, NOW)).toBe('membership');
  expect(refreshMembershipChain).toHaveBeenCalledTimes(1);
  const rows = await ctx.db.$client.prepare('SELECT * FROM membership_events').all();
  expect(JSON.stringify(rows)).not.toContain('purchase-token');
});
it('rechecks the exact voided old order even when the subscription has renewed', async () => {
  await handleGoogleMemberNotification(
    ctx.env,
    ctx.db,
    envelope({
      voidedPurchaseNotification: {
        purchaseToken: 'purchase-token',
        productType: 1,
        orderId: 'old-order',
      },
    }),
    NOW,
  );
  expect(vi.mocked(refreshMembershipChain).mock.calls[0]?.[5]).toBe('old-order');
});
it('rejects other packages and ignores unknown accounts', async () => {
  expect(
    await handleGoogleMemberNotification(ctx.env, ctx.db, envelope({ packageName: 'other' }), NOW),
  ).toBe('invalid');
  expect(
    await handleGoogleMemberNotification(
      ctx.env,
      ctx.db,
      envelope({ subscriptionNotification: { purchaseToken: 'unknown', notificationType: 2 } }),
      NOW,
    ),
  ).toBe('ignored');
  expect(refreshMembershipChain).not.toHaveBeenCalled();
});
it('retries after transient provider failure', async () => {
  const body = envelope({
    subscriptionNotification: { purchaseToken: 'purchase-token', notificationType: 2 },
  });
  vi.mocked(refreshMembershipChain).mockRejectedValueOnce(new Error('SECRET'));
  await expect(handleGoogleMemberNotification(ctx.env, ctx.db, body, NOW)).rejects.toThrow(
    'UPSTREAM',
  );
  expect(await handleGoogleMemberNotification(ctx.env, ctx.db, body, NOW)).toBe('membership');
});
