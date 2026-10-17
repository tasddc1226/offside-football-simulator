import type { Translation } from '../core';
import type { FirstGuideMsgs } from '../ko/firstGuide';

export const firstGuide: Translation<FirstGuideMsgs> = {
  title: 'Getting started',
  close: 'Close',
  closeAria: 'Close getting started',
  typesTitle: 'Positions and types',
  typesBody: (p) =>
    `Your type comes from the ${p.n} focus attributes you pick when creating a player. The type guide lists each combination and the team synergies each type fits.`,
  typesGo: 'Type guide',
  shopTitle: 'Rerolls · scout tickets · boost tickets',
  shopBody:
    "Buy them in the shop on the My club screen. Use rerolls and scout tickets when picking a new player, and boost tickets on the Player tab's potential boost.",
  shopGo: 'Go to shop',
  guideTitle: 'Retired numbers · retirement',
  guideBody: 'The game guide covers retired number rules, retirement age and the Hall of Fame.',
  guideGo: 'Game guide',
  itemsTitle: 'Scout and boost tickets are here',
  itemsBody:
    'Rerolls, premium scout tickets and boost tickets are in the shop on the My club screen. Items bought with club funds are sold on web and app; paid items are sold in the app.',
  itemsCloseAria: 'Close shop location tip',
  typeDex: 'Player type guide',
};
