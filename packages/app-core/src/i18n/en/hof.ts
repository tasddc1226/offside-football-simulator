import type { Translation } from '../core';
import type { HofMsgs } from '../ko/hof';

const ord = (n: number) => {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

export const hof: Translation<HofMsgs> = {
  tabsLabel: 'Records',
  tabLegends: 'Hall of Fame',
  tabRn: 'Retired numbers',
  tabTeams: 'Team ranking',
  tabAch: 'Owner ranking',
  title: 'Hall of Fame',
  seeAll: 'See all',
  sortScore: 'Legend Score',
  sortValue: 'Retirement value',
  sortGoals: 'Goals',
  sortAssists: 'Assists',
  sortGa: 'Goal contributions',
  sortApps: 'Appearances',
  sortTrophies: 'Trophies',
  sortAwards: 'Individual awards',
  sortBallon: 'Ballon d’Or',
  sortCaps: 'Caps',
  sortPeak: 'Peak OVR',
  unitGoals: ' goals',
  unitAssists: ' assists',
  unitPoints: ' pts',
  unitGames: ' apps',
  unitCount: ' trophies',
  unitTimes: '×',
  season: 'Season',
  seasonAria: 'Record season',
  allSeasons: 'All seasons',
  notOpen: ' (opens soon)',
  filter: 'Filter',
  filterLabel: (p) => `Filter, ${p.pos}, ${p.sort}`,
  filterA11y: (p) => `Filter, ${p.label}`,
  allPositions: 'All positions',
  searchLabel: 'Search player name',
  positionGroup: 'Position',
  all: 'All',
  rankBasis: 'Rank by',
  sortGroup: 'Ranking type',
  opens: (p) => `${p.name} opens ${p.when} (Korea time).`,
  opensNote:
    "Players created after the opening appear here once they retire. Players created now (preseason) stay in the 'Preseason' and 'All' halls of fame.",
  loading: 'Loading…',
  loadFailed: "Couldn't load the Hall of Fame. Please try again in a moment.",
  source: (p) =>
    `${p.scope && `${p.scope}· `}${p.q ? `'${p.q}' search · ` : ''}${p.isScore ? 'Retired players' : `Players with ${p.sort} records`}: ${p.total} · by ${p.sort}`,
  homeSource: (p) => `${p.season} · by Legend Score`,
  listHead: 'Player',
  emptyQuery: (p) => `No ${p.scope}players with '${p.q}' in their name.`,
  emptyScore: (p) => `No ${p.scope}retired players yet.`,
  emptySort: (p) => `No ${p.scope}retired players with ${p.sort} records yet.`,
  pagerLabel: 'Hall of Fame pages',
  prev: '← Previous',
  next: 'Next →',
  mine: 'Your player',
  rankN: (p) => ord(p.rank),
  podiumLabel: (p) => `Top 3 by ${p.label}`,
  podiumPlayer: (p) =>
    `${ord(p.rank)}, ${p.name}, ${p.country}, ${p.label} ${p.value}${p.unit}, view full record`,
  podiumPlayerApp: (p) =>
    `${ord(p.rank)}, ${p.name}, ${p.country}${p.pos ? `, ${p.pos}` : ''}, ${p.value}${p.unit}${p.mine ? ', your player' : ''}`,
  rnChipTitle: (p) => `Retired No. ${p.number}`,
  rnChip: (p) => `👑 Retired ${p.number}`,
  rowStats: (p) =>
    `${p.apps} apps ${p.goals} goals ${p.assists} assists · trophies ${p.trophies} · peak OVR ${p.peak}${p.ballon ? ` · Ballon d’Or ×${p.ballon}` : ''}${p.score != null ? ` · Legend ${p.score}` : ''}`,
  appsN: (p) => `${p.n} apps`,
  goalsN: (p) => `${p.n} goals`,
  assistsN: (p) => `${p.n} assists`,
};
