import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const h = vi.hoisted(() => ({
  enabled: false,
  consent: 'granted',
  serverConsent: true,
  owned: false,
  callback: null,
  finish: vi.fn(),
  request: vi.fn(),
  record: vi.fn(),
  available: vi.fn(),
  profile: vi.fn(),
  get: vi.fn(),
}));
vi.mock('../../mobile/node_modules/expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        get accountPurchaseRecording() {
          return h.enabled;
        },
      },
    },
  },
}));
vi.mock('../../mobile/node_modules/react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../../mobile/node_modules/valtio', () => ({ proxy: (x) => x }));
vi.mock('../../mobile/node_modules/expo-iap', () => ({
  ErrorCode: { UserCancelled: 'cancel' },
  fetchProducts: async () => [],
  finishTransaction: h.finish,
  requestPurchase: h.request,
  getAvailablePurchases: h.available,
  restorePurchases: async () => {},
}));
vi.mock('@offside/app-core/api/client', () => ({
  cachedGet: async () => ({
    ok: true,
    data: { granted: h.serverConsent, profileId: 'prf_11111111-1111-4111-8111-111111111111' },
  }),
  getProfile: h.profile,
  apiFetch: h.record,
}));
vi.mock('../../mobile/src/platform/setup', () => ({
  kv: { getBoolean: () => false, getString: () => h.consent, set: vi.fn() },
}));
vi.mock('../../mobile/src/platform/store', () => ({
  connectStore: async () => true,
  onStorePurchase: (cb) => (h.callback = cb),
  onStoreError: () => {},
  STORE_SUPPORTED: true,
}));
const profile = 'prf_11111111-1111-4111-8111-111111111111';
const purchase = {
  productId: 'com.offsidelab.app.remove_ads',
  purchaseState: 'purchased',
  purchaseToken: 'signed-fixture',
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  h.enabled = false;
  h.consent = 'granted';
  h.serverConsent = true;
  h.profile.mockResolvedValue({ ok: true, data: { id: profile } });
  h.record.mockResolvedValue({ ok: true });
  h.available.mockResolvedValue([]);
  h.finish.mockResolvedValue(undefined);
  h.request.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());
describe('native ad removal recording lifecycle', () => {
  it('does not apply a cached acquisition consent to a switched profile', async () => {
    h.enabled = true;
    h.profile.mockResolvedValue({
      ok: true,
      data: { id: 'prf_22222222-2222-4222-8222-222222222222' },
    });
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    expect(h.request.mock.calls[0][0].request.apple.appAccountToken).toBeUndefined();
  });
  it('server acquisition refusal prevents optional upload even with native analytics consent', async () => {
    h.enabled = true;
    h.serverConsent = false;
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    h.callback(purchase);
    await vi.waitFor(() => expect(h.finish).toHaveBeenCalledOnce());
    expect(h.profile).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
  });
  it('native consent off prevents both account lookup and optional transaction upload', async () => {
    h.enabled = true;
    h.consent = 'denied';
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    h.callback(purchase);
    await vi.waitFor(() => expect(h.finish).toHaveBeenCalledOnce());
    expect(h.profile).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
  });
  it('default off preserves legacy purchase behaviour without server/account requests', async () => {
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    expect(h.profile).not.toHaveBeenCalled();
    h.callback(purchase);
    await vi.waitFor(() => expect(h.finish).toHaveBeenCalledOnce());
    expect(h.record).not.toHaveBeenCalled();
    expect(a.adFree.owned).toBe(true);
  });
  it('attaches a valid existing account without forcing login; offline record keeps transaction retryable but grants entitlement', async () => {
    h.enabled = true;
    h.record.mockResolvedValueOnce({ ok: false });
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    expect(h.request.mock.calls[0][0].request.apple.appAccountToken).toBe(
      profile.replace(/^prf_/, ''),
    );
    h.callback(purchase);
    await vi.waitFor(() => expect(h.record).toHaveBeenCalledOnce());
    expect(a.adFree.owned).toBe(true);
    expect(h.finish).not.toHaveBeenCalled();
    h.available.mockResolvedValue([purchase]);
    await a.syncAdFree();
    expect(h.finish).toHaveBeenCalledOnce();
    expect(h.record).toHaveBeenCalledTimes(2);
  });
  it('pending and failed purchases create no record; restored legacy purchase is sent without inventing account/price', async () => {
    h.enabled = true;
    const a = await import('../../mobile/src/platform/adFree');
    h.callback({ ...purchase, purchaseState: 'pending' });
    expect(h.record).not.toHaveBeenCalled();
    h.available.mockResolvedValue([purchase]);
    await a.restoreAdFree();
    expect(h.record).toHaveBeenCalledOnce();
    const payload = JSON.parse(h.record.mock.calls[0][1].body);
    expect(payload).toEqual({ store: 'apple', token: 'signed-fixture' });
    expect(h.finish).toHaveBeenCalledOnce();
  });
});
