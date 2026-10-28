import type { Translation } from '../core';
import type { GameMySeasonMsgs } from '../ko/gameMySeason';

export const gameMySeason: Translation<GameMySeasonMsgs> = {
  emptyOther: (p) =>
    `${p.name}還沒有退役的球員。其他賽季的${p.total}名球員可在上方的賽季分頁查看。`,
  emptyNone: '還沒有退役的球員。完成生涯直到退役後，就會顯示在這裡。',
};
