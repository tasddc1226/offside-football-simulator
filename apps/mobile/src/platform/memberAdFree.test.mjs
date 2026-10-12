/* global vi, beforeEach, it, expect */
const f = vi.hoisted(() => ({ owned: false, set: vi.fn() }));
vi.mock('./setup', () => ({ kv: { getBoolean: () => f.owned, set: f.set } }));
vi.mock('./store', () => ({
  STORE_SUPPORTED: false,
  connectStore: vi.fn(),
  onStorePurchase: vi.fn(),
  onStoreError: vi.fn(),
}));
vi.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'cancel' },
  fetchProducts: vi.fn(),
  finishTransaction: vi.fn(),
  getAvailablePurchases: vi.fn(),
  requestPurchase: vi.fn(),
  restorePurchases: vi.fn(),
}));
vi.mock('@offside/app-core/i18n/ko/ad', () => ({ adText: {} }));
beforeEach(() => {
  vi.resetModules();
  f.owned = false;
  f.set.mockClear();
});
it('expires temporary membership access without writing a permanent entitlement', async () => {
  const { adFree, setMemberAdFree } = await import('./adFree');
  setMemberAdFree('2099-01-01T00:00:00.000Z');
  expect(adFree.effective).toBe(true);
  expect(adFree.owned).toBe(false);
  setMemberAdFree(null);
  expect(adFree.effective).toBe(false);
  expect(f.set).not.toHaveBeenCalled();
});
it('preserves an existing lifetime ad removal purchase after membership ends', async () => {
  f.owned = true;
  const { adFree, setMemberAdFree } = await import('./adFree');
  setMemberAdFree('2099-01-01T00:00:00.000Z');
  setMemberAdFree(null);
  expect(adFree.effective).toBe(true);
  expect(adFree.owned).toBe(true);
  expect(f.set).not.toHaveBeenCalled();
});
