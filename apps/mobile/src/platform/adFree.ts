// 1.0.2 호환 번들: 이 빌드에는 결제(expo-iap) 네이티브 모듈이 없어 광고 제거 구매를 숨긴다.
import { proxy } from 'valtio';

export const REMOVE_ADS = 'com.offsidelab.app.remove_ads';
export const SUPPORTED = false;
export const adFree = proxy({ owned: false, price: '', busy: false, message: '' });
export async function syncAdFree() {}
export async function buyAdFree() {}
export async function restoreAdFree() {}
