import type { Translation } from '../core';
import type { HomeLiveMsgs } from '../ko/homeLive';
import { plural } from './_util';

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
  whatRetire: (p) => `Retired · Legend Score ${p.score}`,
  whatFirst: (p) => `Finished a first season at ${p.club}`,
  whatHonor: (p) => `${p.honor} · ${p.club}`,
  whatCleanSheets: (p) =>
    `${p.club} season: ${plural(p.cs, 'clean sheet')} in ${plural(p.apps, 'match', 'matches')}`,
  whatGoals: (p) => `${p.club} season: ${plural(p.goals, 'goal')}, ${plural(p.assists, 'assist')}`,
  attrsNone: 'No attribute record',
  attrsEstimated: 'Estimated attributes',
  baseValue: (p) => `Base value ${p.value}`,
  agoNow: 'just now',
  agoMin: (p) => `${p.n} min ago`,
  agoHour: (p) => `${plural(p.n, 'hour')} ago`,
  agoYesterday: 'yesterday',
  agoDay: (p) => `${plural(p.n, 'day')} ago`,
};
