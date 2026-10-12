/* global vi, beforeEach, afterEach, it, expect */
const f = vi.hoisted(() => ({
  fetch: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  products: vi.fn(),
  purchases: vi.fn(),
  restore: vi.fn(),
  request: vi.fn(),
  session: null,
  listeners: [],
  ad: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: vi.fn() },
  Linking: { openURL: vi.fn() },
}));
vi.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'cancel' },
  fetchProducts: f.products,
  finishTransaction: f.finish,
  getAvailablePurchases: f.purchases,
  requestPurchase: f.request,
  restorePurchases: f.restore,
}));
vi.mock('./store', () => ({
  STORE_SUPPORTED: true,
  connectStore: async () => true,
  onStorePurchase: (fn) => f.listeners.push(fn),
  onStoreError: vi.fn(),
}));
vi.mock('./session', () => ({
  onSessionChanged: (fn) => {
    f.session = fn;
  },
}));
vi.mock('./adFree', () => ({ setMemberAdFree: f.ad }));
vi.mock('./iapItems', () => ({ iapItems: {} }));
vi.mock('@offside/app-core/api/membership', () => ({
  fetchMembership: f.fetch,
  claimMembership: f.claim,
}));
vi.mock('@offside/app-core/i18n/ko/membership', () => ({
  membershipText: {
    error: 'error',
    failed: 'failed',
    restored: 'restored',
    notFound: 'notFound',
    pending: 'pending',
  },
}));
const sku = 'com.offsidelab.app.club_monthly';
const data = () => ({
  account: 'account-a',
  stores: ['apple'],
  items: { reroll: 40, scout: 5, boost: 10 },
  membership: { active: true, status: 'active', paidUntil: '2099-01-01T00:00:00.000Z' },
});
const purchase = { productId: sku, purchaseState: 'purchased', purchaseToken: 'receipt' };
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  f.listeners = [];
  f.fetch.mockResolvedValue({ ok: true, data: data() });
  f.claim.mockResolvedValue({ ok: true, data: data() });
  f.products.mockResolvedValue([{ id: sku, displayPrice: '₩4,900' }]);
  f.purchases.mockResolvedValue([purchase]);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
it('uses store price and binds the purchase to the authenticated game account', async () => {
  const m = await import('./membership');
  await m.syncMembership();
  expect(m.memberBilling.price).toBe('₩4,900');
  await m.buyMembership();
  expect(f.request).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'subs',
      request: expect.objectContaining({ apple: { sku, appAccountToken: 'account-a' } }),
    }),
  );
});
it('finishes only after successful server verification and restores while sales are closed', async () => {
  const m = await import('./membership');
  await m.restoreMembership();
  expect(f.claim).toHaveBeenCalledWith('apple', 'receipt');
  expect(f.finish).toHaveBeenCalledWith({ purchase, isConsumable: false });
  expect(f.claim.mock.invocationCallOrder[0]).toBeLessThan(f.finish.mock.invocationCallOrder[0]);
  expect(f.ad).toHaveBeenCalledWith('2099-01-01T00:00:00.000Z');
});
it('does not finish a rejected receipt', async () => {
  f.claim.mockResolvedValue({ ok: false, error: { message: 'other account' } });
  const m = await import('./membership');
  await m.restoreMembership();
  expect(f.finish).not.toHaveBeenCalled();
  expect(f.ad).not.toHaveBeenCalled();
});
it('does not apply an old account response after session change', async () => {
  let resolve;
  f.claim.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const m = await import('./membership');
  const pending = m.restoreMembership();
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  f.session();
  resolve({ ok: true, data: data() });
  await pending;
  expect(m.memberBilling.data).toBeNull();
  expect(m.memberBilling.message).toBe('');
  expect(f.finish).not.toHaveBeenCalled();
  expect(f.ad).toHaveBeenLastCalledWith(null);
});
it('pending store purchases do not grant benefits', async () => {
  const m = await import('./membership');
  f.listeners[0]({ ...purchase, purchaseState: 'pending' });
  expect(m.memberBilling.message).toBe('pending');
  expect(f.claim).not.toHaveBeenCalled();
});
