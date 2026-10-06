import type { Translation } from '../core';
import type { AdMsgs } from '../ko/ad';

export const ad: Translation<AdMsgs> = {
  title: 'Remove ads',
  body: 'Turns off the ads at the bottom of Records, News and Legends for good. You can restore your purchase on other devices with the same store account.',
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
  rewardedDailyCap: (p: { n: number }) =>
    `You've used all ${p.n} ad tries for today. Try again tomorrow.`,
  rewardedWatch: 'Watch the ad to the end to see the assessment.',
};
