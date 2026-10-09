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
  boostBuyLead:
    'With boost tickets you can try right away with no ad, and keep trying with no limit on tries.',
  boostNote: (p) =>
    `One boost ticket is one attempt, usable after this season's try or when funds are short. Unlike ad or club-fund extra tries, there's no limit on tries. Current success chance: ${p.chance}% (it goes up after a failure).`,
  shopTitle: 'Boost ticket shop',
  shopSub: "Use them on the Player tab's potential boost",
  shopSubHave: (p) => `You have ${p.n} · use them on the Player tab's potential boost`,
  shopNote:
    "One boost ticket is one attempt, usable after this season's try or when funds are short. Unlike ad or club-fund extra tries, there is no limit on tries, and the success chance is the same. You pay with your store account, and the tickets go to this owner account.",
  shopWeb: 'Boost tickets can be bought in the app.',
};
