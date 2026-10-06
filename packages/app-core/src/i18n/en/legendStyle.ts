import type { Translation } from '../core';
import type { LegendStyleMsgs } from '../ko/legendStyle';
import { plural } from './_util';

export const legendStyle: Translation<LegendStyleMsgs> = {
  title: 'Play style',
  bets: 'Risky choices',
  betsSmall: (p) => `${p.wins} won · ${p.pct}%`,
  luck: 'Luck',
  luckUp: (p) => `${plural(p.n, 'more win')} than expected`,
  luckDown: (p) => `${plural(p.n, 'fewer win')} than expected`,
  luckEven: 'Exactly as expected',
  longshots: 'Long shots (40% or less)',
  longshotsSmall: (p) => `${p.n} landed`,
  moves: 'Transfers',
  movesSmall: (p) =>
    `${p.tierUp ? `${plural(p.tierUp, 'move')} up a league` : '—'}${p.snubUp ? ` · ${plural(p.snubUp, 'big-club offer')} turned down` : ''}`,
  bestLabel: 'Best gamble of your career',
  bestBefore: 'A ',
  bestAfter: (p) => ` chance, and you pulled off ‘${p.title}’.`,
  choices: (p) =>
    `Based on ${plural(p.choices, 'choice')}${p.since ? ` · records from age ${p.since}` : ''}`,
};
