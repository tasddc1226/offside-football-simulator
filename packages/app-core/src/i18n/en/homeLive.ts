import type { Translation } from '../core';
import type { HomeLiveMsgs } from '../ko/homeLive';

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

export const homeLive: Translation<HomeLiveMsgs> = {
  title: 'Right now on OFFSIDE',
  statPlaying: 'Playing now',
  statSeasons: 'Seasons played today',
  statNew: 'New players today',
  statRetired: 'Retired today',
  pause: 'Pause the feed',
  pauseTitle: 'Pause',
  resumeTitle: 'Resume',
  failed: "Couldn't load the live feed. We'll check again shortly.",
  whatRetire: (p) => `Retired · legend score ${p.score}`,
  whatFirst: (p) => `Finished a first season at ${p.club}`,
  whatHonor: (p) => `${p.honor} · ${p.club}`,
  whatCleanSheets: (p) =>
    `${p.club} season: ${n(p.cs, 'clean sheet', 'clean sheets')} in ${n(p.apps, 'match', 'matches')}`,
  whatGoals: (p) =>
    `${p.club} season: ${n(p.goals, 'goal', 'goals')}, ${n(p.assists, 'assist', 'assists')}`,
};
