// T-11-512 클럽 멤버십(자동 갱신 구독). 스토어 결제가 끝나면 거래를 서버에 보내고(POST /v1/membership/iap), 서버가 구독을 묶은
// 뒤에만 스토어 거래를 마무리한다. 앱 시작 때는 스토어에 살아 있는 구독이 있을 때만 서버에 다시 보낸다(구독하지 않은 사람은
// 서버를 부르지 않는다). 혜택 끝 시각은 기기에도 남겨 오프라인이어도 그때까지 광고를 끈다. 스토어에 구독이 없으면 지운다.
import { Platform } from 'react-native';
import { proxy } from 'valtio';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  requestPurchase,
  type Purchase,
} from 'expo-iap';
import type { MembershipResponse } from '@offside/contracts';
import { memberActive, MEMBERSHIP_PRODUCT_ID } from '@offside/contracts/membership';
import { claimMembershipIap } from '@offside/app-core/api/membership';
import { iapText as IL } from '@offside/app-core/i18n/ko/iap';
import { membershipText as L } from '@offside/app-core/i18n/ko/membership';
import { toast } from '../game/host';
import { adFree } from './adFree';
import { onSessionChanged } from './session';
import { kv } from './setup';
import { connectStore, onStoreError, onStorePurchase, STORE_SUPPORTED } from './store';

const STORE = Platform.OS === 'ios' ? 'apple' : 'google';
const UNTIL = 'offside_member_until';
const isMember = (p: Purchase) => p.productId === MEMBERSHIP_PRODUCT_ID;

export const membership = proxy({
  /** 스토어가 알려 준 현지 월 가격. 없으면 가입 버튼을 보이지 않는다. */
  price: null as string | null,
  busy: false,
  restoring: false,
  /** 서버가 마지막으로 돌려준 상태(가입 뒤 화면이 바로 고친다). */
  state: null as MembershipResponse | null,
});

let account: string | null = null;
let offerToken: string | null = null;

/** 서버가 알려 준 혜택 끝을 기기에 남기고 광고 제거에 반영한다. */
function remember(until: string | null) {
  if (until) kv.set(UNTIL, until);
  else kv.remove(UNTIL);
  adFree.member = memberActive(until, new Date().toISOString());
}
remember(kv.getString(UNTIL) ?? null);

async function claim(p: Purchase, quiet: boolean) {
  if (!p.purchaseToken) return false;
  const r = await claimMembershipIap({ store: STORE, token: p.purchaseToken });
  if (!r.ok) {
    if (!quiet) toast(r.error.retryable ? IL.claimFail : r.error.message || IL.claimFail);
    return false;
  }
  membership.state = r.data;
  remember(r.data.until);
  await finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
  return true;
}

onStorePurchase((p) => {
  if (!isMember(p)) return;
  const mine = membership.busy;
  membership.busy = false;
  if (p.purchaseState === 'pending') {
    if (mine) toast(IL.pending);
    return;
  }
  if (p.purchaseState === 'purchased')
    void claim(p, false).then((ok) => {
      if (ok && mine) toast(L.joined);
    });
});
onStoreError((e) => {
  if (!membership.busy) return;
  membership.busy = false;
  if (e.code !== ErrorCode.UserCancelled) toast(IL.payFail);
});

onSessionChanged(() => {
  account = null;
  membership.price = null;
  membership.state = null;
  remember(null);
});

/** 멤버십 화면이 서버 상태를 받은 뒤 부른다. 서버가 이 스토어에서 가입을 받을 때만 스토어 가격을 묻는다. */
export async function syncMembershipStore(state: MembershipResponse) {
  membership.state = state;
  remember(state.until);
  account = state.account ?? null;
  if (!STORE_SUPPORTED || !account || !state.stores.includes(STORE)) {
    membership.price = null;
    return;
  }
  if (!(await connectStore())) return;
  try {
    const products = await fetchProducts({ skus: [MEMBERSHIP_PRODUCT_ID], type: 'subs' });
    const product = products?.find((p) => p.id === MEMBERSHIP_PRODUCT_ID);
    const offer =
      product && 'subscriptionOffers' in product ? product.subscriptionOffers?.[0] : undefined;
    offerToken = offer?.offerTokenAndroid ?? null;
    membership.price =
      Platform.OS === 'android' ? (offer?.displayPrice ?? null) : (product?.displayPrice ?? null);
  } catch {
    membership.price = null;
  }
}

/** 멤버십 가입. 결과는 구매 이벤트로 온다. */
export async function joinMembership() {
  if (!STORE_SUPPORTED || membership.busy || !account) return;
  if (Platform.OS === 'android' && !offerToken) return toast(IL.storeFail);
  membership.busy = true;
  if (!(await connectStore())) {
    membership.busy = false;
    return toast(IL.storeFail);
  }
  await requestPurchase({
    request: {
      apple: { sku: MEMBERSHIP_PRODUCT_ID, appAccountToken: account },
      google: {
        skus: [MEMBERSHIP_PRODUCT_ID],
        obfuscatedAccountId: account,
        subscriptionOffers: [{ sku: MEMBERSHIP_PRODUCT_ID, offerToken: offerToken ?? '' }],
      },
    },
    type: 'subs',
  }).catch(() => {
    membership.busy = false;
    toast(IL.payStartFail);
  });
}

/** 스토어에 살아 있는 멤버십 구독(없으면 null, 스토어에 닿지 못하면 undefined). */
async function liveSubscription() {
  if (!STORE_SUPPORTED || !(await connectStore())) return undefined;
  const left = await getAvailablePurchases().catch(() => undefined);
  if (!left) return undefined;
  return left.find((p) => isMember(p) && p.purchaseState === 'purchased') ?? null;
}

/** '구매 복원': 스토어의 구독을 다시 보내 이 구단주에게 묶는다. */
export async function restoreMembership() {
  if (membership.restoring) return;
  membership.restoring = true;
  try {
    const p = await liveSubscription();
    if (p === undefined) return toast(IL.storeFail);
    if (!p) return toast(L.restoreNone);
    if (await claim(p, false)) toast(L.joined);
  } finally {
    membership.restoring = false;
  }
}

/**
 * 앱 시작 때: 스토어에 구독이 살아 있고 아는 혜택 끝이 가까우면 서버에 다시 보내 다음 기간을 받는다. 스토어가 구독이 없다고 하면(만료 · 환불)
 * 기기에 남긴 혜택 끝을 지운다. 스토어에 닿지 못하면 그대로 둔다.
 */
export async function recoverMembership() {
  const p = await liveSubscription();
  if (p === undefined) return;
  if (!p) {
    if (kv.getString(UNTIL)) remember(null);
    return;
  }
  // 아는 혜택 끝이 하루 넘게 남았으면 서버를 부르지 않는다(갱신 무렵에만 다음 기간을 받는다).
  const until = kv.getString(UNTIL);
  if (until && Date.parse(until) - Date.now() > 86_400_000) return;
  await claim(p, true);
}
