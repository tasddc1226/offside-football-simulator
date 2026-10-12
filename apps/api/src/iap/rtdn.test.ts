import { describe, it, expect, vi } from 'vitest';
import type { Bindings } from '../env.js';
import { handleGoogleRtdn } from './rtdn.js';
import { getGooglePurchase, getGoogleSubscription } from './google.js';
import { recordBillingAlert } from './alerts.js';
vi.mock('./google.js', () => ({
  ANDROID_PACKAGE: 'com.offsidelab.app',
  getGooglePurchase: vi.fn(),
  getGoogleSubscription: vi.fn(),
}));
vi.mock('./alerts.js', () => ({ recordBillingAlert: vi.fn() }));
const env = { GOOGLE_PLAY_SA_JSON: 'test' } as Bindings;
const envelope = (note: object) => ({
  message: {
    messageId: '1',
    data: btoa(JSON.stringify({ packageName: 'com.offsidelab.app', ...note })),
  },
});
describe('Play RTDN uses verified purchase state', () => {
  it('does not alert for pending purchases; dedup key uses purchaseToken like claims', async () => {
    vi.clearAllMocks();
    const body = envelope({
      oneTimeProductNotification: { notificationType: 1, sku: 'product', purchaseToken: 'secret' },
    });
    vi.mocked(getGooglePurchase).mockResolvedValue({ purchaseState: 2 });
    await handleGoogleRtdn(env, body, '2026-10-12T00:00:00Z');
    expect(recordBillingAlert).not.toHaveBeenCalled();
    vi.mocked(getGooglePurchase).mockResolvedValue({ purchaseState: 0, purchaseType: 0 });
    await handleGoogleRtdn(env, body, '2026-10-12T00:00:00Z');
    expect(recordBillingAlert).toHaveBeenCalledWith(
      env,
      {
        store: 'google',
        transactionId: 'secret',
        kind: 'purchase',
        productId: 'product',
        test: true,
      },
      expect.any(String),
    );
  });
  it('uses each verified successful order ID for subscription renewal', async () => {
    vi.clearAllMocks();
    vi.mocked(getGoogleSubscription).mockResolvedValue({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      lineItems: [{ productId: 'membership', latestSuccessfulOrderId: 'order..1' }],
    });
    await handleGoogleRtdn(
      env,
      envelope({ subscriptionNotification: { notificationType: 2, purchaseToken: 'secret' } }),
      '2026-10-12T00:00:00Z',
    );
    expect(recordBillingAlert).toHaveBeenCalledWith(
      env,
      {
        store: 'google',
        transactionId: 'order..1',
        kind: 'renewal',
        productId: 'membership',
        test: false,
      },
      expect.any(String),
    );
  });
});
