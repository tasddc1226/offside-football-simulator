import type { Translation } from '../core';
import type { LegendMsgs } from '../ko/legend';

export const legend: Translation<LegendMsgs> = {
  reportLabel: (p) => `${p.name}: career review`,
  retiredAge: (p) => `Retired at ${p.age}`,
  scoreLabel: (p) => `Legend Score ${p.score}`,
  worth: 'Retirement value',
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
  noDetailNote:
    'This is an older record without season-by-season detail, so only a summary is shown.',
  scrollCue: 'Scroll to look back on the career',
  journeyTitle: 'Club by club',
  chapterMeta: (p) =>
    `${p.leagues} · ${p.ageFrom === p.ageTo ? `age ${p.ageFrom}` : `ages ${p.ageFrom}–${p.ageTo}`} · ${p.seasons} season${p.seasons === 1 ? '' : 's'}`,
  valueTitle: 'Market value',
  nationalTitle: 'International career',
  natGa: (p) =>
    `${p.goals} goal${p.goals === 1 ? '' : 's'} · ${p.assists} assist${p.assists === 1 ? '' : 's'}`,
  honoursTitle: 'Honours',
  potTitle: 'Potential rating at retirement',
  potLine: (p) => `Potential ${p.value} · recorded at retirement`,
  peakOvrLabel: 'Peak OVR',
  finaleLine1: (p) => `At ${p.age}, at ${p.club},`,
  finaleLine2: 'the final whistle blew.',
  thanks: (p) => `Well played, ${p.name}`,
  moreSummary: 'Season records and Legend Score breakdown',
  breakdownTitle: 'Legend Score breakdown',
  breakdownNote:
    'Position-based contribution (goals and assists for forwards and midfielders, mostly clean sheets for defenders and goalkeepers) + appearances · honours · individual awards · caps · peak OVR · Ballon d’Or/World Cup bonus',
};
