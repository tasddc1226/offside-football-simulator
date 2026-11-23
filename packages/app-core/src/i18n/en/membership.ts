import type { Translation } from '../core';
import type { MembershipMsgs } from '../ko/membership';

export const membership: Translation<MembershipMsgs> = {
  title: 'Club membership',
  lead: 'A monthly subscription that adds to what you get every day.',
  perkAttend: 'Double check-in rewards',
  perkAttendSub: 'Every daily check-in gives twice the items.',
  perkBoost: 'A potential boost ticket every day',
  perkBoostSub: 'Each check-in gives you one extra potential boost ticket.',
  perkAds: 'No ads',
  perkAdsSub: 'While subscribed, you get ad rewards without watching ads.',
  perkBadge: 'Supporter badge',
  perkBadgeSub:
    'A supporter badge appears next to your name on clubs, rankings, friends and comments. It changes at 3, 6 and 9 months in a row.',
  perkTenure: 'Streak gifts',
  perkTenureSub:
    'From your 2nd month, you get a gift every month when you check in. Boost tickets grow by 1 each month up to 6, and every 3rd month adds 1 premium scout ticket.',
  streak: (p) => `Subscribed ${p.months} ${p.months === 1 ? 'month' : 'months'} in a row`,
  nextGift: (p) => `Month ${p.months} gift · ${p.reward}`,
  join: (p) => `Join for ${p.price}/month`,
  joinIntro: (p) =>
    p.months === 1
      ? `Join for ${p.price} the first month`
      : `Join for ${p.price}/month for ${p.months} months`,
  introNote: (p) =>
    `After ${p.months === 1 ? 'the first month' : `the first ${p.months} months`} it renews at ${p.price}/month. This price is for first-time subscribers, once.`,
  joinBusy: 'Processing…',
  joined: 'You joined the club membership.',
  active: 'Your membership is active',
  renews: (p) => `Next month is charged on ${p.date}.`,
  ends: (p) => `Auto-renew is off. Benefits last until ${p.date}.`,
  until: (p) => `Benefits last until ${p.date}.`,
  expired: 'Your membership has ended. Join again to get the benefits right away.',
  renewNote:
    'Renews automatically every month. If you cancel, benefits continue for the rest of the period.',
  manage: 'Manage subscription',
  manageHint: 'Cancel or change payment in your store subscription settings.',
  restore: 'Restore purchase',
  restoreBusy: 'Checking…',
  restoreNone: 'No membership to restore.',
  adOwned: 'If you already bought Remove ads, it stays even after the membership ends.',
  webBuy: (p: { price: string; days: number }) => `Buy ${p.days} days on the web · ₩${p.price}`,
  webOnce:
    'A web pass does not renew on its own. Buy again before it ends and the new days start when the current ones run out.',
  notOnSale: 'Membership sign-up is closed right now.',
  webJoin:
    'You can join in the app. Benefits from a membership joined in the app also apply on the web.',
  login: 'Only signed-in owners can use the club membership.',
  loadFail: "Couldn't load the membership.",
  retry: 'Try again',
  entry: 'Club membership',
  entrySub: 'Double check-in · Daily potential boost ticket · No ads · Streak gifts',
  entryActive: 'Active',
  back: 'Back to owner',
  adHint: 'Members get this without ads',
  adHintGo: 'See membership',
};
