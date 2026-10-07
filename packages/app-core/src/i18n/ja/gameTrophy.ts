import type { Translation } from '../core';
import type { GameTrophyMsgs } from '../ko/gameTrophy';

export const gameTrophy: Translation<GameTrophyMsgs> = {
  empty: 'まだありません。',
  honours: '優勝歴',
  individual: '個人タイトル',
  ballon: 'バロンドール順位',
  ballonWon: '受賞',
  ballonRank: (p) => `${p.n}位`,
  nominees: '候補30人',
  stories: '完結したストーリー',
};
