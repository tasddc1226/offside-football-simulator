import type { Translation } from '../core';
import type { WebPayMsgs } from '../ko/webPay';

export const webPay: Translation<WebPayMsgs> = {
  title: 'Buy on the web',
  sub: 'Pay by card, PayPal, or a local payment method. Items go straight to this owner account.',
  pack: (p) =>
    `${p.n} ${{ reroll: 'reroll tickets', boost: 'boost tickets', scout: 'premium scout tickets', rename: 'player rename tickets' }[p.item] ?? p.item}`,
  price: (p) => `from ₩${p.won}`,
  priceNote: 'Checkout shows the price in your local currency, including tax.',
  opening: 'Opening checkout…',
  startFail: "Couldn't open checkout. Please try again in a moment.",
  confirming: 'Confirming payment…',
  done: 'Payment complete. Your items are in.',
  pending:
    "Your items will arrive once the payment is confirmed. If you didn't pay, you can ignore this.",
  canceled: 'This payment was refunded, so the items were taken back.',
  refund:
    'You can request a refund for unused items within 7 days of payment. Used items are not refundable. Contact: contact@offside-lab.com',
};
