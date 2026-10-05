import type { Translation } from '../core';
import type { TitleMsgs } from '../ko/title';

export const title: Translation<TitleMsgs> = {
  newTitles: 'New titles',
  tagLabel: (p) => `Title ${p.name} (${p.rarity})`,
  itemLabel: (p) => `Title ${p.name} (${p.rarity}), ${p.desc}`,
  dexTitle: 'Title collection',
  mainTitle: 'Main title',
  selManual: 'Chosen by you',
  selAuto: 'Auto',
  pickHint:
    'Tap a title to make it your main title. It shows on your player card and in the Hall of Fame.',
  earlier: 'Earlier record',
  emptyEarned: 'No titles yet. Your pro debut is the first one.',
  lockedSummary: (p) => `${p.n} title${p.n === 1 ? '' : 's'} not earned yet`,
  hiddenDesc: 'Hidden title',
  progressLabel: (p) => `${p.name} progress`,
  pickChanged: (p) => `Main title changed: ${p.name}`,
  none: 'None',
  pickOpen: (p) => `Change it from ${p.n} earned titles`,
  pickNote: 'Your chosen title shows on your player card, in the Hall of Fame and on share links.',
};
