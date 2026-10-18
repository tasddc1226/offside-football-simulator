import { campaignQuery } from '@offside/contracts/acquisition';

// Capture once at boot before lazy screens or SPA navigation. Retain allowlisted UTM only.
const originalCampaign = typeof location === 'undefined' ? '' : campaignQuery(location.href);
export let entryCampaign = originalCampaign;

/** Only the verified, consented web OAuth continuation may restore this tab's entry. */
export function restoreEntryCampaign(campaign: string) {
  entryCampaign = campaignQuery(`https://offside.invalid/${campaign}`);
}
export function resetEntryCampaign() {
  entryCampaign = originalCampaign;
}
