import type { Translation } from '../core';
import type { GameReportMsgs } from '../ko/gameReport';
import { plural } from './_util';

export const gameReport: Translation<GameReportMsgs> = {
  tallyApps: 'Apps',
  tallyGoals: 'Goals',
  tallyCs: 'Clean sheets',
  tallyAssists: 'Assists',
  tallyRating: 'Rating',
  teamRank: (p) => `Team rank ${p.n}`,
  dotsLabel: (p) =>
    `Results: ${plural(p.w, 'win')}, ${plural(p.d, 'draw')}, ${plural(p.l, 'loss', 'losses')}`,
  win: 'W',
  draw: 'D',
  loss: 'L',
  expectedRole: 'Expected role:',
  cups: 'Cups and continental',
  notCalled: 'You were left out of this national team squad.',
  changes: 'Changes',
  noChange: 'No big changes',
  gamesSummary: (p) => `Match log, ${p.n} match${p.n === 1 ? '' : 'es'}`,
};
