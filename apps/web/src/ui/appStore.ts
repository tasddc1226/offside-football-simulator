// T-11-092 웹에서 앱으로 이어 주기. iPhone은 App Store, T-11-449 Android는 Google Play, PC는 둘 다 보인다.
// 인앱 브라우저(카톡 등)도 기기 OS를 따른다. 홈 화면에 추가한 웹 앱(standalone)도 같은 안내를 받는다.
import { appStoreCampaignUrl, playStoreCampaignUrl } from '@offside/app-core/app-store-campaign';
import type { AppStoreOs } from '@offside/app-core/appPromo';
import { entryCampaign } from '../analytics/entry-campaign.js';
import { oauthEntryCampaign } from '../analytics/oauth-campaign.js';
import { trackAppStoreClick, type AppStorePlace } from '../analytics/index.js';
import { detectInApp, osOf, playStoreIntentUrl } from './inapp.js';
export { appTarget } from './inapp.js';

const entryHref = () => `https://offside.invalid/${oauthEntryCampaign(entryCampaign)}`;
export const appStoreUrl = () =>
  appStoreCampaignUrl(entryHref(), import.meta.env.VITE_APPLE_PROVIDER_TOKEN);
/** T-11-456 Google Play도 유입 캠페인을 install referrer로 붙인다. T-11-466 Android 인앱 브라우저에서는 Play 스토어 앱을 바로 연다. */
export function playStoreUrl(ua = navigator.userAgent) {
  const url = playStoreCampaignUrl(entryHref());
  return detectInApp(ua)?.os === 'android' ? playStoreIntentUrl(url) : url;
}
/** intent 주소는 새 창으로 열면 웹뷰가 무시하기도 해서 지금 창에서 넘긴다(스토어 앱이 열리고 페이지는 그대로다). */
export const opensInPlace = (url: string) => url.startsWith('intent:');
/** 스토어 주소. 두 스토어 모두 유입 캠페인을 붙인다. */
export const storeUrl = (os: AppStoreOs) => (os === 'ios' ? appStoreUrl() : playStoreUrl());

/** 이 기기에 보일 스토어(PC는 둘 다). */
export function appStoresFor(ua = navigator.userAgent): readonly AppStoreOs[] {
  const os = osOf(ua);
  return os === 'other' ? ['ios', 'android'] : [os];
}

/** 스토어를 새 창으로 연다(휴대폰에서는 스토어 앱이 열린다). */
export function openAppStore(os: AppStoreOs, place: AppStorePlace) {
  trackAppStoreClick(place, os);
  const url = storeUrl(os);
  if (opensInPlace(url)) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}
