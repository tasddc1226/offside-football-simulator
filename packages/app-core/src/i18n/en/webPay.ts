import type { Translation } from '../core';
import type { WebPayMsgs } from '../ko/webPay';

export const webPay: Translation<WebPayMsgs> = {
  title: 'Buy on the web',
  sub: 'Pay by card or easy pay. Items go straight to this owner account.',
  pack: (p) =>
    `${p.n} ${{ reroll: 'reroll tickets', boost: 'boost tickets', scout: 'premium scout tickets', rename: 'player rename tickets' }[p.item] ?? p.item}`,
  price: (p) => `₩${p.won}`,
  pay: (p) => `Pay ₩${p.won}`,
  cancel: 'Close',
  opening: 'Opening payment…',
  startFail: "Couldn't open the payment window. Please try again in a moment.",
  canceled: 'Payment canceled.',
  failed: "The payment didn't go through. Check your payment method and try again.",
  confirming: 'Confirming payment…',
  done: 'Payment complete. Your items are in.',
  claimFail:
    'Your payment went through, but something went wrong while adding the items. Reopen the owner screen to get them.',
  refund:
    'You can request a refund for unused items within 7 days of payment. Used items are not refundable. Contact: contact@offside-lab.com',
  shopWeb: 'You can buy them below in Buy on the web.',
};
