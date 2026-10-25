import type { Translation } from '../core';
import type { GiftMsgs } from '../ko/gift';

const itemsOf = (p: { boost: number; scout: number; reroll?: number }) => {
  const xs = [
    p.reroll ? `${p.reroll} reroll ticket${p.reroll === 1 ? '' : 's'}` : '',
    p.boost ? `${p.boost} boost ticket${p.boost === 1 ? '' : 's'}` : '',
    p.scout ? `${p.scout} premium scout ticket${p.scout === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return xs.length > 2 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs.join(' and ');
};

export const gift: Translation<GiftMsgs> = {
  btn: 'Claim',
  busy: 'Claiming…',
  fail: "Couldn't claim the gift. Please try again in a moment.",
  seasonTitle: (p) => `Season ${p.season} achievement rewards are here`,
  seasonSub: (p) => `Your season ${p.season} achievements earned ${itemsOf(p)}.`,
  seasonDone: (p) => `You got ${itemsOf(p)}.`,
  recordTitle: (p) => `Season ${p.season} record rewards are here`,
  recordSub: (p) => `Your season ${p.season} Hall of Fame records earned ${itemsOf(p)}.`,
  recordHof: (p) => `Hall of Fame #${p.rank}`,
  recordIcons: (p) => `${p.n} Icon${p.n === 1 ? '' : 's'}`,
  recordLegends: (p) => `${p.n} Legend${p.n === 1 ? '' : 's'}`,
  recordBallon: (p) => `${p.n} Ballon d'Or winner${p.n === 1 ? '' : 's'}`,
  doneTitle: 'Gift claimed',
  useHint:
    'Use reroll tickets to redraw candidates when creating a player, boost tickets in Potential Boost on the Player tab, and scout tickets at the candidate step when creating a player.',
  toOwner: 'View in my club',
};
