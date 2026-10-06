import type { Translation } from '../core';
import type { FirstsTabMsgs } from '../ko/firstsTab';

export const firstsTab: Translation<FirstsTabMsgs> = {
  tabRecent: 'Latest',
  tabRecords: 'Server records',
  tabTotal: 'Career',
  tabSeason: 'Season',
  tabHonor: 'Awards and trophies',
  unit: (p) =>
    ({ 골: ' goals', 도움: ' assists', 경기: ' matches', 개: '', 회: ' times' })[p.u] ?? p.u,
};
