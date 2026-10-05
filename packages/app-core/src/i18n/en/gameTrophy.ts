import type { Translation } from '../core';
import type { GameTrophyMsgs } from '../ko/gameTrophy';

export const gameTrophy: Translation<GameTrophyMsgs> = {
  empty: 'None yet.',
  honours: 'Team honours',
  individual: 'Individual awards',
  ballon: "Ballon d'Or ranking",
  ballonWon: 'Winner',
  ballonRank: (p) =>
    `${p.n}${p.n % 10 === 1 && p.n !== 11 ? 'st' : p.n % 10 === 2 && p.n !== 12 ? 'nd' : p.n % 10 === 3 && p.n !== 13 ? 'rd' : 'th'}`,
  nominees: '30-player shortlist',
  stories: 'Completed storylines',
};
