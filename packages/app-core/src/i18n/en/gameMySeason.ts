import type { Translation } from '../core';
import type { GameMySeasonMsgs } from '../ko/gameMySeason';

export const gameMySeason: Translation<GameMySeasonMsgs> = {
  emptyOther: (p) =>
    `No player has retired in ${p.name} yet. You can see the ${p.total} player${p.total === 1 ? '' : 's'} from other seasons in the season tabs above.`,
  emptyNone: 'No players have retired yet. Once you finish a career, it shows up here.',
};
