// T-11-092 웹에서 앱으로 이어 주기. T-11-095 iPhone은 App Store, Android는 Google Play, 기기를 모르면(PC) 둘 다 보인다.
// 인앱 브라우저(카톡 등)도 기기 OS를 따른다. 홈 화면에 추가한 웹 앱(standalone)도 같은 안내를 받는다.
import { APP_STORES, type AppStoreOs } from '@offside/app-core/appPromo';
import { trackAppStoreClick, type AppStorePlace } from '../analytics/index.js';
import { osOf } from './inapp.js';

/** 이 기기에 보일 스토어(PC는 둘 다). */
export function appStoresFor(ua = navigator.userAgent): readonly AppStoreOs[] {
  const os = osOf(ua);
  return os === 'other' ? ['ios', 'android'] : [os];
}

/** 스토어를 새 창으로 연다(휴대폰에서는 스토어 앱이 열린다). */
export function openAppStore(os: AppStoreOs, place: AppStorePlace) {
  trackAppStoreClick(place, os);
  window.open(APP_STORES[os].url, '_blank', 'noopener');
}
