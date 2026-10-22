import { CAMPAIGNS, campaignQuery } from '@offside/contracts/acquisition';
import { IOS_APP_STORE_URL, PLAY_STORE_URL } from './links.js';

/** providerToken must come from an App Store Connect campaign link, never an app/team ID. */
export function appStoreCampaignUrl(href: string, providerToken: string | undefined): string {
  if (!providerToken || !/^[0-9]{1,30}$/.test(providerToken)) return IOS_APP_STORE_URL;
  const query = new URLSearchParams(campaignQuery(href));
  // Versioned, append-only allowlist indices are short, unambiguous and free of identifiers.
  const parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map((k) =>
    (CAMPAIGNS[k]!.indexOf(query.get(k) ?? '') + 1).toString(36),
  );
  if (!query.get('utm_source') || !query.get('utm_campaign')) return IOS_APP_STORE_URL;
  const url = new URL(IOS_APP_STORE_URL);
  url.searchParams.set('pt', providerToken);
  url.searchParams.set('ct', 'os1.' + parts.join('.'));
  url.searchParams.set('mt', '8');
  return url.href;
}

/** T-11-456 Google Play는 install referrer로 허용 UTM만 넘긴다(Play Console 획득 보고서가 캠페인별 설치를 센다). */
export function playStoreCampaignUrl(href: string): string {
  const query = new URLSearchParams(campaignQuery(href));
  if (!query.get('utm_source') || !query.get('utm_campaign')) return PLAY_STORE_URL;
  const url = new URL(PLAY_STORE_URL);
  url.searchParams.set('referrer', query.toString());
  return url.href;
}
