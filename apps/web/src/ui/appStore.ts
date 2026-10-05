// T-11-092 웹에서 앱으로 이어 주기. iPhone은 App Store, 안드로이드는 비공개 테스트라 테스터 모집, PC는 둘 다 보인다.
// 인앱 브라우저(카톡 등)도 기기 OS를 따른다. 홈 화면에 추가한 웹 앱(standalone)도 같은 안내를 받는다.
import { IOS_APP_STORE_URL } from '@offside/app-core/links';
import { trackAppStoreClick, type AppStorePlace } from '../analytics/index.js';
import { osOf } from './inapp.js';

type AppTarget = 'ios' | 'android' | 'both';
export function appTarget(ua = navigator.userAgent): AppTarget {
  const os = osOf(ua);
  return os === 'other' ? 'both' : os;
}

/** App Store를 새 창으로 연다(아이폰에서는 App Store 앱이 열린다). */
export function openAppStore(place: AppStorePlace) {
  trackAppStoreClick(place);
  window.open(IOS_APP_STORE_URL, '_blank', 'noopener');
}
