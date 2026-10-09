import type { Translation } from '../core';
import type { IapMsgs } from '../ko/iap';

export const iap: Translation<IapMsgs> = {
  packsTitle: 'Buy in the store',
  rerollPack: (p) => `${p.n} reroll tickets`,
  boostPack: (p) => `${p.n} boost tickets`,
  busy: 'Processing…',
  loading: 'Checking the store…',
  storeFail: "Couldn't connect to the store. Please try again in a moment.",
  payStartFail: "Couldn't start the payment. Please try again in a moment.",
  payFail: "The payment didn't go through. Please try again in a moment.",
  pending: "Waiting for payment approval. You'll get it automatically once approved.",
  rerollDone: (p) => `Reroll tickets added. You now have ${p.n}.`,
  boostDone: (p) => `Boost tickets added. You now have ${p.n}.`,
  claimFail:
    "Your payment went through, but something went wrong while adding it. You'll get it the next time you open the app.",
  rerollNote:
    'Reroll tickets redraw the 3 candidates when you create a new player. You pay with your store account, and the tickets go to this owner account.',
  boostBuyLead: 'With a boost ticket you can try right away, no ad needed.',
  boostNote: (p) =>
    `One boost ticket equals one attempt you'd get from an ad or club funds. Current success chance: ${p.chance}% (it goes up after a failure). When and how often you can use it is the same too.`,
};
