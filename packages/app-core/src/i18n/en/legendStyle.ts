import type { Translation } from '../core';
import type { LegendStyleMsgs } from '../ko/legendStyle';

export const legendStyle: Translation<LegendStyleMsgs> = {
  title: 'Play style',
  bets: 'Risky choices',
  betsSmall: (p) => `${p.wins} won · ${p.pct}%`,
  luck: 'Luck',
  luckUp: (p) => `${p.n} more win${p.n === 1 ? '' : 's'} than expected`,
  luckDown: (p) => `${p.n} fewer win${p.n === 1 ? '' : 's'} than expected`,
  luckEven: 'Exactly as expected',
  longshots: 'Long shots (40% or less)',
  longshotsSmall: (p) => `${p.n} landed`,
  moves: 'Transfers',
  movesSmall: (p) =>
    `${p.tierUp ? `${p.tierUp} up to a higher league` : '—'}${p.snubUp ? ` · ${p.snubUp} big-club offer${p.snubUp === 1 ? '' : 's'} turned down` : ''}`,
  bestLabel: 'Best gamble of your career',
  bestBefore: 'A ',
  bestAfter: (p) => ` chance, and you pulled off ‘${p.title}’.`,
  choices: (p) =>
    `Based on ${p.choices} choice${p.choices === 1 ? '' : 's'}${p.since ? ` · records from age ${p.since}` : ''}`,
};
