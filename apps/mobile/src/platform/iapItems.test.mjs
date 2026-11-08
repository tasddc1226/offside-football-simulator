/* global vi, beforeEach, afterEach, describe, it, expect */
// T-11-434 상점 상품을 한 번 못 불러와도 실패를 기억하지 않고 '다시 확인'으로 다시 묻는지, 받지 못한 결제를 '지급 다시 확인'으로
// 다시 보내는지 본다.
const f = vi.hoisted(() => ({
  fetchItems: vi.fn(),
  claimIap: vi.fn(),
  connectStore: vi.fn(),
  fetchProducts: vi.fn(),
  getAvailablePurchases: vi.fn(),
  finishTransaction: vi.fn(),
  requestPurchase: vi.fn(),
  toast: vi.fn(),
  trackCommerce: vi.fn(),
  handlers: { purchase: null, error: null, session: null, consent: null },
}));
vi.mock('react', () => ({ useEffect: (fn) => fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled' },
  fetchProducts: f.fetchProducts,
  finishTransaction: f.finishTransaction,
  getAvailablePurchases: f.getAvailablePurchases,
  requestPurchase: f.requestPurchase,
}));
vi.mock('@offside/contracts/cup', () => ({
  IAP_PRODUCT_IDS: ['reroll_5', 'boost_3', 'boost_100'],
  IAP_PRODUCTS: {
    reroll_5: { item: 'reroll', qty: 5 },
    boost_3: { item: 'boost', qty: 3 },
    boost_100: { item: 'boost', qty: 100 },
  },
}));
vi.mock('../analytics', () => ({
  trackCommerce: f.trackCommerce,
  onAnalyticsConsent: (fn) => {
    f.handlers.consent = fn;
    return () => {};
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
    pending: 'pending',
    payFail: 'payFail',
    payStartFail: 'payStartFail',
  },
}));
vi.mock('@offside/app-core/i18n/ko/scout', () => ({ scoutText: { got: () => 'got' } }));
vi.mock('../game/host', () => ({ toast: f.toast }));
vi.mock('./session', () => ({ onSessionChanged: (fn) => (f.handlers.session = fn) }));
vi.mock('./store', () => ({
  STORE_SUPPORTED: true,
  connectStore: f.connectStore,
  onStoreError: (fn) => (f.handlers.error = fn),
  onStorePurchase: (fn) => (f.handlers.purchase = fn),
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
  f.requestPurchase.mockResolvedValue(undefined);
  f.trackCommerce.mockImplementation(() => {});
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

// 강화권 · 스카우트권 구매 퍼널(commerce_stage). 실제 iapItems 어댑터에 스토어 콜백 · 서버 응답 · 계정 · 동의 변화를 순서대로 넣고
// 결제 · 지급 · 마무리 동작이 그대로인지와 계측이 언제 남는지를 같이 본다.
describe('commerce funnel on the native purchase adapter', () => {
  const T0 = Date.parse('2026-11-08T10:00:00Z');
  const granted = { ok: true, data: { reroll: 1, boost: 12, scout: 0, rename: 0 } };
  const buy = (over = {}) => ({
    id: 'tx-new',
    productId: 'boost_3',
    purchaseToken: 'tok',
    purchaseState: 'purchased',
    transactionDate: T0 + 1000,
    ...over,
  });
  // SDK가 실제로 보낼 때 alive()를 다시 보므로, 지금 살아 있는 관측만 '보냄'으로 센다.
  const sent = () =>
    f.trackCommerce.mock.calls.filter(([, alive]) => alive()).map(([o]) => o.stage);
  const all = () => f.trackCommerce.mock.calls.map(([o]) => o.stage);
  async function ready() {
    vi.spyOn(Date, 'now').mockReturnValue(T0);
    f.fetchItems.mockResolvedValue({ ok: true, data: items });
    f.fetchProducts.mockResolvedValue([{ id: 'boost_3', displayPrice: '₩1,100' }]);
    await m.retryIapItems();
    f.trackCommerce.mockClear();
  }
  afterEach(() => vi.restoreAllMocks());

  it('success only after the server grant response, once, with allowlisted fields', async () => {
    await ready();
    let answer;
    f.claimIap.mockReturnValue(new Promise((r) => (answer = r)));
    await m.buyIapItem('boost_3', 'player_tab');
    expect(all()).toEqual(['offer_select', 'checkout_request']);
    f.handlers.purchase(buy());
    await flush();
    // 스토어 콜백만으로는 성공이 아니다.
    expect(all()).not.toContain('grant_ack');
    answer(granted);
    await flush();
    expect(sent()).toEqual(['offer_select', 'checkout_request', 'grant_ack']);
    const ack = f.trackCommerce.mock.calls.at(-1)[0];
    expect(ack).toEqual({
      item: 'boost',
      entry: 'player_tab',
      store: 'apple',
      packSize: 3,
      stage: 'grant_ack',
    });
    expect(JSON.stringify(f.trackCommerce.mock.calls)).not.toMatch(/tok|tx-new|acc|₩/);
    // 지급 · 마무리 동작은 그대로다.
    expect(f.finishTransaction).toHaveBeenCalledOnce();
    expect(m.iapItems.items.boost).toBe(12);
    expect(f.toast).toHaveBeenLastCalledWith('boostDone');
  });

  it('duplicate purchase callbacks claim as before but emit one success', async () => {
    await ready();
    f.claimIap.mockResolvedValue(granted);
    await m.buyIapItem('boost_3');
    f.handlers.purchase(buy());
    f.handlers.purchase(buy());
    await flush();
    expect(f.claimIap).toHaveBeenCalledTimes(2);
    expect(sent().filter((s) => s === 'grant_ack')).toHaveLength(1);
  });

  it('user cancel (listener or rejected request) is checkout_cancel, not error; no success', async () => {
    await ready();
    await m.buyIapItem('boost_3');
    f.handlers.error({ code: 'user-cancelled' });
    expect(sent()).toEqual(['offer_select', 'checkout_request', 'checkout_cancel']);
    expect(f.toast).not.toHaveBeenCalledWith('payFail');

    f.trackCommerce.mockClear();
    f.requestPurchase.mockRejectedValueOnce({ code: 'user-cancelled', message: 'secret text' });
    await m.buyIapItem('boost_3');
    expect(sent()).toEqual(['offer_select', 'checkout_request', 'checkout_cancel']);
    expect(f.toast).toHaveBeenLastCalledWith('payStartFail');
  });

  it('pending ends the attempt: a later purchased callback grants but is not counted', async () => {
    await ready();
    f.claimIap.mockResolvedValue(granted);
    await m.buyIapItem('boost_3');
    f.handlers.purchase(buy({ purchaseState: 'pending' }));
    expect(sent()).toEqual(['offer_select', 'checkout_request', 'checkout_pending']);
    expect(f.toast).toHaveBeenLastCalledWith('pending');
    f.handlers.purchase(buy());
    await flush();
    expect(f.claimIap).toHaveBeenCalledOnce();
    expect(all()).not.toContain('grant_ack');
  });

  it('store errors, rejected starts and unreachable store are checkout_error with fixed reasons', async () => {
    await ready();
    await m.buyIapItem('boost_3');
    f.handlers.error({ code: 'network-error', message: 'E_NET https://x' });
    f.requestPurchase.mockRejectedValueOnce(new Error('boom'));
    await m.buyIapItem('boost_3');
    f.connectStore.mockResolvedValueOnce(false);
    await m.buyIapItem('boost_3');
    const errors = f.trackCommerce.mock.calls
      .map(([o]) => o)
      .filter((o) => o.stage === 'checkout_error');
    expect(errors.map((o) => o.reason)).toEqual([
      'store_error',
      'start_failed',
      'store_unavailable',
    ]);
    expect(JSON.stringify(errors)).not.toMatch(/E_NET|boom|https/);
  });

  it.each([
    [true, 'grant_retryable'],
    [false, 'grant_rejected'],
  ])(
    'server verify failure (retryable=%s) is grant_fail and keeps the transaction unfinished',
    async (retryable, reason) => {
      await ready();
      f.claimIap.mockResolvedValue({ ok: false, error: { retryable, message: 'server said x' } });
      await m.buyIapItem('boost_3');
      f.handlers.purchase(buy());
      await flush();
      expect(sent()).toEqual(['offer_select', 'checkout_request', 'grant_fail']);
      expect(f.trackCommerce.mock.calls.at(-1)[0].reason).toBe(reason);
      expect(f.finishTransaction).not.toHaveBeenCalled();
      expect(m.iapItems.claimLeft).toBe(retryable);
    },
  );

  it('an old same-SKU transaction arriving during a new checkout is not counted as success', async () => {
    await ready();
    f.claimIap.mockResolvedValue(granted);
    await m.buyIapItem('boost_3');
    f.handlers.purchase(buy({ id: 'tx-old', transactionDate: T0 - 3_600_000 }));
    await flush();
    expect(f.claimIap).toHaveBeenCalledOnce(); // 지급은 그대로
    expect(all()).not.toContain('grant_ack');
    // 뒤따른 진짜 새 거래도 애매해서 세지 않는다(보수적 제외).
    f.handlers.purchase(buy());
    await flush();
    expect(all()).not.toContain('grant_ack');
  });

  it('a same-SKU transaction from 1 second before the checkout is not counted (no grace window)', async () => {
    await ready();
    f.claimIap.mockResolvedValue(granted);
    await m.buyIapItem('boost_3');
    f.handlers.purchase(buy({ id: 'tx-recovered', transactionDate: T0 - 1000 }));
    await flush();
    expect(f.claimIap).toHaveBeenCalledOnce(); // 지급 · 마무리는 그대로
    expect(f.finishTransaction).toHaveBeenCalledOnce();
    expect(all()).not.toContain('grant_ack');
  });

  it('a transaction already seen in store sync is not counted when it arrives during checkout', async () => {
    f.getAvailablePurchases.mockResolvedValue([buy({ id: 'tx-left', transactionDate: T0 + 5000 })]);
    f.claimIap.mockResolvedValue({ ok: false, error: { retryable: true, message: '' } });
    await ready();
    f.claimIap.mockResolvedValue(granted);
    await m.buyIapItem('boost_3');
    f.handlers.purchase(buy({ id: 'tx-left', transactionDate: T0 + 5000 }));
    await flush();
    expect(all()).not.toContain('grant_ack');
  });

  it('recovery (delivery recheck / app start) never emits checkout or success', async () => {
    await ready();
    f.getAvailablePurchases.mockResolvedValue([buy()]);
    f.claimIap.mockResolvedValue(granted);
    m.iapItems.claimLeft = true;
    await m.retryIapClaims();
    await m.recoverIapItems();
    await flush();
    expect(f.finishTransaction).toHaveBeenCalled();
    expect(f.trackCommerce).not.toHaveBeenCalled();
  });

  it('account switch while the claim is in flight: no grant_ack, queued observations die', async () => {
    await ready();
    let answer;
    f.claimIap.mockReturnValue(new Promise((r) => (answer = r)));
    await m.buyIapItem('boost_3');
    f.handlers.purchase(buy());
    await flush();
    f.handlers.session();
    answer(granted);
    await flush();
    expect(all()).not.toContain('grant_ack');
    expect(sent()).toEqual([]); // 앞서 줄에 올린 select · request도 실제 전송 직전에 버려진다
    expect(f.finishTransaction).toHaveBeenCalledOnce(); // 지급 · 마무리는 그대로
  });

  it('consent denied → regranted while the claim is in flight: no grant_ack', async () => {
    await ready();
    let answer;
    f.claimIap.mockReturnValue(new Promise((r) => (answer = r)));
    await m.buyIapItem('boost_3');
    f.handlers.purchase(buy());
    await flush();
    f.handlers.consent(); // denied
    f.handlers.consent(); // granted again
    answer(granted);
    await flush();
    expect(all()).not.toContain('grant_ack');
    expect(sent()).toEqual([]);
    expect(f.finishTransaction).toHaveBeenCalledOnce();
  });

  it('account switch before the callback drops the attempt', async () => {
    await ready();
    f.claimIap.mockResolvedValue(granted);
    await m.buyIapItem('boost_3');
    f.handlers.session();
    f.handlers.purchase(buy());
    await flush();
    expect(all()).not.toContain('grant_ack');
  });

  it('SDK sync throws never change purchase, grant, finish or UI state', async () => {
    await ready();
    f.trackCommerce.mockImplementation(() => {
      throw new Error('sdk');
    });
    f.claimIap.mockResolvedValue(granted);
    await expect(m.buyIapItem('boost_3')).resolves.toBeUndefined();
    expect(f.requestPurchase).toHaveBeenCalledOnce();
    f.handlers.purchase(buy());
    await flush();
    expect(f.finishTransaction).toHaveBeenCalledOnce();
    expect(m.iapItems.busy).toBeNull();
    expect(f.toast).toHaveBeenLastCalledWith('boostDone');
    expect(() => m.trackIapOffer('boost', 'shop')).not.toThrow();
  });

  it('busy (disabled) presses and non-boost/scout products emit nothing', async () => {
    await ready();
    f.fetchProducts.mockResolvedValue([
      { id: 'boost_3', displayPrice: '₩1,100' },
      { id: 'reroll_5', displayPrice: '₩1,100' },
    ]);
    await m.buyIapItem('boost_3');
    await m.buyIapItem('boost_3'); // 결제 중: 무시된다
    expect(f.requestPurchase).toHaveBeenCalledOnce();
    expect(all()).toEqual(['offer_select', 'checkout_request']);
    f.handlers.error({ code: 'user-cancelled' });
    f.trackCommerce.mockClear();
    await m.buyIapItem('reroll_5');
    m.trackIapOffer('reroll', 'shop');
    m.trackIapOffer('rename', 'shop');
    expect(f.trackCommerce).not.toHaveBeenCalled();
    m.trackIapOffer('boost', 'player_tab');
    expect(f.trackCommerce.mock.calls[0][0]).toEqual({
      item: 'boost',
      entry: 'player_tab',
      store: 'apple',
      stage: 'offer_view',
    });
  });
});
