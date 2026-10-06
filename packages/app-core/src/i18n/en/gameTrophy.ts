import type { Translation } from '../core';
import type { GameTrophyMsgs } from '../ko/gameTrophy';
import { ordinal } from './_util';

export const gameTrophy: Translation<GameTrophyMsgs> = {
  empty: 'None yet.',
  honours: 'Team honors',
  individual: 'Individual awards',
  ballon: "Ballon d'Or ranking",
  ballonWon: 'Winner',
  ballonRank: (p) => ordinal(p.n),
  nominees: '30-player shortlist',
  stories: 'Completed storylines',
};
