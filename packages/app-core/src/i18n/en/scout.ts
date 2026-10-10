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
  what: "One of the 3 candidates is guaranteed potential A or higher, and each candidate's chance of S is twice that of a regular scout. Their potential is revealed right away.",
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
};
