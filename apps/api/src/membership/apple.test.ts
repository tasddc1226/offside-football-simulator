import { beforeEach, expect, it, vi } from 'vitest';
import { MEMBERSHIP_PRODUCT } from '@offside/contracts/membership';
import { refreshAppleMembership } from './apple.js';
import type { Bindings } from '../env.js';
import { verifyAppleTransaction, verifyAppleRenewal } from '../iap/apple.js';
vi.mock('../iap/apple.js', () => ({
  verifyAppleTransaction: vi.fn(),
  verifyAppleRenewal: vi.fn(),
}));
let env: Bindings;
const NOW = '2026-10-12T00:00:00.000Z';
const TX = {
  transactionId: 'paid-tx',
  originalTransactionId: 'chain',
  bundleId: 'com.offsidelab.app',
  productId: MEMBERSHIP_PRODUCT,
  type: 'Auto-Renewable Subscription',
  environment: 'Production',
  appAccountToken: '123',
  purchaseDate: Date.parse(NOW),
  expiresDate: Date.parse('2026-11-12T00:00:00.000Z'),
  price: 4900000,
};
beforeEach(async () => {
  vi.resetAllMocks();
  const key = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', key.privateKey);
  env = {
    APPLE_IAP_ISSUER_ID: 'issuer',
    APPLE_IAP_KEY_ID: 'key',
    APPLE_IAP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString('base64')}\n-----END PRIVATE KEY-----`,
  } as Bindings;
  vi.mocked(verifyAppleTransaction).mockResolvedValue({ ...TX });
  vi.mocked(verifyAppleRenewal).mockResolvedValue({
    originalTransactionId: 'chain',
    productId: MEMBERSHIP_PRODUCT,
    environment: 'Production',
    autoRenewStatus: 0,
  });
});
const fetcher: typeof fetch = async (input) =>
  Response.json(
    String(input).includes('/history/')
      ? { signedTransactions: ['signed'], hasMore: false }
      : {
          bundleId: 'com.offsidelab.app',
          environment: 'Production',
          data: [
            {
              lastTransactions: [
                {
                  status: 1,
                  originalTransactionId: 'chain',
                  signedTransactionInfo: 'signed',
                  signedRenewalInfo: 'renewal',
                },
              ],
            },
          ],
        },
  );
it('uses fresh store state and immutable paid history', async () => {
  const m = await refreshAppleMembership(env, 'chain', 'Production', 'prf_123', NOW, fetcher);
  expect(m.autoRenew).toBe(false);
  expect(m.status).toBe('active');
  expect(m.periods[0]?.paid).toBe(true);
  expect(m.periods[0]?.transactionId).toBe('paid-tx');
});
it('rejects an account mismatch', async () => {
  await expect(
    refreshAppleMembership(env, 'chain', 'Production', 'prf_other', NOW, fetcher),
  ).rejects.toThrow('OTHER_ACCOUNT');
});
it('requires verified renewal info and refuses a failed status lookup', async () => {
  vi.mocked(verifyAppleRenewal).mockResolvedValue(null);
  await expect(
    refreshAppleMembership(env, 'chain', 'Production', 'prf_123', NOW, fetcher),
  ).rejects.toThrow('INVALID');
  await expect(
    refreshAppleMembership(
      env,
      'chain',
      'Production',
      'prf_123',
      NOW,
      async () => new Response('', { status: 503 }),
    ),
  ).rejects.toThrow('UPSTREAM');
});
it('does not count free trials as paid tenure', async () => {
  vi.mocked(verifyAppleTransaction).mockResolvedValue({
    ...TX,
    price: 0,
    offerDiscountType: 'FREE_TRIAL',
  });
  const m = await refreshAppleMembership(env, 'chain', 'Production', 'prf_123', NOW, fetcher);
  expect(m.periods[0]?.paid).toBe(false);
});
