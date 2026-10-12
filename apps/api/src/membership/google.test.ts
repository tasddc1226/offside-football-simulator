import { expect, it, vi } from 'vitest';
import { verifyGoogleMembership } from './google.js';
import { MEMBERSHIP_PRODUCT } from '@offside/contracts/membership';
import type { Bindings } from '../env.js';
vi.mock('../iap/google.js', () => ({
  accessToken: async () => 'test-auth',
  ANDROID_PACKAGE: 'com.offsidelab.app',
}));
const now = '2026-10-12T00:00:00.000Z';
const env = { GOOGLE_PLAY_SA_JSON: 'test' } as Bindings;
function fixture(state = 'SUBSCRIPTION_STATE_ACTIVE', account = '123', refund = false) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith(':acknowledge')) return new Response('{}');
    return Response.json(
      url.includes('/orders/')
        ? {
            orderId: 'order-2',
            purchaseToken: 'token',
            state: refund ? 'REFUNDED' : 'PROCESSED',
            lastEventTime: now,
            lineItems: [
              {
                productId: MEMBERSHIP_PRODUCT,
                total: { units: '4900' },
                subscriptionDetails: {
                  basePlanId: 'monthly',
                  offerPhase: 'BASE',
                  servicePeriodStartTime: now,
                  servicePeriodEndTime: '2026-11-12T00:00:00.000Z',
                },
              },
            ],
          }
        : {
            subscriptionState: state,
            acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
            externalAccountIdentifiers: { obfuscatedExternalAccountId: account },
            lineItems: [
              {
                productId: MEMBERSHIP_PRODUCT,
                expiryTime: '2026-11-12T00:00:00Z',
                latestSuccessfulOrderId: 'order-2',
                autoRenewingPlan: { autoRenewEnabled: state !== 'SUBSCRIPTION_STATE_CANCELED' },
                offerDetails: { basePlanId: 'monthly' },
              },
            ],
          },
    );
  };
  return { fetcher, calls };
}
it('uses the successful order for period identity and normalizes dates', async () => {
  const f = fixture();
  const m = await verifyGoogleMembership(env, 'token', 'prf_123', now, [], f.fetcher);
  expect(m.periods[0]?.transactionId).toBe('order-2');
  expect(m.chainId).not.toBe('token');
  expect(m.periods[0]?.paid).toBe(true);
  expect(m.paidUntil).toBe('2026-11-12T00:00:00.000Z');
  expect(f.calls).toHaveLength(2);
  await m.acknowledge?.();
  expect(f.calls[2]).toContain(':acknowledge');
});
it.each([
  ['SUBSCRIPTION_STATE_CANCELED', 'active'],
  ['SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'grace'],
  ['SUBSCRIPTION_STATE_ON_HOLD', 'hold'],
  ['SUBSCRIPTION_STATE_EXPIRED', 'expired'],
])('maps %s without confusing cancellation with expiry', async (s, expected) => {
  const m = await verifyGoogleMembership(env, 'token', 'prf_123', now, [], fixture(s).fetcher);
  expect(m.status).toBe(expected);
});
it('rejects an account mismatch before reading orders', async () => {
  const f = fixture('SUBSCRIPTION_STATE_ACTIVE', 'someone-else');
  await expect(verifyGoogleMembership(env, 'token', 'prf_123', now, [], f.fetcher)).rejects.toThrow(
    'OTHER_ACCOUNT',
  );
  expect(f.calls).toHaveLength(1);
});
it('records a verified refund', async () => {
  const m = await verifyGoogleMembership(
    env,
    'token',
    'prf_123',
    now,
    [],
    fixture('SUBSCRIPTION_STATE_EXPIRED', '123', true).fetcher,
  );
  expect(m.periods[0]?.refundedAt).toBe(now);
});
