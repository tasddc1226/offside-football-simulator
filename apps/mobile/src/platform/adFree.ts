// T-11-069 광고 제거(한 번 사면 평생인 비소모성 인앱 상품, ₩3,300). 서버 없이 스토어 구매 기록으로만 판단한다.
// 같은 스토어 계정이면 기기를 바꿔도 '구매 복원'으로 되살아난다. 구매 여부는 이 기기에도 남겨 시작하자마자 광고 칸을 끈다.
// 환불로 스토어 기록이 사라져도 자동으로 되돌리지 않는다(오프라인·로그아웃 상태를 환불로 잘못 읽지 않게).
import { Platform } from 'react-native';
import { proxy } from 'valtio';
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Purchase,
} from 'expo-iap';
import { kv } from './setup';

/** App Store Connect·Play Console에 같은 ID로 만든 비소모성 상품. */
export const REMOVE_ADS = 'com.offsidelab.app.remove_ads';
const OWNED = 'offside_ad_free';
export const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

export const adFree = proxy({
  owned: kv.getBoolean(OWNED) ?? false,
  /** 스토어가 알려 준 현지 가격('₩3,300'). 못 받으면 빈 문자열. */
  price: '',
  busy: false,
  message: '',
});

function grant() {
  kv.set(OWNED, true);
  adFree.owned = true;
}

const owns = (purchases: Purchase[]) =>
  purchases.some((p) => p.productId === REMOVE_ADS && p.purchaseState === 'purchased');

async function onPurchase(p: Purchase) {
  if (p.productId !== REMOVE_ADS) return;
  if (p.purchaseState === 'pending') {
    adFree.message = '결제 승인을 기다리고 있어요. 승인되면 광고가 꺼져요.';
    adFree.busy = false;
    return;
  }
  if (p.purchaseState !== 'purchased') return;
  // 마무리를 못 해도 구매는 끝났으니 먼저 광고를 끈다. 마무리는 다음 시작 때 스토어가 다시 알려 준다.
  grant();
  adFree.busy = false;
  adFree.message = '광고를 껐어요. 고마워요.';
  await finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
}

let connected: Promise<boolean> | undefined;
/** 스토어 연결은 앱 실행마다 한 번. 실패하면 다음 호출 때 다시 시도한다. */
function connect() {
  connected ??= initConnection()
    .then(() => {
      purchaseUpdatedListener((p) => void onPurchase(p));
      purchaseErrorListener((e) => {
        adFree.busy = false;
        adFree.message =
          e.code === ErrorCode.UserCancelled
            ? ''
            : '결제하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
      });
      return true;
    })
    .catch(() => {
      connected = undefined;
      return false;
    });
  return connected;
}

/** 앱 시작 때: 가격을 받아 두고, 이 스토어 계정에 구매 기록이 있으면 광고를 끈다. 창은 띄우지 않는다. */
export async function syncAdFree() {
  if (!SUPPORTED || !(await connect())) return;
  try {
    const [products, purchases] = await Promise.all([
      fetchProducts({ skus: [REMOVE_ADS], type: 'in-app' }),
      adFree.owned ? Promise.resolve([]) : getAvailablePurchases(),
    ]);
    adFree.price = products?.find((p) => p.id === REMOVE_ADS)?.displayPrice ?? '';
    if (owns(purchases)) grant();
  } catch {
    // 스토어에 닿지 못하면 이번 실행은 그대로 둔다.
  }
}

/** '광고 제거' 버튼. 결과는 구매 이벤트로 온다. */
export async function buyAdFree() {
  if (!SUPPORTED || adFree.busy || adFree.owned) return;
  adFree.busy = true;
  adFree.message = '';
  if (!(await connect())) {
    adFree.busy = false;
    adFree.message = '스토어에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    return;
  }
  await requestPurchase({
    request: { apple: { sku: REMOVE_ADS }, google: { skus: [REMOVE_ADS] } },
    type: 'in-app',
  }).catch(() => {
    adFree.busy = false;
    adFree.message = '결제를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  });
}

/** '구매 복원' 버튼(비소모성 상품은 스토어 심사에서 복원 버튼을 요구한다). */
export async function restoreAdFree() {
  if (!SUPPORTED || adFree.busy) return;
  adFree.busy = true;
  adFree.message = '';
  try {
    if (!(await connect())) throw new Error('connect');
    // 기기에 남은 구매 기록부터 본다. 없을 때만 스토어와 다시 맞추는데, 로그인 창을 닫거나
    // 계정이 없으면 끝나지 않을 수 있어 30초에서 끊는다.
    let found = owns(await getAvailablePurchases());
    if (!found) {
      await Promise.race([
        restorePurchases(),
        new Promise((resolve) => setTimeout(resolve, 30_000)),
      ]);
      found = owns(await getAvailablePurchases());
    }
    if (found) {
      grant();
      adFree.message = '구매를 복원해 광고를 껐어요.';
    } else {
      adFree.message = '이 스토어 계정에는 광고 제거 구매 기록이 없어요.';
    }
  } catch {
    adFree.message = '복원하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  } finally {
    adFree.busy = false;
  }
}
