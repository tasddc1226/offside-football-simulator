// 스토어(App Store · Google Play) 연결 하나를 광고 제거(adFree.ts)와 소모성 상품(iapItems.ts)이 함께 쓴다.
// 구매 · 오류 이벤트는 모든 구독자에게 가고, 각자 자기 상품 · 자기 진행 중 요청만 처리한다.
import { Platform } from 'react-native';
import {
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  type Purchase,
} from 'expo-iap';

type StoreError = Parameters<Parameters<typeof purchaseErrorListener>[0]>[0];

export const STORE_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

const onPurchase = new Set<(p: Purchase) => void>();
const onError = new Set<(e: StoreError) => void>();

/** 구매 · 오류 이벤트 구독. 앱이 살아 있는 동안 유지한다. */
export function onStorePurchase(fn: (p: Purchase) => void) {
  onPurchase.add(fn);
}
export function onStoreError(fn: (e: StoreError) => void) {
  onError.add(fn);
}

let connected: Promise<boolean> | undefined;
/** 스토어 연결은 앱 실행마다 한 번. 실패하면 다음 호출 때 다시 시도한다. */
export function connectStore() {
  connected ??= initConnection()
    .then(() => {
      purchaseUpdatedListener((p) => onPurchase.forEach((fn) => fn(p)));
      purchaseErrorListener((e) => onError.forEach((fn) => fn(e)));
      return true;
    })
    .catch(() => {
      connected = undefined;
      return false;
    });
  return connected;
}
