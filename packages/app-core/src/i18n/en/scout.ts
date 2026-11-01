import type { Translation } from '../core';
import type { ScoutMsgs } from '../ko/scout';

export const scout: Translation<ScoutMsgs> = {
  title: 'Premium scout ticket',
  btn: (p) => `Premium scout (${p.n} left)`,
  busy: 'Scouting…',
  askTitle: 'Use a premium scout?',
  confirm: (p) =>
    `Use 1 premium scout ticket to draw 3 new candidates. The current candidates will be gone, and you'll have ${p.n} left.`,
  action: 'Premium scout',
  done: (p) => `Premium candidates are in. ${p.n} premium scout tickets left.`,
  fail: "Couldn't use the premium scout ticket.",
  sure: 'A or higher',
  premiumNote: 'Premium scout candidates. Potential is shown for all three.',
  premiumHelp:
    'Starting potential grade ranges. Training and boosts can change them. These are premium scout candidates, so the odds differ from a normal scout. See the table above.',
  what: (p: { mult: number }) =>
    `One of the 3 candidates is guaranteed potential A or higher, and each candidate's chance of S is ${p.mult}x that of a regular scout. Their potential is revealed right away.`,
  pack: (p) => `${p.n} premium scout ticket${p.n === 1 ? '' : 's'}`,
  got: (p) => `Premium scout tickets received. You now have ${p.n}.`,
  shopSub: 'Use them when picking a new player',
  shopSubHave: (p) => `You have ${p.n} · use them when picking a new player`,
  shopNote: 'You pay with your store account, and the tickets go to this owner account.',
  shopGo: 'See premium scout tickets',
  shopWeb: 'Premium scout tickets can be bought in the app.',
  oddsShow: 'Show odds',
  oddsHide: 'Hide odds',
  oddsTitle: 'Potential grade odds per candidate',
  oddsNormal: 'Regular scout · reroll',
  oddsSure: 'Premium · guaranteed candidate (1)',
  oddsRest: 'Premium · other candidates (2)',
  oddsNote:
    'Calculated from the current game settings. Odds differ before and after the season opens. Grades are based on true potential.',
  pitySure: (p) => (p.n <= 1 ? 'Next ticket: S guaranteed' : `S guaranteed in ${p.n}`),
  pityElite: (p) => (p.n <= 1 ? 'Next ticket: elite S guaranteed' : `Elite S in ${p.n}`),
  pityHelp: (p) =>
    `The S bar fills on your ${p.sure}th ticket without an S candidate. If an S candidate shows up first, it starts over. The elite S bar fills on every ${p.elite}th ticket and never starts over.`,
  pityTitle: 'Pity',
  gaugeElite: 'Elite S (potential 96)',
  gaugeCount: (p) => `${p.have} / ${p.need}`,
  gaugeNext: 'Next ticket',
  pityKeep: 'Your count carries on when you get more tickets.',
  doneReset: (p) =>
    `You got an S candidate, so the S bar starts over. ${p.n} premium scout tickets left.`,
  pillSure: 'S guaranteed',
  pillElite: 'Elite S',
  doneSure: (p) => `You hit the pity and got an S candidate. ${p.n} premium scout tickets left.`,
  doneElite: (p) =>
    `Your ${p.elite}th ticket brought an elite S candidate. ${p.n} premium scout tickets left.`,
  funds: 'Buy with club funds',
  fundsWeek: (p) => `This week ${p.bought}/${p.cap}`,
  fundsNote: 'You can buy 1 ticket a week with club funds. It resets every Monday at 00:00 (KST).',
  fundsSoldOut: "You've bought this week's limit. You can buy more from 00:00 (KST) next Monday.",
  fundsClosed: "They aren't on sale for club funds right now.",
  fundsConfirm: (p) =>
    `Buy 1 premium scout ticket for ${p.price}? You'll have ${p.balance} in club funds left, and this can't be undone.`,
  fundsDone: (p) => `Premium scout ticket bought. You now have ${p.n}.`,
  fundsFail: "Couldn't buy the premium scout ticket.",
  oddsPity: (p) =>
    `Pity: after ${p.sure - 1} tickets with no S, the guaranteed candidate on the ${p.sure}th is S. An S candidate along the way starts the count over. On every ${p.elite}th ticket, the guaranteed candidate has top potential (96).`,
};
