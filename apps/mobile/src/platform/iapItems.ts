// T-11-174 소모성 인앱 상품(리롤권 · 잠재력 강화권 묶음). 스토어에서 결제가 끝나면 거래를 서버에 보내고(POST /v1/items/iap),
// 서버가 아이템을 준 뒤에만 스토어 거래를 마무리(소비)한다. 서버에 못 보냈거나 응답을 못 받으면 거래가 스토어에 남아 다음 실행 때
// 다시 보낸다(서버는 같은 거래를 한 번만 준다). 구매에는 서버가 알려 준 구단주 표시를 붙여 다른 계정이 받지 못하게 한다.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { proxy, useSnapshot } from 'valtio';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  requestPurchase,
  type Purchase,
} from 'expo-iap';
import {
  IAP_PRODUCT_IDS,
  IAP_PRODUCTS,
  type IapProductId,
  type OwnerItem,
} from '@offside/contracts/cup';
import { claimIap, fetchItems, type OwnerItemsResponse } from '@offside/app-core/api/cup';
import { iapText as L } from '@offside/app-core/i18n/ko/iap';
import { toast } from '../game/host';
import { onSessionChanged } from './session';
import { connectStore, onStoreError, onStorePurchase, STORE_SUPPORTED } from './store';

const STORE = Platform.OS === 'ios' ? 'apple' : 'google';
const isOurs = (id: string): id is IapProductId => id in IAP_PRODUCTS;

export const iapItems = proxy({
  /** 이 스토어에서 살 수 있다(서버가 확인할 수 있는 스토어 · 로그인한 구단주). */
  open: false,
  /** 스토어가 알려 준 현지 가격. 못 받은 상품은 없다. */
  prices: {} as Partial<Record<IapProductId, string>>,
  /** 결제 중인 상품. */
  busy: null as IapProductId | null,
  /** 서버가 마지막으로 알려 준 장수. 받은 뒤 화면이 바로 고친다. */
  items: null as Pick<OwnerItemsResponse, 'reroll' | 'boost'> | null,
});

/** 이 아이템의 묶음 중 지금 살 수 있는(스토어가 가격을 알려 준) 상품. 스토어를 열 수 없으면 빈 목록. */
export const sellablePacks = (
  item: OwnerItem,
  s: { open: boolean; prices: typeof iapItems.prices },
) => (s.open ? IAP_PRODUCT_IDS.filter((id) => IAP_PRODUCTS[id].item === item && s.prices[id]) : []);

let account: string | null = null;

async function claim(p: Purchase, quiet: boolean) {
  const productId = p.productId;
  if (!isOurs(productId) || !p.purchaseToken) return;
  const r = await claimIap({ store: STORE, productId, token: p.purchaseToken });
  if (!r.ok) {
    // 다른 계정의 구매 · 확인 실패는 거래를 남겨 둔다(그 계정으로 로그인하거나 다음 실행에 다시 보낸다).
    if (!quiet) toast(r.error.retryable ? L.claimFail : r.error.message || L.claimFail);
    return;
  }
  iapItems.items = { reroll: r.data.reroll, boost: r.data.boost };
  await finishTransaction({ purchase: p, isConsumable: true }).catch(() => {});
  const { item } = IAP_PRODUCTS[productId];
  toast(item === 'boost' ? L.boostDone({ n: r.data.boost }) : L.rerollDone({ n: r.data.reroll }));
}

onStorePurchase((p) => {
  if (!isOurs(p.productId)) return;
  const mine = iapItems.busy === p.productId;
  if (mine) iapItems.busy = null;
  if (p.purchaseState === 'pending') {
    if (mine) toast(L.pending);
    return;
  }
  if (p.purchaseState === 'purchased') void claim(p, false);
});
onStoreError((e) => {
  if (!iapItems.busy) return;
  iapItems.busy = null;
  if (e.code !== ErrorCode.UserCancelled) toast(L.payFail);
});

/**
 * 구단주 화면 · 선수 탭이 상품을 보일 때 부른다. 서버에 구단주 표시와 스토어를 묻고, 가격을 받고, 마무리하지 못한 거래를
 * 다시 보낸다. 로그인하지 않았거나 서버가 이 스토어를 확인할 수 없으면 open = false.
 */
export async function syncIapItems() {
  if (!STORE_SUPPORTED) return;
  const r = await fetchItems();
  if (!r.ok || !r.data.iap?.stores.includes(STORE)) {
    iapItems.open = false;
    return;
  }
  account = r.data.iap.account;
  iapItems.items = { reroll: r.data.reroll, boost: r.data.boost };
  if (!(await connectStore())) return;
  try {
    const [products, pending] = await Promise.all([
      fetchProducts({ skus: [...IAP_PRODUCT_IDS], type: 'in-app' }),
      getAvailablePurchases(),
    ]);
    const prices: Partial<Record<IapProductId, string>> = {};
    for (const p of products ?? []) if (isOurs(p.id)) prices[p.id] = p.displayPrice;
    iapItems.prices = prices;
    iapItems.open = Object.keys(prices).length > 0;
    for (const p of pending)
      if (isOurs(p.productId) && p.purchaseState === 'purchased') await claim(p, true);
  } catch {
    // 스토어에 닿지 못하면 이번엔 상품을 보이지 않는다.
  }
}

/** 상품 하나 사기. 결과는 구매 이벤트로 온다. */
export async function buyIapItem(productId: IapProductId) {
  if (!STORE_SUPPORTED || iapItems.busy || !account) return;
  iapItems.busy = productId;
  if (!(await connectStore())) {
    iapItems.busy = null;
    return toast(L.storeFail);
  }
  await requestPurchase({
    request: {
      apple: { sku: productId, appAccountToken: account },
      google: { skus: [productId], obfuscatedAccountId: account },
    },
    type: 'in-app',
  }).catch(() => {
    iapItems.busy = null;
    toast(L.payStartFail);
  });
}

let synced: Promise<void> | undefined;
// 다른 계정으로 바뀌면 구단주 표시와 상품 상태를 다시 받는다.
onSessionChanged(() => {
  synced = undefined;
  account = null;
  iapItems.open = false;
  iapItems.items = null;
});

/** 앱 시작 때: 마무리하지 못한 거래가 스토어에 남아 있을 때만 서버와 맞춰 받는다. 창은 띄우지 않는다. */
export async function recoverIapItems() {
  if (!STORE_SUPPORTED || !(await connectStore())) return;
  const left = await getAvailablePurchases().catch(() => []);
  if (left.some((p) => isOurs(p.productId) && p.purchaseState === 'purchased'))
    synced ??= syncIapItems().catch(() => {
      synced = undefined;
    });
}
/** 상품을 보일 자리가 쓰는 상태. want일 때 앱 실행마다 한 번 서버 · 스토어와 맞춘다(실패하면 다음에 다시). */
export function useIapItems(want: boolean) {
  useEffect(() => {
    if (!want) return;
    synced ??= syncIapItems().catch(() => {
      synced = undefined;
    });
  }, [want]);
  return useSnapshot(iapItems);
}
