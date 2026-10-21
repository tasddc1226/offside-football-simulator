// T-11-092 웹에서 앱으로 이어 주기. iPhone은 App Store, T-11-449 Android는 Google Play, PC는 둘 다 보인다.
// 인앱 브라우저(카톡 등)도 기기 OS를 따른다. 홈 화면에 추가한 웹 앱(standalone)도 같은 안내를 받는다.
import { appStoreCampaignUrl } from '@offside/app-core/app-store-campaign';
import { APP_STORES, type AppStoreOs } from '@offside/app-core/appPromo';
import { entryCampaign } from '../analytics/entry-campaign.js';
import { oauthEntryCampaign } from '../analytics/oauth-campaign.js';
import { trackAppStoreClick, type AppStorePlace } from '../analytics/index.js';
import { osOf } from './inapp.js';
export { appTarget } from './inapp.js';

export const appStoreUrl = () =>
  appStoreCampaignUrl(
    `https://offside.invalid/${oauthEntryCampaign(entryCampaign)}`,
    import.meta.env.VITE_APPLE_PROVIDER_TOKEN,
  );
/** 스토어 주소. App Store는 유입 캠페인을 붙인다. */
export const storeUrl = (os: AppStoreOs) => (os === 'ios' ? appStoreUrl() : APP_STORES[os].url);

/** 이 기기에 보일 스토어(PC는 둘 다). */
export function appStoresFor(ua = navigator.userAgent): readonly AppStoreOs[] {
  const os = osOf(ua);
  return os === 'other' ? ['ios', 'android'] : [os];
}

/** 스토어를 새 창으로 연다(휴대폰에서는 스토어 앱이 열린다). */
export function openAppStore(os: AppStoreOs, place: AppStorePlace) {
  trackAppStoreClick(place, os);
  window.open(storeUrl(os), '_blank', 'noopener');
}
