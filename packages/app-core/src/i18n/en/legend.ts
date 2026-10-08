import type { Translation } from '../core';
import type { LegendMsgs } from '../ko/legend';
import { plural } from './_util';

export const legend: Translation<LegendMsgs> = {
  reportLabel: (p) => `${p.name}: career review`,
  retiredAge: (p) => `Retired at ${p.age}`,
  scoreLabel: (p) => `Legend Score ${p.score}`,
  worth: 'Retirement value',
  clubsLabel: 'Clubs',
  peakValue: (p) => `Peak value ${p.value} · ${p.season} ${p.club}`,
  peakOvr: (p) => `Peak OVR ${p.peak}`,
  rnPillTitle: (p) => `${p.club} retired No. ${p.number}`,
  rnPill: (p) => `👑 ${p.club} retired No. ${p.number}`,
  statsLabel: 'Career totals',
  statSeasons: 'Seasons',
  statApps: 'Apps',
  statCleanSheets: 'Clean sheets',
  statGaPoints: 'G+A',
  statGoals: 'Goals',
  statAssists: 'Assists',
  statCaps: 'Caps',
  statTrophies: 'Trophies',
  statBallon: "Ballon d'Or wins",
  noDetailNote:
    'This is an older record without season-by-season detail, so only a summary is shown.',
  scrollCue: 'Scroll to look back on your career',
  journeyTitle: 'Club by club',
  chapterMeta: (p) =>
    `${p.leagues} · ${p.ageFrom === p.ageTo ? `age ${p.ageFrom}` : `ages ${p.ageFrom}–${p.ageTo}`} · ${plural(p.seasons, 'season')}`,
  valueTitle: 'Value over time',
  nationalTitle: 'International career',
  natGa: (p) => `${plural(p.goals, 'goal')} · ${plural(p.assists, 'assist')}`,
  honoursTitle: 'Honors',
  potTitle: 'Potential rating at retirement',
  potLine: (p) => `Potential ${p.value} · recorded at retirement`,
  peakOvrLabel: 'Peak OVR',
  finaleLine1: (p) => `${p.club}, age ${p.age}`,
  finaleLine2: 'The final whistle blew.',
  thanks: (p) => `Well played, ${p.name}`,
  moreSummary: 'Season records and Legend Score breakdown',
  breakdownTitle: 'Legend Score breakdown',
  breakdownNote:
    'Position-based contribution (goals and assists for forwards and midfielders, mostly clean sheets for defenders and goalkeepers) + appearances · honors · individual awards · caps · peak OVR · Ballon d’Or/World Cup bonus',
};
