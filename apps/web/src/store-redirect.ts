import { appStoreCampaignUrl, playStoreCampaignUrl } from '@offside/app-core/app-store-campaign';

// T-11-584 랜딩(/app/)의 스토어 버튼 · QR. 기기(또는 ?os=)에 맞는 스토어로 보내고, 들어온 유입 캠페인이 없으면
// 랜딩 꼬리표(utm_content=lp_<자리>)를 붙여 App Store 캠페인 · Play install referrer로 넘긴다. PC는 랜딩으로 돌려보낸다.
const LANDING_PLACES = new Set(['hero', 'dock', 'end', 'qr', 'nav']);
export function storeRedirect(url: URL, userAgent: string, providerToken?: string): string {
  const asked = url.searchParams.get('os');
  const os =
    asked === 'ios' || asked === 'android'
      ? asked
      : /iPhone|iPad|iPod/.test(userAgent)
        ? 'ios'
        : /Android/.test(userAgent)
          ? 'android'
          : null;
  if (!os) return '/app/';
  const campaign = new URL(url.href);
  if (!campaign.searchParams.get('utm_source')) {
    const place = url.searchParams.get('p') ?? '';
    campaign.searchParams.set('utm_source', 'landing');
    campaign.searchParams.set('utm_medium', 'web');
    campaign.searchParams.set('utm_campaign', 'app_landing');
    campaign.searchParams.set('utm_content', `lp_${LANDING_PLACES.has(place) ? place : 'hero'}`);
  }
  return os === 'ios'
    ? appStoreCampaignUrl(campaign.href, providerToken)
    : playStoreCampaignUrl(campaign.href);
}
