import type { Translation } from '../core';
import type { TeamDivisionMsgs } from '../ko/teamDivision';
import { plural } from './_util';

export const teamDivision: Translation<TeamDivisionMsgs> = {
  d0: 'Amateur',
  d1: 'Semi-pro II',
  d2: 'Semi-pro I',
  d3: 'Pro II',
  d4: 'Pro I',
  d5: 'Elite II',
  d6: 'Elite I',
  d7: 'Master',
  label: 'Division',
  toNext: (p) => `${p.n} pts to ${p.name}`,
  top: 'You are in the top division',
  guard: (p) => `Relegation buffer · ${p.n} more pts and you drop`,
  progressAria: (p) => `${p.name} division, ${p.pct}% to the next division`,
  promoted: (p) => `Promoted to ${p.name}!`,
  relegated: (p) => `Dropped to ${p.name}`,
  promotedBody: 'This result moved you up a division.',
  relegatedBody: 'Win your RP back to return.',
  changedAway: (p) => `A match against you moved you to ${p.name}`,
  tabAll: 'All',
  tabsAria: 'Division',
  countLine: (p) => `${p.s} ${p.n === 1 ? 'team' : 'teams'}`,
  myDivision: 'My division',
  emptyDivision: 'No teams in this division yet.',
  rewardNote: (p) =>
    `From the ${p.from} close, finishing a season in Pro II or higher earns a badge and rerolls. You need ${plural(p.matches, 'ranked match', 'ranked matches')} that season and 8 or more retired players in your lineup.`,
  rewardTitle: 'Season rewards',
  previewNote: 'This season shows divisions only, with no rewards.',
};
