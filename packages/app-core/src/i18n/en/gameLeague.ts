import type { Translation } from '../core';
import type { GameLeagueMsgs } from '../ko/gameLeague';

export const gameLeague: Translation<GameLeagueMsgs> = {
  title: (p) => `${p.league} table`,
  fold: 'Show less',
  expand: 'Full table',
  foldAria: 'Collapse the table',
  expandAria: 'Show the full table',
  colTeam: 'Team',
  colPlayed: 'P',
  colPts: 'Pts',
  rowLabel: (p) =>
    `${p.rank}. ${p.name}, ${p.played} played, ${p.w} won, ${p.d} drawn, ${p.l} lost, ${p.pts} points${p.me ? ', your team' : ''}`,
  empty: (p) => `The ${p.n}-team table fills in once the season starts.`,
};
