import type { Translation } from '../core';
import type { AdMsgs } from '../ko/ad';

export const ad: Translation<AdMsgs> = {
  title: 'Remove ads',
  body: 'Turns off the ads at the bottom of Records, News and Legends for good. Rewarded ads for candidate rerolls, potential peeks, season reviews and potential boosts are granted right away without an ad. Odds and limits stay the same, and no rerolls, scout tickets or boost tickets are included. You can restore your purchase on other devices with the same store account.',
  owned: 'Remove ads purchased. Thank you.',
  checking: 'Checking the store…',
  buyPrice: (p) => `Remove ads ${p.price}`,
  restore: 'Restore purchase',
  pending: "Waiting for payment approval. Ads turn off once it's approved.",
  done: 'Ads are off. Thank you.',
  payFail: "Couldn't complete the payment. Please try again in a moment.",
  storeFail: "Couldn't reach the store. Please try again in a moment.",
  payStartFail: "Couldn't start the payment. Please try again in a moment.",
  restored: 'Purchase restored. Ads are off.',
  noPurchase: 'This store account has no Remove ads purchase on record.',
  restoreFail: "Couldn't restore. Please try again in a moment.",
  rewardedUnavailable: "Can't load an ad right now. Please try again in a moment.",
  rewardedWatch: 'Watch the ad to the end to see the assessment.',
  adRerollBtn: (p) => `Watch an ad to redraw (${p.n} left today)`,
  adRerollFreeBtn: (p) => `Redraw candidates (${p.n} left today)`,
  adRerollShort: 'Redraw',
  adRerollBadge: (p) => (p.ad ? `Ad · ${p.n} left` : `${p.n} left`),
  adRerollConfirm: (p) =>
    `Redraw all 3 candidates? Your current candidates and any revealed potential ranges will be lost. ${p.n} left today after this.`,
  adRerollWatch: 'Watch the whole ad to redraw your candidates.',
  adRerollDone: (p) => `Candidates redrawn. ${p.n} more today.`,
};
