import type { Translation } from '../core';
import type { FundsHistoryMsgs } from '../ko/fundsHistory';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fundsHistory: Translation<FundsHistoryMsgs> = {
  eyebrow: 'Club funds',
  title: 'Club funds history',
  balance: 'Club funds now',
  income: 'Money in',
  spending: 'Money out',
  released: 'Released',
  sold: 'Sold',
  fees: (p) => `${p.fee} fee taken`,
  bought: 'Signed',
  spent: 'Spent from funds',
  log: 'History',
  empty:
    'No club funds have moved yet. Release players you raised or sell them on the market to earn funds.',
  more: 'Show more',
  loadFail: "Couldn't load the history.",
  retry: 'Try again',
  date: (p) => `${MONTHS[p.m - 1]} ${p.d}`,
  openAria: 'Open club funds history',
};
