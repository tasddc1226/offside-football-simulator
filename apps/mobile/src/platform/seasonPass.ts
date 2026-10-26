// T-11-511 시즌 패스 결제. iapItems.ts와 같은 순서다: 스토어 결제가 끝나면 거래를 서버에 보내고(POST /v1/season-pass/iap),
// 서버가 패스를 연 뒤에만 스토어 거래를 마무리(소비)한다. 못 보낸 거래는 스토어에 남아 다음 실행 때 다시 보낸다(서버는 같은
// 거래로 패스를 한 번만 연다). 구매에는 서버가 알려 준 구단주 표시를 붙인다.
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
import type { SeasonPassResponse } from '@offside/contracts';
import { SEASON_PASS_PRODUCT_ID } from '@offside/contracts/season-pass';
import { claimSeasonPassIap } from '@offside/app-core/api/seasonPass';
import { iapText as IL } from '@offside/app-core/i18n/ko/iap';
import { seasonPassText as L } from '@offside/app-core/i18n/ko/seasonPass';
import { toast } from '../game/host';
import { onSessionChanged } from './session';
import { connectStore, onStoreError, onStorePurchase, STORE_SUPPORTED } from './store';

const STORE = Platform.OS === 'ios' ? 'apple' : 'google';
const isPass = (p: Purchase) => p.productId === SEASON_PASS_PRODUCT_ID;

export const seasonPassStore = proxy({
  /** 스토어가 알려 준 현지 가격. 없으면 사기 버튼을 보이지 않는다. */
  price: null as string | null,
  busy: false,
  /** 서버가 마지막으로 돌려준 패스 상태(산 뒤 화면이 바로 고친다). */
  pass: null as SeasonPassResponse | null,
});

let account: string | null = null;

async function claim(p: Purchase, quiet: boolean) {
  if (!p.purchaseToken) return;
  const r = await claimSeasonPassIap({ store: STORE, token: p.purchaseToken });
  if (!r.ok) {
    if (!quiet) toast(r.error.retryable ? IL.claimFail : r.error.message || IL.claimFail);
    return;
  }
  seasonPassStore.pass = r.data;
  await finishTransaction({ purchase: p, isConsumable: true }).catch(() => {});
  toast(L.bought);
}

onStorePurchase((p) => {
  if (!isPass(p)) return;
  const mine = seasonPassStore.busy;
  seasonPassStore.busy = false;
  if (p.purchaseState === 'pending') {
    if (mine) toast(IL.pending);
    return;
  }
  if (p.purchaseState === 'purchased') void claim(p, false);
});
onStoreError((e) => {
  if (!seasonPassStore.busy) return;
  seasonPassStore.busy = false;
  if (e.code !== ErrorCode.UserCancelled) toast(IL.payFail);
});

onSessionChanged(() => {
  account = null;
  seasonPassStore.price = null;
  seasonPassStore.pass = null;
});

/**
 * 패스 화면이 서버 상태를 받은 뒤 부른다. 서버가 이 스토어에서 팔 때만 스토어 가격을 묻고, 마무리하지 못한 패스 거래를
 * 다시 보낸다.
 */
export async function syncSeasonPassStore(pass: SeasonPassResponse) {
  account = pass.account ?? null;
  if (!STORE_SUPPORTED || !account || !pass.stores.includes(STORE)) {
    seasonPassStore.price = null;
    return;
  }
  if (!(await connectStore())) return;
  try {
    const [products, left] = await Promise.all([
      fetchProducts({ skus: [SEASON_PASS_PRODUCT_ID], type: 'in-app' }),
      getAvailablePurchases(),
    ]);
    seasonPassStore.price =
      products?.find((p) => p.id === SEASON_PASS_PRODUCT_ID)?.displayPrice ?? null;
    for (const p of left) if (isPass(p) && p.purchaseState === 'purchased') await claim(p, true);
  } catch {
    seasonPassStore.price = null;
  }
}

/** 패스 사기. 결과는 구매 이벤트로 온다. */
export async function buySeasonPass() {
  if (!STORE_SUPPORTED || seasonPassStore.busy || !account) return;
  seasonPassStore.busy = true;
  if (!(await connectStore())) {
    seasonPassStore.busy = false;
    return toast(IL.storeFail);
  }
  await requestPurchase({
    request: {
      apple: { sku: SEASON_PASS_PRODUCT_ID, appAccountToken: account },
      google: { skus: [SEASON_PASS_PRODUCT_ID], obfuscatedAccountId: account },
    },
    type: 'in-app',
  }).catch(() => {
    seasonPassStore.busy = false;
    toast(IL.payStartFail);
  });
}

/** 앱 시작 때: 마무리하지 못한 패스 거래가 스토어에 남았을 때만 서버에 다시 보낸다. 서버 상태를 먼저 받지 않으므로
 * 구단주 표시 없이 보내도 서버가 거래의 구단주 표시로 확인한다. */
export async function recoverSeasonPass() {
  if (!STORE_SUPPORTED || !(await connectStore())) return;
  const left = await getAvailablePurchases().catch(() => []);
  for (const p of left) if (isPass(p) && p.purchaseState === 'purchased') await claim(p, true);
}
