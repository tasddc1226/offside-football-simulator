import type { Translation } from '../core';
import type { GameTrophyMsgs } from '../ko/gameTrophy';

export const gameTrophy: Translation<GameTrophyMsgs> = {
  empty: '還沒有。',
  honours: '冠軍紀錄',
  individual: '個人獎項',
  ballon: '金球獎排名',
  ballonWon: '得獎',
  ballonRank: (p) => `第${p.n}名`,
  nominees: '30人候選名單',
  stories: '已完結的劇情',
};
