/* global vi, beforeEach, describe, it, expect */
// T-11-778 첫 구매 묶음: 결제는 끝났는데 서버 요청이 실패한 거래를 화면을 다시 열 때 · 사기 버튼을 다시 누를 때 다시 보내고,
// 그 거래가 남았거나 보내는 중이면 새 결제를 시작하지 않는지 본다.
const f = vi.hoisted(() => ({
  fetchStarterPack: vi.fn(),
  claimStarterPackIap: vi.fn(),
  connectStore: vi.fn(),
  fetchProducts: vi.fn(),
  getAvailablePurchases: vi.fn(),
  finishTransaction: vi.fn(),
  requestPurchase: vi.fn(),
  toast: vi.fn(),
  kv: new Map(),
  handlers: { purchase: null, error: null, session: null },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled' },
  fetchProducts: f.fetchProducts,
  finishTransaction: f.finishTransaction,
  getAvailablePurchases: f.getAvailablePurchases,
  requestPurchase: f.requestPurchase,
}));
vi.mock('@offside/contracts/starter-pack', () => ({
  STARTER_PACK_LIVE: true,
  STARTER_PACK_PRODUCT_ID: 'starter_v1',
}));
vi.mock('@offside/app-core/api/starterPack', () => ({
  claimStarterPackIap: f.claimStarterPackIap,
  fetchStarterPack: f.fetchStarterPack,
}));
vi.mock('@offside/app-core/i18n/ko/iap', () => ({
  iapText: {
    claimFail: 'claimFail',
    storeFail: 'storeFail',
    pending: 'pending',
    payFail: 'payFail',
    payStartFail: 'payStartFail',
  },
}));
vi.mock('@offside/app-core/i18n/ko/starterPack', () => ({ starterPackText: { bought: 'bought' } }));
vi.mock('../game/host', () => ({ toast: f.toast }));
vi.mock('./adFree', () => ({ adFree: { owned: false } }));
vi.mock('./iapItems', () => ({ iapItems: { items: null } }));
vi.mock('./session', () => ({ onSessionChanged: (fn) => (f.handlers.session = fn) }));
vi.mock('./setup', () => ({
  kv: {
    getString: (k) => f.kv.get(k),
    set: (k, v) => f.kv.set(k, v),
    remove: (k) => f.kv.delete(k),
  },
}));
vi.mock('./store', () => ({
  STORE_SUPPORTED: true,
  connectStore: f.connectStore,
  onStoreError: (fn) => (f.handlers.error = fn),
  onStorePurchase: (fn) => (f.handlers.purchase = fn),
}));
vi.mock('valtio', () => ({ proxy: (o) => o }));

const eligible = { state: 'eligible', account: 'acc', stores: ['apple'] };
const owned = { state: 'owned', account: 'acc', stores: ['apple'] };
const have = { reroll: 5, boost: 5, scout: 1, rename: 0 };
const tx = { productId: 'starter_v1', purchaseState: 'purchased', purchaseToken: 'tok' };
const retryable = { ok: false, error: { code: 'NETWORK', retryable: true } };
const granted = { ok: true, data: { pack: owned, have } };
const flush = () => new Promise((r) => setTimeout(r, 0));
let m;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('__DEV__', false);
  f.kv.clear();
  f.connectStore.mockResolvedValue(true);
  f.fetchStarterPack.mockResolvedValue({ ok: true, data: eligible });
  f.claimStarterPackIap.mockReset();
  f.fetchProducts.mockResolvedValue([{ id: 'starter_v1', displayPrice: '₩3,300' }]);
  f.getAvailablePurchases.mockReset();
  f.getAvailablePurchases.mockResolvedValue([]);
  f.finishTransaction.mockResolvedValue(undefined);
  f.requestPurchase.mockResolvedValue(undefined);
  m = await import('./starterPack');
});

/** 카드를 띄우고 결제까지 끝났는데 서버 요청이 실패한 상태를 만든다. */
async function failedClaim() {
  await m.syncStarterPack();
  await m.buyStarterPack();
  expect(f.requestPurchase).toHaveBeenCalledTimes(1);
  f.claimStarterPackIap.mockResolvedValueOnce(retryable);
  f.handlers.purchase(tx);
  await flush();
  expect(f.toast).toHaveBeenLastCalledWith('claimFail');
  expect(f.finishTransaction).not.toHaveBeenCalled();
  f.getAvailablePurchases.mockResolvedValue([tx]);
  f.toast.mockClear();
}

describe('starter pack resend (T-11-778)', () => {
  it('buys normally when the store holds no unfinished starter transaction', async () => {
    f.getAvailablePurchases.mockResolvedValue([
      { productId: 'reroll_5', purchaseState: 'purchased', purchaseToken: 'other' },
    ]);
    await m.syncStarterPack();
    expect(m.starterPackOpen(m.starterPackStore)).toBe(true);
    await m.buyStarterPack();
    expect(f.claimStarterPackIap).not.toHaveBeenCalled();
    expect(f.requestPurchase).toHaveBeenCalledTimes(1);
    f.claimStarterPackIap.mockResolvedValueOnce(granted);
    f.handlers.purchase(tx);
    await flush();
    expect(f.finishTransaction).toHaveBeenCalledWith({ purchase: tx, isConsumable: true });
    expect(m.starterPackStore.pack.state).toBe('owned');
    expect(f.toast).toHaveBeenLastCalledWith('bought');
  });

  it('resends the leftover transaction quietly when the screen syncs again', async () => {
    await failedClaim();
    f.claimStarterPackIap.mockResolvedValueOnce(retryable);
    await m.syncStarterPack();
    expect(f.claimStarterPackIap).toHaveBeenCalledTimes(2);
    expect(f.toast).not.toHaveBeenCalled();
    expect(m.starterPackOpen(m.starterPackStore)).toBe(true);

    f.claimStarterPackIap.mockResolvedValueOnce(granted);
    await m.syncStarterPack();
    expect(f.claimStarterPackIap).toHaveBeenLastCalledWith({ store: 'apple', token: 'tok' });
    expect(f.finishTransaction).toHaveBeenCalledWith({ purchase: tx, isConsumable: true });
    expect(m.starterPackStore.pack.state).toBe('owned');
    expect(m.starterPackStore.price).toBeNull();
    expect(m.starterPackOpen(m.starterPackStore)).toBe(false);
    expect(f.toast).toHaveBeenLastCalledWith('bought');
    // 샀으면 다시 묻지 않는다.
    f.fetchStarterPack.mockClear();
    await m.syncStarterPack();
    expect(f.fetchStarterPack).not.toHaveBeenCalled();
  });

  it('a second tap resends instead of starting another store purchase', async () => {
    await failedClaim();
    f.claimStarterPackIap.mockResolvedValueOnce(retryable);
    await m.buyStarterPack();
    expect(f.requestPurchase).toHaveBeenCalledTimes(1);
    expect(f.toast).toHaveBeenLastCalledWith('claimFail');
    expect(m.starterPackStore.busy).toBe(false);

    f.claimStarterPackIap.mockResolvedValueOnce(granted);
    await m.buyStarterPack();
    expect(f.requestPurchase).toHaveBeenCalledTimes(1);
    expect(m.starterPackStore.pack.state).toBe('owned');
    expect(m.starterPackStore.busy).toBe(false);
    expect(f.toast).toHaveBeenLastCalledWith('bought');
  });

  it('does not start a purchase while the leftover cannot be read from the store', async () => {
    await failedClaim();
    f.getAvailablePurchases.mockRejectedValue(new Error('store'));
    await m.buyStarterPack();
    expect(f.requestPurchase).toHaveBeenCalledTimes(1);
    expect(f.toast).toHaveBeenLastCalledWith('claimFail');
  });

  it('ignores taps and does not send twice while a claim is in flight', async () => {
    await m.syncStarterPack();
    await m.buyStarterPack();
    let answer;
    f.claimStarterPackIap.mockReturnValueOnce(new Promise((r) => (answer = r)));
    f.getAvailablePurchases.mockResolvedValue([tx]);
    f.handlers.purchase(tx);
    await m.buyStarterPack();
    await m.syncStarterPack();
    expect(f.requestPurchase).toHaveBeenCalledTimes(1);
    expect(f.claimStarterPackIap).toHaveBeenCalledTimes(1);
    answer(granted);
    await flush();
    expect(f.finishTransaction).toHaveBeenCalledTimes(1);
    expect(f.toast.mock.calls.filter(([t]) => t === 'bought')).toHaveLength(1);
  });

  it('finishes the leftover when the server already granted it', async () => {
    await failedClaim();
    f.fetchStarterPack.mockResolvedValue({ ok: true, data: owned });
    f.claimStarterPackIap.mockResolvedValueOnce(granted);
    await m.syncStarterPack();
    expect(f.finishTransaction).toHaveBeenCalledWith({ purchase: tx, isConsumable: true });
  });

  it('a purchase that belongs to another account does not block buying', async () => {
    f.getAvailablePurchases.mockResolvedValue([tx]);
    f.claimStarterPackIap.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', retryable: false, message: 'other account' },
    });
    await m.syncStarterPack();
    expect(f.toast).not.toHaveBeenCalled();
    await m.buyStarterPack();
    expect(f.requestPurchase).toHaveBeenCalledTimes(1);
  });

  it('forgets the leftover on account switch', async () => {
    await failedClaim();
    f.handlers.session();
    expect(m.starterPackStore.pack).toBeNull();
    f.getAvailablePurchases.mockResolvedValue([]);
    await m.syncStarterPack();
    await m.buyStarterPack();
    expect(f.requestPurchase).toHaveBeenCalledTimes(2);
  });
});
