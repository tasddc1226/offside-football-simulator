import type { Translation } from '../core';
import type { GameMySeasonMsgs } from '../ko/gameMySeason';
import { plural } from './_util';

export const gameMySeason: Translation<GameMySeasonMsgs> = {
  emptyOther: (p) =>
    `No player has retired in ${p.name} yet. You can see the ${plural(p.total, 'player')} from other seasons in the season tabs above.`,
  emptyNone: 'No players have retired yet. Once you finish a career, it shows up here.',
};
