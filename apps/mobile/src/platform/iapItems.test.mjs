/* global vi, beforeEach, describe, it, expect */
// T-11-434 상점 상품을 한 번 못 불러와도 실패를 기억하지 않고 '다시 확인'으로 다시 묻는지, 받지 못한 결제를 '지급 다시 확인'으로
// 다시 보내는지 본다.
const f = vi.hoisted(() => ({
  fetchItems: vi.fn(),
  claimIap: vi.fn(),
  connectStore: vi.fn(),
  fetchProducts: vi.fn(),
  getAvailablePurchases: vi.fn(),
  finishTransaction: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('react', () => ({ useEffect: (fn) => fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled' },
  fetchProducts: f.fetchProducts,
  finishTransaction: f.finishTransaction,
  getAvailablePurchases: f.getAvailablePurchases,
  requestPurchase: vi.fn(),
}));
vi.mock('@offside/contracts/cup', () => ({
  IAP_PRODUCT_IDS: ['reroll_5', 'boost_3', 'boost_100'],
  IAP_PRODUCTS: {
    reroll_5: { item: 'reroll', qty: 5 },
    boost_3: { item: 'boost', qty: 3 },
    boost_100: { item: 'boost', qty: 100 },
  },
}));
vi.mock('@offside/app-core/api/cup', () => ({ claimIap: f.claimIap, fetchItems: f.fetchItems }));
vi.mock('@offside/app-core/market', () => ({
  needsOwnerLogin: (e) => e.code === 'PROFILE_REQUIRED' || e.reason === 'GOOGLE_LOGIN_REQUIRED',
}));
vi.mock('@offside/app-core/i18n/ko/iap', () => ({
  iapText: {
    claimFail: 'claimFail',
    claimNone: 'claimNone',
    storeFail: 'storeFail',
    rerollDone: () => 'rerollDone',
    boostDone: () => 'boostDone',
    renameDone: () => 'renameDone',
  },
}));
vi.mock('@offside/app-core/i18n/ko/scout', () => ({ scoutText: { got: () => 'got' } }));
vi.mock('../game/host', () => ({ toast: f.toast }));
vi.mock('./session', () => ({ onSessionChanged: vi.fn() }));
vi.mock('./store', () => ({
  STORE_SUPPORTED: true,
  connectStore: f.connectStore,
  onStoreError: vi.fn(),
  onStorePurchase: vi.fn(),
}));
vi.mock('valtio', () => ({ proxy: (o) => o, useSnapshot: (o) => o }));

const items = {
  reroll: 1,
  boost: 2,
  scout: 0,
  rename: 0,
  iap: { account: 'acc', stores: ['apple'] },
};
const flush = () => new Promise((r) => setTimeout(r, 0));
let m;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  f.connectStore.mockResolvedValue(true);
  f.getAvailablePurchases.mockResolvedValue([]);
  f.finishTransaction.mockResolvedValue(undefined);
  f.fetchProducts.mockResolvedValue([{ id: 'reroll_5', displayPrice: '₩1,100' }]);
  m = await import('./iapItems');
});

describe('iap items sync (T-11-434)', () => {
  it.each([false, true])(
    'shows the 100-ticket pack only with a store price (listed=%s)',
    async (listed) => {
      f.fetchItems.mockResolvedValue({ ok: true, data: items });
      f.fetchProducts.mockResolvedValue([
        { id: 'boost_3', displayPrice: '₩1,100' },
        ...(listed ? [{ id: 'boost_100', displayPrice: '₩19,800' }] : []),
      ]);
      await m.retryIapItems();
      expect(m.sellablePacks('boost', m.iapItems)).toEqual(
        listed ? ['boost_3', 'boost_100'] : ['boost_3'],
      );
      expect(m.iapItems.prices.boost_100).toBe(listed ? '₩19,800' : undefined);
      expect(m.sellablePacks('boost', { ...m.iapItems, open: false })).toEqual([]);
    },
  );
  it('does not remember a failed load and asks again on retry', async () => {
    f.fetchItems.mockResolvedValueOnce({ ok: false, error: { code: 'NETWORK', retryable: true } });
    m.useIapItems(true);
    await flush();
    expect(m.iapItems.status).toBe('failed');
    expect(m.iapItems.open).toBe(false);
    expect(m.iapNotice(m.iapItems)).toBe(true);

    f.fetchItems.mockResolvedValueOnce({ ok: true, data: items });
    await m.retryIapItems();
    expect(f.fetchItems).toHaveBeenCalledTimes(2);
    expect(m.iapItems.status).toBe('ready');
    expect(m.iapItems.open).toBe(true);
    expect(m.iapItems.checking).toBe(false);
    // 한 번 받은 뒤에는 다시 상품 자리를 열어도 묻지 않는다.
    m.useIapItems(true);
    await flush();
    expect(f.fetchItems).toHaveBeenCalledTimes(2);
  });
  it('treats a store that throws as a failure to retry', async () => {
    f.fetchItems.mockResolvedValue({ ok: true, data: items });
    f.fetchProducts.mockRejectedValueOnce(new Error('store down'));
    await m.retryIapItems();
    expect(m.iapItems.status).toBe('failed');
    await m.retryIapItems();
    expect(m.iapItems.status).toBe('ready');
  });
  it('shows the login hint instead of an error before owner login', async () => {
    f.fetchItems.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', reason: 'GOOGLE_LOGIN_REQUIRED', retryable: false },
    });
    await m.retryIapItems();
    expect(m.iapItems.status).toBe('login');
    expect(m.iapNotice(m.iapItems)).toBe(true);
  });
  it('stays hidden when the server does not sell in this store', async () => {
    f.fetchItems.mockResolvedValue({
      ok: true,
      data: { ...items, iap: { account: 'a', stores: ['google'] } },
    });
    await m.retryIapItems();
    expect(m.iapItems.status).toBe('off');
    expect(m.iapNotice(m.iapItems)).toBe(false);
  });
});

describe('iap claim retry (T-11-434)', () => {
  const purchase = { productId: 'reroll_5', purchaseToken: 't', purchaseState: 'purchased' };
  it('offers a delivery recheck after a retryable claim failure and resends the purchase', async () => {
    f.fetchItems.mockResolvedValue({ ok: true, data: items });
    f.getAvailablePurchases.mockResolvedValue([purchase]);
    f.claimIap.mockResolvedValueOnce({ ok: false, error: { retryable: true, message: '' } });
    await m.retryIapItems();
    expect(m.iapItems.claimLeft).toBe(true);
    expect(f.finishTransaction).not.toHaveBeenCalled();

    f.claimIap.mockResolvedValueOnce({
      ok: true,
      data: { reroll: 6, boost: 2, scout: 0, rename: 0 },
    });
    await m.retryIapClaims();
    expect(f.claimIap).toHaveBeenCalledTimes(2);
    expect(f.finishTransaction).toHaveBeenCalledOnce();
    expect(m.iapItems.claimLeft).toBe(false);
    expect(m.iapItems.items.reroll).toBe(6);
    expect(f.toast).toHaveBeenLastCalledWith('rerollDone');
  });
  it('clears the recheck when nothing is left to deliver', async () => {
    m.iapItems.claimLeft = true;
    await m.retryIapClaims();
    expect(m.iapItems.claimLeft).toBe(false);
    expect(f.toast).toHaveBeenCalledWith('claimNone');
    expect(f.claimIap).not.toHaveBeenCalled();
  });
  it('keeps the recheck when the store is unreachable', async () => {
    m.iapItems.claimLeft = true;
    f.connectStore.mockResolvedValue(false);
    await m.retryIapClaims();
    expect(m.iapItems.claimLeft).toBe(true);
    expect(f.toast).toHaveBeenCalledWith('storeFail');
  });
});
