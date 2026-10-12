import { AppState, Linking, Platform } from 'react-native';
import { proxy } from 'valtio';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  requestPurchase,
  restorePurchases,
  type Purchase,
} from 'expo-iap';
import {
  fetchMembership,
  claimMembership,
  type MembershipResponse,
} from '@offside/app-core/api/membership';
import { membershipText as L } from '@offside/app-core/i18n/ko/membership';
import { connectStore, onStorePurchase, onStoreError, STORE_SUPPORTED } from './store';
import { selectTeamSlot } from '@offside/app-core/teamSlots';
import { onSessionChanged } from './session';
import { setMemberAdFree } from './adFree';
import { iapItems } from './iapItems';
const SKU = 'com.offsidelab.app.club_monthly';
const STORE = Platform.OS === 'ios' ? 'apple' : 'google';
export const memberBilling = proxy({
  data: null as MembershipResponse | null,
  price: '',
  busy: false,
  message: '',
  loading: false,
});
let epoch = 0;
let offerToken: string | undefined;
let inflight: Promise<void> | undefined;
let expiry: ReturnType<typeof setTimeout> | undefined;
function accept(data: MembershipResponse) {
  memberBilling.data = data;
  iapItems.items = data.items;
  const m = data.membership;
  const until = m.status === 'grace' ? m.graceUntil : m.paidUntil;
  setMemberAdFree(m.active ? until : null);
  if (expiry) clearTimeout(expiry);
  if (m.active && until) {
    const delay = Date.parse(until) - Date.now();
    if (delay > 0)
      expiry = setTimeout(
        () => {
          setMemberAdFree(null);
          void syncMembership(true);
        },
        Math.min(delay, 2_147_000_000),
      );
  }
}
export function syncMembership(fresh = false) {
  if (inflight) return inflight;
  const generation = epoch;
  memberBilling.loading = true;
  inflight = (async () => {
    const r = await fetchMembership(fresh);
    if (generation !== epoch) return;
    if (!r.ok) {
      memberBilling.message = L.error;
      return;
    }
    accept(r.data);
    memberBilling.message = '';
    memberBilling.price = '';
    offerToken = undefined;
    if (!r.data.stores.includes(STORE) || !STORE_SUPPORTED || !(await connectStore())) return;
    const products = await fetchProducts({ skus: [SKU], type: 'subs' });
    if (generation !== epoch) return;
    const p = products?.find((p) => p.id === SKU);
    if (!p) return;
    if (STORE === 'google') {
      const offer = p.subscriptionOffers?.find((o) => o.basePlanIdAndroid === 'monthly' && !o.id);
      offerToken = offer?.offerTokenAndroid ?? undefined;
      if (!offerToken) return;
    }
    memberBilling.price = p.displayPrice;
  })()
    .catch(() => {
      if (generation === epoch) memberBilling.message = L.failed;
    })
    .finally(() => {
      if (generation === epoch) {
        memberBilling.loading = false;
        inflight = undefined;
      }
    });
  return inflight;
}
const claims = new Map<string, Promise<boolean>>();
async function applyPurchase(p: Purchase) {
  if (p.productId !== SKU || p.purchaseState !== 'purchased' || !p.purchaseToken) return false;
  const key = p.purchaseToken;
  const running = claims.get(key);
  if (running) return running;
  const generation = epoch;
  const job = (async () => {
    const r = await claimMembership(STORE, key);
    if (generation !== epoch) return false;
    if (!r.ok) {
      memberBilling.message = r.error.message || L.failed;
      return false;
    }
    accept(r.data);
    await finishTransaction({ purchase: p, isConsumable: false });
    if (generation !== epoch) return false;
    memberBilling.message = L.restored;
    return true;
  })().finally(() => {
    if (claims.get(key) === job) claims.delete(key);
  });
  claims.set(key, job);
  return job;
}
onStorePurchase((p) => {
  const generation = epoch;
  if (p.productId !== SKU) return;
  if (p.purchaseState === 'pending') {
    memberBilling.busy = false;
    memberBilling.message = L.pending;
    return;
  }
  void applyPurchase(p)
    .catch(() => {
      if (generation === epoch) memberBilling.message = L.failed;
    })
    .finally(() => {
      if (generation === epoch) memberBilling.busy = false;
    });
});
onStoreError((e) => {
  if (memberBilling.busy) {
    memberBilling.busy = false;
    memberBilling.message = e.code === ErrorCode.UserCancelled ? '' : L.failed;
  }
});
export async function buyMembership() {
  if (memberBilling.busy || !memberBilling.price || !memberBilling.data?.stores.includes(STORE))
    return;
  const generation = epoch;
  const account = memberBilling.data.account;
  memberBilling.busy = true;
  memberBilling.message = '';
  try {
    if (!(await connectStore())) throw new Error('store');
    if (generation !== epoch) return;
    await requestPurchase({
      type: 'subs',
      request: {
        apple: { sku: SKU, appAccountToken: account },
        google: {
          skus: [SKU],
          obfuscatedAccountId: account,
          subscriptionOffers: offerToken ? [{ sku: SKU, offerToken }] : [],
        },
      },
    });
  } catch {
    if (generation === epoch) {
      memberBilling.busy = false;
      memberBilling.message = L.failed;
    }
  }
}
export async function restoreMembership() {
  const generation = epoch;
  if (memberBilling.busy) return;
  memberBilling.busy = true;
  memberBilling.message = '';
  try {
    if (!(await connectStore())) throw new Error('store');
    await restorePurchases();
    const purchases = await getAvailablePurchases();
    if (generation !== epoch) return;
    let found = false;
    for (const p of purchases) {
      if (generation !== epoch) return;
      if (p.productId === SKU) found = (await applyPurchase(p)) || found;
    }
    if (generation === epoch && !found && !memberBilling.message)
      memberBilling.message = L.notFound;
  } catch {
    if (generation === epoch) memberBilling.message = L.failed;
  } finally {
    if (generation === epoch) memberBilling.busy = false;
  }
}
export const manageMembership = () =>
  Linking.openURL(
    STORE === 'apple'
      ? 'https://apps.apple.com/account/subscriptions'
      : `https://play.google.com/store/account/subscriptions?sku=${SKU}&package=com.offsidelab.app`,
  );
onSessionChanged(() => {
  selectTeamSlot(0);
  epoch++;
  inflight = undefined;
  claims.clear();
  if (expiry) clearTimeout(expiry);
  setMemberAdFree(null);
  memberBilling.data = null;
  memberBilling.price = '';
  memberBilling.busy = false;
  memberBilling.message = '';
  memberBilling.loading = false;
});
AppState.addEventListener('change', (state) => {
  if (state === 'active' && memberBilling.data) void syncMembership();
});
export async function recoverMembership() {
  await syncMembership();
  if (!memberBilling.data || !STORE_SUPPORTED || !(await connectStore())) return;
  for (const p of await getAvailablePurchases()) if (p.productId === SKU) await applyPurchase(p);
}
