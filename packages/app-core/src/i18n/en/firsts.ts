import type { Translation } from '../core';
import type { FirstsMsgs } from '../ko/firsts';

export const firsts: Translation<FirstsMsgs> = {
  title: 'Server firsts',
  introRecords: (p) =>
    `${p.records ? 'These are the highest records among all players. If someone beats one, it changes hands.' : 'Only the first record set by any player is kept.'} Names show only for players who made their name public in the Hall of Fame.`,
  seasonLabel: 'Season',
  tabsLabel: 'Record category',
  loadFailed: "Couldn't load the server firsts. Please try again in a moment.",
  loading: 'Loading…',
  empty: 'No server firsts have been set yet.',
  noRecord: 'No record yet',
  locked: 'Not achieved',
  mine: 'Your player',
};
