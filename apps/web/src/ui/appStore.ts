// T-11-092 웹에서 앱으로 이어 주기. iPhone은 App Store, 안드로이드는 비공개 테스트라 테스터 모집, PC는 둘 다 보인다.
// 인앱 브라우저(카톡 등)도 기기 OS를 따른다. 홈 화면에 추가한 웹 앱(standalone)도 같은 안내를 받는다.
import { appStoreCampaignUrl } from '@offside/app-core/app-store-campaign';
import { entryCampaign } from '../analytics/entry-campaign.js';
import { oauthEntryCampaign } from '../analytics/oauth-campaign.js';
export const appStoreUrl = () =>
  appStoreCampaignUrl(
    `https://offside.invalid/${oauthEntryCampaign(entryCampaign)}`,
    import.meta.env.VITE_APPLE_PROVIDER_TOKEN,
  );
import { trackAppStoreClick, type AppStorePlace } from '../analytics/index.js';
export { appTarget } from './inapp.js';

/** App Store를 새 창으로 연다(아이폰에서는 App Store 앱이 열린다). */
export function openAppStore(place: AppStorePlace) {
  trackAppStoreClick(place);
  window.open(appStoreUrl(), '_blank', 'noopener');
}
