import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const h = vi.hoisted(() => ({
  enabled: false,
  consent: 'granted',
  serverConsent: true,
  owned: false,
  platform: 'ios',
  storage: new Map(),
  consentListeners: [],
  sessionListeners: [],
  error: null,
  callback: null,
  finish: vi.fn(),
  request: vi.fn(),
  record: vi.fn(),
  available: vi.fn(),
  products: vi.fn(),
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
vi.mock('../../mobile/node_modules/react-native', () => ({
  Platform: {
    get OS() {
      return h.platform;
    },
  },
}));
vi.mock('../../mobile/node_modules/valtio', () => ({ proxy: (x) => x }));
vi.mock('../../mobile/node_modules/expo-iap', () => ({
  ErrorCode: { UserCancelled: 'cancel' },
  fetchProducts: h.products,
  finishTransaction: h.finish,
  requestPurchase: h.request,
  getAvailablePurchases: h.available,
  restorePurchases: async () => {},
}));
vi.mock('@offside/app-core/api/client', () => ({
  cachedGet: h.get,
  getProfile: h.profile,
  apiFetch: h.record,
}));
vi.mock('../../mobile/src/platform/setup', () => ({
  kv: {
    getBoolean: (key) => h.storage.get(key),
    getString: (k) => (k === 'offside_analytics_consent_v1' ? h.consent : h.storage.get(k)),
    set: (k, v) => h.storage.set(k, v),
    remove: (k) => h.storage.delete(k),
    addOnValueChangedListener: (fn) => {
      h.consentListeners.push(fn);
      return { remove() {} };
    },
  },
}));
vi.mock('../../mobile/src/platform/store', () => ({
  connectStore: async () => true,
  onStorePurchase: (cb) => (h.callback = cb),
  onStoreError: (cb) => (h.error = cb),
  STORE_SUPPORTED: true,
}));
vi.mock('../../mobile/src/platform/session', () => ({
  onSessionChanged: (fn) => {
    h.sessionListeners.push(fn);
    return () => {};
  },
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
  h.platform = 'ios';
  h.storage.clear();
  h.consentListeners = [];
  h.sessionListeners = [];
  h.consent = 'granted';
  h.serverConsent = true;
  h.get.mockImplementation(async () => ({
    ok: true,
    data: { granted: h.serverConsent, profileId: profile },
  }));
  h.profile.mockResolvedValue({ ok: true, data: { id: profile } });
  h.record.mockResolvedValue({ ok: true });
  h.available.mockResolvedValue([]);
  h.products.mockResolvedValue([]);
  h.finish.mockResolvedValue(undefined);
  h.request.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());
describe('native ad removal recording lifecycle', () => {
  it('rechecks native consent after an awaited server lookup before account lookup or upload', async () => {
    h.enabled = true;
    h.get.mockImplementation(async () => {
      h.consent = 'denied';
      return { ok: true, data: { granted: true, profileId: profile } };
    });
    const a = await import('../../mobile/src/platform/adFreeRecording');
    expect(await a.adFreeAccount()).toBeUndefined();
    expect(h.profile).not.toHaveBeenCalled();
    h.consent = 'granted';
    expect(await a.recordAdFree(purchase)).toBe(true);
    expect(h.record).not.toHaveBeenCalled();
  });
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
  it('attaches a valid existing account without forcing login; offline analytics is durable without delaying native acknowledgement', async () => {
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
    expect(h.finish).toHaveBeenCalledOnce();
    expect(h.storage.has('offside_ad_free_records_v1')).toBe(true);
    vi.resetModules(); // The store has already acknowledged; only persisted analytics remains.
    const queue = await import('../../mobile/src/platform/adFreeRecording');
    await queue.flushAdFreeRecords();
    expect(h.finish).toHaveBeenCalledOnce();
    expect(h.record).toHaveBeenCalledTimes(2);
    expect(h.storage.has('offside_ad_free_records_v1')).toBe(false);
  });
  it('Android acknowledgement proceeds while optional consent lookup hangs', async () => {
    h.platform = 'android';
    h.enabled = true;
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    h.get.mockReturnValue(new Promise(() => {}));
    h.callback(purchase);
    await vi.waitFor(() => expect(h.finish).toHaveBeenCalledOnce());
    expect(h.finish.mock.calls[0][0]).toMatchObject({ purchase, isConsumable: false });
    expect(h.storage.has('offside_ad_free_records_v1')).toBe(true);
    expect(h.record).not.toHaveBeenCalled();
  });
  it('Android analytics 409 never blocks acknowledgement; account change drops pending tokens', async () => {
    h.platform = 'android';
    h.enabled = true;
    h.record.mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    h.callback(purchase);
    await vi.waitFor(() => expect(h.record).toHaveBeenCalledOnce());
    expect(h.finish).toHaveBeenCalledOnce();
    expect(a.adFree.owned).toBe(true);
    h.sessionListeners.forEach((fn) => fn());
    expect(h.storage.has('offside_ad_free_records_v1')).toBe(false);
  });
  it('retries native acknowledgement during sync even when optional recording is off', async () => {
    h.platform = 'android';
    h.enabled = false;
    h.available.mockResolvedValue([purchase]);
    h.storage.set('offside_ad_free', true);
    const a = await import('../../mobile/src/platform/adFree');
    await a.syncAdFree();
    expect(h.finish).toHaveBeenCalledOnce();
    expect(h.profile).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
  });
  it.each(['reject', 'hang'])(
    'acknowledgement retry is independent of product price lookup %s',
    async (mode) => {
      h.platform = 'android';
      h.available.mockResolvedValue([purchase]);
      if (mode === 'reject') h.products.mockRejectedValue(new Error('price unavailable'));
      else h.products.mockReturnValue(new Promise(() => {}));
      const a = await import('../../mobile/src/platform/adFree');
      await a.syncAdFree();
      expect(h.finish).toHaveBeenCalledOnce();
      expect(a.adFree.owned).toBe(true);
    },
  );
  it('expired analytics is discarded locally without a lookup or upload', async () => {
    h.enabled = true;
    h.storage.set(
      'offside_ad_free_records_v1',
      JSON.stringify([
        {
          store: 'apple',
          token: 'expired',
          profileId: profile,
          queuedAt: Date.now() - 8 * 86400000,
        },
      ]),
    );
    const q = await import('../../mobile/src/platform/adFreeRecording');
    await q.flushAdFreeRecords();
    expect(h.storage.has('offside_ad_free_records_v1')).toBe(false);
    expect(h.get).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
  });
  it('Android cancelled/pending/failed transactions are never acknowledged or granted', async () => {
    h.platform = 'android';
    h.enabled = true;
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    h.error({ code: 'cancel' });
    h.callback({ ...purchase, purchaseState: 'pending' });
    h.callback({ ...purchase, purchaseState: 'failed' });
    expect(h.finish).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
    expect(a.adFree.owned).toBe(false);
  });
  it('native withdrawal clears durable analytics without uploading it', async () => {
    h.enabled = true;
    h.record.mockResolvedValue({ ok: false });
    const a = await import('../../mobile/src/platform/adFree');
    await a.buyAdFree();
    h.callback(purchase);
    await vi.waitFor(() => expect(h.record).toHaveBeenCalledOnce());
    h.consent = 'denied';
    h.consentListeners.forEach((fn) => fn('offside_analytics_consent_v1'));
    expect(h.storage.has('offside_ad_free_records_v1')).toBe(false);
    const queue = await import('../../mobile/src/platform/adFreeRecording');
    await queue.flushAdFreeRecords();
    expect(h.record).toHaveBeenCalledOnce();
  });
  it('pending and failed purchases create no record; restored legacy purchase is sent without inventing account/price', async () => {
    h.enabled = true;
    const a = await import('../../mobile/src/platform/adFree');
    h.callback({ ...purchase, purchaseState: 'pending' });
    expect(h.record).not.toHaveBeenCalled();
    h.available.mockResolvedValue([purchase]);
    await a.restoreAdFree();
    await vi.waitFor(() => expect(h.record).toHaveBeenCalledOnce());
    const payload = JSON.parse(h.record.mock.calls[0][1].body);
    expect(payload).toEqual({ store: 'apple', token: 'signed-fixture', profileId: profile });
    expect(h.finish).toHaveBeenCalledOnce();
  });
});
