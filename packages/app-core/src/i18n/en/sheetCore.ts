import type { Translation } from '../core';
import type { SheetCoreMsgs } from '../ko/sheetCore';

export const sheetCore: Translation<SheetCoreMsgs> = {
  skip: 'Skip',
  tallyApps: 'Apps',
  tallyGoals: 'Goals',
  tallyCleanSheets: 'Clean sheets',
  tallyAssists: 'Assists',
  tallyRating: 'Rating',
  wdl: (p) => `W${p.w} D${p.d} L${p.l}`,
  tickerMins: (p) => `${p.n} min`,
  tickerGoals: (p) => `${p.n} ${p.n === 1 ? 'goal' : 'goals'}`,
  tickerAssists: (p) => `${p.n} ${p.n === 1 ? 'assist' : 'assists'}`,
  tickerInjured: 'Out injured',
  tickerNone: 'Did not play',
  judging: 'Judging',
  judgeOk: (p) => `Success ${p.pct}%`,
  judgeFail: (p) => `Failure ${p.pct}%`,
};
