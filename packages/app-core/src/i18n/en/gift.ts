import type { Translation } from '../core';
import type { GiftMsgs } from '../ko/gift';

export const gift: Translation<GiftMsgs> = {
  title: 'A gift for club owners',
  sub: (p) => `Claim ${p.boost} boost tickets and ${p.scout} premium scout tickets.`,
  btn: 'Claim',
  busy: 'Claiming…',
  done: (p) => `You got ${p.boost} boost tickets and ${p.scout} premium scout tickets.`,
  fail: "Couldn't claim the gift. Please try again in a moment.",
};
