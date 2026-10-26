import { campaignQuery } from '@offside/contracts/acquisition';

// Capture once at boot before lazy screens or SPA navigation. Retain allowlisted UTM only.
export const entryCampaign = typeof location === 'undefined' ? '' : campaignQuery(location.href);
