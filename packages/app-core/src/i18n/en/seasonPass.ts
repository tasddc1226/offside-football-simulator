import type { Translation } from '../core';
import type { SeasonPassMsgs } from '../ko/seasonPass';

const players = (n: number) => (n === 1 ? 'player' : 'players');

export const seasonPass: Translation<SeasonPassMsgs> = {
  title: 'Season pass',
  seasonTitle: (p) => `Season ${p.season} pass`,
  lead: 'You get the first tier as soon as you buy. Each player you retire this season moves you up the tiers, and every tier gives you items.',
  rule: (p) =>
    `Only this season's players who retire at age ${p.age} or older count, up to ${p.daily} a day.`,
  once: 'This pass lasts one season. It does not renew or charge you again.',
  midSeason: 'Buying mid-season still counts everything you did since the season started.',
  total: (p) => `Items from all tiers: ${p.reward}`,
  progress: (p) => `${p.n} retired`,
  tierCount: (p) => `Tier ${p.tier}/${p.total}`,
  next: (p) => `${p.left} more ${players(p.left)} to retire for tier ${p.tier}`,
  allOpen: 'All tiers unlocked',
  tierName: (p) => `Tier ${p.tier}`,
  tierNeed: (p) => `${p.n} retired`,
  tierNow: 'On purchase',
  tierBonus: (p) => `Bonus · ${p.n} retired`,
  stateClaimed: 'Claimed',
  stateOpen: 'Unlocked',
  stateLocked: 'Locked',
  tierLabel: (p) => `Tier ${p.tier}, ${p.need}, ${p.reward}, ${p.state}`,
  buy: (p) => `Buy pass for ${p.price}`,
  buyBusy: 'Paying…',
  owned: 'You have this pass',
  bought: 'Pass unlocked',
  claim: 'Claim unlocked rewards',
  claimBusy: 'Claiming…',
  got: (p) => `You got: ${p.reward}`,
  nothing: 'No rewards to claim right now',
  claimFail: "Couldn't claim. Please try again in a moment.",
  buyHint:
    'Buy the pass to claim the first tier and any tiers you have already unlocked right away.',
  pastTitle: 'Past season passes',
  pastLead: 'You still have rewards to claim.',
  aheadTitle: (p) => `You already have the Season ${p.season} pass`,
  aheadLead: 'Progress starts when that season opens.',
  webBuyBtn: (p: { price: string }) => `Buy on the web · ₩${p.price}`,
  webBuyNote:
    'Pay by card, PayPal or a local method. This season’s pass opens as soon as payment completes.',
  notOnSale: 'The pass is not on sale right now.',
  webBuy: 'You can buy the pass in the app. Rewards from your pass can be claimed on the web too.',
  login: 'Only logged-in owners can use the season pass.',
  loadFail: "Couldn't load the pass.",
  retry: 'Try again',
  useHint:
    'Use reroll and scout tickets at the candidate step when creating a player, and boost tickets in Potential Boost on the Player tab.',
  entry: 'Season pass',
  entryOwned: (p) => `Tier ${p.tier}/${p.total}`,
  entryClaim: 'Rewards ready to claim',
  entryNew: 'Reward tiers for this season',
  back: 'Back to owner',
};
