import type { Translation } from '../core';
import type { GameReportMsgs } from '../ko/gameReport';

export const gameReport: Translation<GameReportMsgs> = {
  tallyApps: 'Apps',
  tallyGoals: 'Goals',
  tallyCs: 'Clean sheets',
  tallyAssists: 'Assists',
  tallyRating: 'Rating',
  teamRank: (p) => `Team rank ${p.n}`,
  dotsLabel: (p) => `Results: ${p.w} wins, ${p.d} draws, ${p.l} losses`,
  win: 'W',
  draw: 'D',
  loss: 'L',
  expectedRole: 'Expected role:',
  cups: 'Cups and continental',
  notCalled: 'You were left out of this international squad.',
  changes: 'Changes',
  noChange: 'No big changes',
  gamesSummary: (p) => `Match by match, ${p.n} match${p.n === 1 ? '' : 'es'}`,
};
