import type { Translation } from '../core';
import type { StarterPackMsgs } from '../ko/starterPack';

export const starterPack: Translation<StarterPackMsgs> = {
  title: 'Starter pack',
  note: 'One per account. You pay with your store account and the items go to this owner account.',
  buy: (p) => `Buy for ${p.price}`,
  bought: 'You got the starter pack.',
  close: 'Close',
};
