import { CONSENT_KEY } from '@offside/app-core/analytics-model';
import { campaignQuery } from '@offside/contracts/acquisition';

const KEY = 'offside_acquisition_oauth_v1';
const WITHDRAWN_KEY = 'offside_acquisition_oauth_withdrawn_v1';
export const OAUTH_CAMPAIGN_MS = 10 * 60_000;
export type OAuthProvider = 'google' | 'apple';
type Context = { provider: OAuthProvider; campaign: string; at: number };
// Keep mutable continuation state in this lazy module, outside the first-screen entry snapshot.
let restoredCampaign: string | null = null;
export const oauthEntryCampaign = (entry: string) => restoredCampaign ?? entry;
export function restoreOAuthEntry(campaign: string) {
  restoredCampaign = campaignQuery(`https://offside.invalid/${campaign}`);
}
export function resetOAuthEntry() {
  restoredCampaign = null;
}

export function oauthMeasurementAllowed() {
  try {
    return (
      localStorage.getItem(CONSENT_KEY) === 'granted' &&
      localStorage.getItem('offside_acquisition_choice_v1') === 'granted' &&
      !localStorage.getItem('offside_acquisition_revoke_v1')
    );
  } catch {
    return false;
  }
}
export function clearOAuthCampaign() {
  try {
    sessionStorage.removeItem(KEY);
    return true;
  } catch {
    /* Optional navigation context. */
    return false;
  }
}
/** Other tabs may be on the provider site and miss storage events. No identity is stored. */
export function withdrawOAuthCampaign() {
  clearOAuthCampaign();
  try {
    localStorage.setItem(WITHDRAWN_KEY, String(Date.now()));
  } catch {
    /* Storage blocked. */
  }
}
export function oauthCampaignCurrent(at: number) {
  try {
    let withdrawn = Number(localStorage.getItem(WITHDRAWN_KEY) ?? '0');
    // All contexts older than this are expired, so the local withdrawal time is no longer needed.
    if (withdrawn > 0 && Date.now() - withdrawn >= OAUTH_CAMPAIGN_MS) {
      localStorage.removeItem(WITHDRAWN_KEY);
      withdrawn = 0;
    }
    const age = Date.now() - at;
    return (
      oauthMeasurementAllowed() &&
      Number.isFinite(withdrawn) &&
      withdrawn >= 0 &&
      withdrawn < at &&
      Number.isFinite(at) &&
      age >= 0 &&
      age < OAUTH_CAMPAIGN_MS
    );
  } catch {
    return false;
  }
}
/** No account, session, click identifier, URL or event history is copied. */
export function rememberOAuthCampaign(provider: OAuthProvider, campaign: string, granted: boolean) {
  if (!clearOAuthCampaign()) return;
  if (!granted || !oauthMeasurementAllowed()) return;
  const safe = campaignQuery(`https://offside.invalid/${campaign}`);
  if (!safe || safe !== campaign || safe.length > 256) return;
  try {
    // An ad may have opened this tab. Detach only at the explicit, consented login action;
    // a child tab opened after this point still has an opener and cannot reuse the context.
    if (typeof window !== 'undefined' && window.opener) window.opener = null;
    if (typeof window !== 'undefined' && window.opener) return;
    const at = Date.now();
    if (!oauthCampaignCurrent(at)) return;
    sessionStorage.setItem(KEY, JSON.stringify({ provider, campaign: safe, at }));
  } catch {
    /* Login works even when optional storage is unavailable. */
  }
}
/** Consume once, including failed/cancelled/unrelated returns. A copied opener tab cannot use it. */
export function takeOAuthCampaign(href: string): Context | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!clearOAuthCampaign()) return null;
    if (!raw || !oauthMeasurementAllowed() || (typeof window !== 'undefined' && window.opener))
      return null;
    const c = JSON.parse(raw) as Context;
    const u = new URL(href);
    if (
      !/^\/settings\/?$/.test(u.pathname) ||
      u.searchParams.has('google') === u.searchParams.has('apple')
    )
      return null;
    if (
      !['google', 'apple'].includes(c.provider) ||
      !['linked', 'switched'].includes(u.searchParams.get(c.provider) ?? '')
    )
      return null;
    if (
      Object.keys(c).sort().join(',') !== 'at,campaign,provider' ||
      typeof c.campaign !== 'string' ||
      c.campaign.length > 256 ||
      !c.campaign
    )
      return null;
    if (campaignQuery(`https://offside.invalid/${c.campaign}`) !== c.campaign) return null;
    if (!oauthCampaignCurrent(c.at)) return null;
    return c;
  } catch {
    clearOAuthCampaign();
    return null;
  }
}
