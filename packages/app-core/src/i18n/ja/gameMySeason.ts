import type { Translation } from '../core';
import type { GameMySeasonMsgs } from '../ko/gameMySeason';

export const gameMySeason: Translation<GameMySeasonMsgs> = {
  emptyOther: (p) =>
    `${p.name}に引退した選手はまだいません。ほかのシーズンの選手${p.total}人は上のシーズンタブで見られます。`,
  emptyNone: 'まだ引退した選手はいません。キャリアを引退まで終えると、ここに表示されます。',
};
