import type { Translation } from '../core';
import type { GameSeasonMsgs } from '../ko/gameSeason';
import { plural } from './_util';

export const gameSeason: Translation<GameSeasonMsgs> = {
  preseason: 'Preseason',
  prepTitle: 'Prepare for the next phase',
  condition: 'Condition',
  morale: 'Morale',
  fame: 'Fame',
  coachMemo: 'Coach notes',
  trainingTitle: 'Training focus',
  trainHint: 'Pick this phase’s training to move on',
  investTitle: 'Self-investment',
  funds: (p) => `Funds ${p.v}`,
  investHint: 'Pick an investment to move on · or choose no investment to save money',
  phaseFirst: 'First half',
  phaseSecond: 'Second half',
  totals: (p) =>
    `Season so far · ${p.w}W ${p.d}D ${p.l}L · ${p.apps} apps · ${p.goals} goals · ${p.col} ${p.colN} · rating ${p.rating}`,
  colCs: 'Clean sheets',
  colAssists: 'Assists',
  compsTitle: 'Competitions this season',
  compSuper: 'Single match before the season',
  compStart: 'Starts in phase 1',
  compAlive: 'in progress',
  compLine: (p) => `${p.apps} apps, ${plural(p.g, 'goal')}`,
  storiesTitle: 'Storylines in progress',
  storySoon: 'Continues soon',
  storyWait: (p) => `In about ${plural(p.n, 'phase')}`,
  feedTitle: 'Latest news',
  feedLess: 'Show less',
  feedMore: 'Show more',
  feedLessAria: 'Show less news',
  feedMoreAria: 'Show more news',
};
