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
  trainHint: 'Pick training for this phase to move on',
  investTitle: 'Self-investment',
  funds: (p) => `Funds ${p.v}`,
  fundsAfter: (p) => `Funds ${p.v} → ${p.after}`,
  investHint: 'Pick an investment to move on. Choose none to save money',
  phaseFirst: 'First half',
  phaseSecond: 'Second half',
  totals: (p) =>
    `Season so far · ${p.w}W ${p.d}D ${p.l}L · ${p.apps} apps · ${p.goals} goals · ${p.col} ${p.colN} · rating ${p.rating}`,
  colCs: 'Clean sheets',
  colAssists: 'Assists',
  compsTitle: 'Competitions this season',
  compSuper: 'One-off match before the season',
  compStart: 'Starts in phase 1',
  compAlive: 'In progress',
  compLine: (p) => `${plural(p.apps, 'app')}, ${plural(p.g, 'goal')}`,
  storiesTitle: 'Storylines in progress',
  storySoon: 'Continues soon',
  storyWait: (p) => `In about ${plural(p.n, 'phase')}`,
  feedTitle: 'Latest news',
  feedLessAria: 'Show less news',
  feedMoreAria: 'Show more news',
};
