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
  bonus: 'Retirement bonus',
  matchIncome: 'Match income',
  matchGames: (p) => `${p.n} ranked ${p.n === 1 ? 'match' : 'matches'}`,
  tourFee: 'Away tour fee',
  tourStage: (p) => `Away tour match ${p.n}`,
  enhance: 'Card enhance',
  sold: 'Sold',
  fees: (p) => `${p.fee} fee taken`,
  bought: 'Signed',
  spent: 'Spent from funds',
  log: 'History',
  empty:
    'No club funds have moved yet. Play ranked matches or release players you raised to earn funds.',
  more: 'Show more',
  loadFail: "Couldn't load the history.",
  retry: 'Try again',
  date: (p) => `${MONTHS[p.m - 1]} ${p.d}`,
  openAria: 'Open club funds history',
};
