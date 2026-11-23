// T-11-770d 첫 구매 묶음 결제(기획 T-11-747 R2). seasonPass.ts와 같은 순서다: 스토어 결제가 끝나면 거래를 서버에 보내고
// (POST /v1/starter-pack/iap), 서버가 아이템을 준 뒤에만 스토어 거래를 마무리(소비)한다. 못 보낸 거래는 스토어에 남아 다음 실행 때
// 다시 보낸다(서버는 같은 거래로 한 번만 준다). 살 수 있는지는 서버가 정하고(실결제 이력 없음 · 끝까지 뛴 은퇴 선수 있음 · 대조군
// 아님), 이 기기가 광고 제거를 샀으면 서버 원장에 없어도 결제한 사람이라 묻지 않는다.
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
import type { StarterPackResponse } from '@offside/contracts';
import { STARTER_PACK_LIVE, STARTER_PACK_PRODUCT_ID } from '@offside/contracts/starter-pack';
import { claimStarterPackIap, fetchStarterPack } from '@offside/app-core/api/starterPack';
import { iapText as IL } from '@offside/app-core/i18n/ko/iap';
import { starterPackText as L } from '@offside/app-core/i18n/ko/starterPack';
import { toast } from '../game/host';
import { iapItems } from './iapItems';
import { onSessionChanged } from './session';
import { kv } from './setup';
import { connectStore, onStoreError, onStorePurchase, STORE_SUPPORTED } from './store';

const STORE = Platform.OS === 'ios' ? 'apple' : 'google';
const isStarter = (p: Purchase) => p.productId === STARTER_PACK_PRODUCT_ID;
/** 다시 묻지 않을 때까지의 시각(ms). 샀으면 아주 먼 뒤, 살 수 없다는 답이면 하루 뒤. 로그아웃 · 계정 전환 때 지운다. */
const QUIET = 'offside_starter_quiet';
const DAY = 86_400_000;
const FOREVER = 8.64e15;

/** 팔기 시작했나. 개발 빌드에서는 스위치와 무관하게 화면을 본다(서버 스위치가 꺼져 있으면 서버가 off를 준다). */
const live = () => STARTER_PACK_LIVE || __DEV__;

export const starterPackStore = proxy({
  /** 서버가 마지막으로 돌려준 자격. eligible이고 price가 있을 때만 카드를 보인다. */
  pack: null as StarterPackResponse | null,
  /** 스토어가 알려 준 현지 가격. 없으면 사기 버튼을 보이지 않는다. */
  price: null as string | null,
  busy: false,
});

let account: string | null = null;
let syncing: Promise<void> | null = null;

const quietUntil = () => Number(kv.getString(QUIET) ?? 0) || 0;
const quiet = (until: number) => kv.set(QUIET, String(until));

async function claim(p: Purchase, silent: boolean) {
  if (!p.purchaseToken) return;
  const r = await claimStarterPackIap({ store: STORE, token: p.purchaseToken });
  if (!r.ok) {
    if (!silent) toast(r.error.retryable ? IL.claimFail : r.error.message || IL.claimFail);
    return;
  }
  starterPackStore.pack = r.data.pack;
  starterPackStore.price = null;
  iapItems.items = r.data.have;
  quiet(FOREVER);
  await finishTransaction({ purchase: p, isConsumable: true }).catch(() => {});
  toast(L.bought);
}

onStorePurchase((p) => {
  if (!isStarter(p)) return;
  const mine = starterPackStore.busy;
  starterPackStore.busy = false;
  if (p.purchaseState === 'pending') {
    if (mine) toast(IL.pending);
    return;
  }
  if (p.purchaseState === 'purchased') void claim(p, false);
});
onStoreError((e) => {
  if (!starterPackStore.busy) return;
  starterPackStore.busy = false;
  if (e.code !== ErrorCode.UserCancelled) toast(IL.payFail);
});

onSessionChanged(() => {
  account = null;
  starterPackStore.pack = null;
  starterPackStore.price = null;
  kv.remove(QUIET);
});

async function sync() {
  const r = await fetchStarterPack();
  if (!r.ok) return;
  const pack = r.data;
  starterPackStore.pack = pack;
  account = pack.account ?? null;
  if (pack.state !== 'eligible') {
    starterPackStore.price = null;
    // 샀으면 다시 묻지 않고, 살 수 없다는 답(결제 이력 · 대조군 · 아직 은퇴 선수 없음)은 하루 뒤에 다시 묻는다.
    if (pack.state !== 'off') quiet(pack.state === 'owned' ? FOREVER : Date.now() + DAY);
    return;
  }
  if (!STORE_SUPPORTED || !account || !pack.stores.includes(STORE)) {
    starterPackStore.price = null;
    return;
  }
  if (!(await connectStore())) return;
  try {
    const products = await fetchProducts({ skus: [STARTER_PACK_PRODUCT_ID], type: 'in-app' });
    starterPackStore.price =
      products?.find((p) => p.id === STARTER_PACK_PRODUCT_ID)?.displayPrice ?? null;
  } catch {
    starterPackStore.price = null;
  }
}

/**
 * 상점 · 은퇴 화면이 로그인한 구단주일 때 부른다. 팔지 않거나, 이 기기가 광고 제거를 샀거나, 최근에 살 수 없다는 답을 받았으면
 * 서버를 부르지 않는다. `fresh`는 은퇴가 방금 올라가 자격이 바뀌었을 수 있을 때만 준다.
 */
export function syncStarterPack(fresh = false): Promise<void> {
  if (!live()) return Promise.resolve();
  const until = quietUntil();
  if (until === FOREVER || (!fresh && Date.now() < until)) return Promise.resolve();
  syncing ??= sync().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** 묶음 사기. 결과는 구매 이벤트로 온다. */
export async function buyStarterPack() {
  if (!STORE_SUPPORTED || starterPackStore.busy || !account) return;
  starterPackStore.busy = true;
  if (!(await connectStore())) {
    starterPackStore.busy = false;
    return toast(IL.storeFail);
  }
  await requestPurchase({
    request: {
      apple: { sku: STARTER_PACK_PRODUCT_ID, appAccountToken: account },
      google: { skus: [STARTER_PACK_PRODUCT_ID], obfuscatedAccountId: account },
    },
    type: 'in-app',
  }).catch(() => {
    starterPackStore.busy = false;
    toast(IL.payStartFail);
  });
}

/** 지금 카드를 보이나: 서버가 살 수 있다고 했고 스토어 가격을 받았을 때만. */
export const starterPackOpen = (s: {
  pack: Pick<StarterPackResponse, 'state'> | null;
  price: string | null;
}) => s.pack?.state === 'eligible' && !!s.price;

/** 앱 시작 때: 마무리하지 못한 묶음 거래가 스토어에 남았을 때만 서버에 다시 보낸다(팔기 전에는 스토어를 묻지 않는다). */
export async function recoverStarterPack() {
  if (!live() || !STORE_SUPPORTED || !(await connectStore())) return;
  const left = await getAvailablePurchases().catch(() => []);
  for (const p of left) if (isStarter(p) && p.purchaseState === 'purchased') await claim(p, true);
}
