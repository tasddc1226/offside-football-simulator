import type { Translation } from '../core';
import type { RetiredMsgs } from '../ko/retired';

export const retired: Translation<RetiredMsgs> = {
  newCareer: 'Kick off a new career →',
  myClub: 'Build your club',
  seeHof: 'View the Hall of Fame',
  play: 'Replay career',
  stop: 'Stop',
  cohortTitle: (p) => `Among ${p.n} ${p.pos} players who retired in Season ${p.season}`,
  cohortTop: (p) => `Top ${p.pct}%`,
  cohortNote: 'Records are gathered once a day.',
  cohortScore: 'Legend score',
  cohortPeak: 'Peak OVR',
  cohortApps: 'Career apps',
  cohortGoals: 'Career goals',
  cohortAssists: 'Career assists',
  cohortTrophies: 'Trophies',
  cohortCaps: 'Caps',
  cohortBallon: "Ballon d'Or",
};
