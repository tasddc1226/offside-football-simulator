import type { Translation } from '../core';
import type { GiftMsgs } from '../ko/gift';

const itemsOf = (p: { boost: number; scout: number }) =>
  [
    p.boost ? `${p.boost} boost ticket${p.boost === 1 ? '' : 's'}` : '',
    p.scout ? `${p.scout} premium scout ticket${p.scout === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(' and ');

export const gift: Translation<GiftMsgs> = {
  title: 'A gift for club owners',
  sub: (p) => `Claim ${p.boost} boost tickets and ${p.scout} premium scout tickets.`,
  btn: 'Claim',
  busy: 'Claiming…',
  done: (p) => `You got ${p.boost} boost tickets and ${p.scout} premium scout tickets.`,
  fail: "Couldn't claim the gift. Please try again in a moment.",
  seasonTitle: (p) => `Season ${p.season} achievement rewards are here`,
  seasonSub: (p) => `Your season ${p.season} achievements earned ${itemsOf(p)}.`,
  seasonDone: (p) => `You got ${itemsOf(p)}.`,
};
