import type { ClubAchievement, ClubAchievementGroup } from '@offside/contracts';
import { tenureLabels } from '../i18n/en/achievements.js';
import type { Lang } from '../lang.js';

// T-11-106 업적 문구의 영어. 판정(achievements.ts)은 한국어 문구와 id를 그대로 만들고, 응답을 보낼 때 id로 문구만
// 바꾼다 — 판정·저장·점수에 영향이 없다. 단계 업적의 단위는 숫자 바로 뒤에 붙으므로 앞에 공백을 둔다.
const GROUP: Record<string, { stage: string; title: string }> = {
  first: { stage: 'Stage 0', title: 'Where the story starts' },
  records: { stage: 'Stage 1', title: 'Building records' },
  collection: { stage: 'Stage 2', title: 'Collecting records' },
  legend: { stage: 'Stage 3', title: 'A true legend' },
  world: { stage: 'Stage 4', title: 'Conquering the world' },
  immortal: { stage: 'Stage 5', title: 'Immortal club' },
  team: { stage: 'TEAM', title: 'Your best team' },
  race: { stage: 'RACE', title: 'Season race' },
  owner: { stage: 'OWNER', title: 'Running the club' },
  manager: { stage: 'MANAGER', title: 'Manager career' },
};

const LABEL: Record<string, string> = {
  // 0단계
  'retire-FW': 'Retire a forward',
  'retire-MF': 'Retire a midfielder',
  'retire-DF': 'Retire a defender',
  'retire-GK': 'Retire a goalkeeper',
  'national-win': 'First international title',
  europe: 'First move to Europe',
  'retired-number': 'First retired number',
  poty: 'First league Player of the Year',
  ballon: "First Ballon d'Or",
  'team-win': 'First team match win',
  'all-dpos': 'Produce a player for every position',
  // 1단계
  goals: 'Goals',
  assists: 'Assists',
  apps: 'Appearances',
  caps: 'International caps',
  trophies: 'Trophies',
  awards: 'Individual awards',
  legend: 'Legend points',
  // 2단계
  'all-league-win': 'Win every league',
  'all-top-scorer': 'Top scorer in every league',
  'all-poty': 'Player of the Year in every league',
  young: 'Collect Young Player awards',
  big5: 'Play in all Big 5 leagues',
  'all-dpos-ballon': "Ballon d'Or in every position",
  // 3단계
  ...tenureLabels,
  'caps-150': '150 international caps',
  'goals-500': '500 career goals',
  'season-50': '50 goals in a season',
  'gk-cs-20': 'Goalkeeper with 20 clean sheets in a season',
  treble: 'Win a treble in a season',
  'ballon-3': "3 Ballon d'Or awards",
  // 4단계
  'world-cup': 'Win the FIFA World Cup',
  'conf-cup': 'Win a continental cup',
  olympic: 'Win Olympic gold',
  ucl: 'Win the UEFA Champions League',
  'club-wc': 'Win the FIFA Club World Cup',
  'golden-shoe': 'Win the European Golden Shoe',
  'all-continental': 'Win every continental club competition',
  nations: 'Players from 5 different nations',
  // 5단계
  'rn-11': '11 retired numbers',
  'ballon-30': "30 Ballon d'Or awards in total",
  'ballon-pos': "Ballon d'Or in all four positions",
  'world-cup-3': 'Win the World Cup 3 times',
  'ballon-10': "10 Ballon d'Or awards for one player",
  'goals-800': '800 career goals for one player',
  'legend-3000': '3,000 legend points for one player',
  // 팀
  'team-one': 'Register a player',
  'team-full': 'Fill all 11 spots without youth players',
  'team-fit': 'All 11 in their right position',
  'team-caps': 'All 11 with international caps',
  'team-club': 'All 11 from the same club',
  'team-rn': 'All 11 with retired numbers',
  'team-wins': 'Team match wins',
  'team-streak': 'Longest winning streak',
  'team-margin': 'Win by 5 or more goals',
  'team-goals': 'Team goals',
  'team-rating': 'Team rating',
  'team-likes': 'Likes received',
  // 구단주
  'owner-nickname': 'Set a public nickname',
  'owner-players': 'Players retired',
  'owner-retire-days': 'Days you retired a player',
  'owner-match-days': 'Days you played team matches',
  'owner-likes': 'Likes given to other teams',
};

/** 단계 업적의 단위(숫자 바로 뒤에 붙는다). */
const UNIT: Record<string, string> = {
  goals: ' goals',
  assists: ' assists',
  apps: ' matches',
  caps: ' caps',
  trophies: ' trophies',
  awards: ' awards',
  legend: ' pts',
  'team-wins': ' wins',
  'team-streak': ' in a row',
  'team-goals': ' goals',
  'team-rating': ' pts',
  'team-likes': ' likes',
  'owner-players': ' players',
  'owner-retire-days': ' days',
  'owner-match-days': ' days',
  'owner-likes': ' likes',
};

function itemEn(i: ClubAchievement): ClubAchievement {
  // '○○세까지 현역'은 시즌마다 나이가 달라 한국어 문구의 숫자를 그대로 쓴다.
  const label =
    i.id === 'age-40'
      ? `Still playing at ${/\d+/.exec(i.label)?.[0] ?? ''}`
      : (LABEL[i.id] ?? i.label);
  return { ...i, label, ...(i.unit !== undefined ? { unit: UNIT[i.id] ?? i.unit } : {}) };
}

/** 응답 직전에 업적 문구를 영어로 바꾼다. 한국어면 그대로 돌려준다. */
export function localizeAchievements(
  groups: ClubAchievementGroup[],
  lang: Lang,
): ClubAchievementGroup[] {
  if (lang !== 'en') return groups;
  return groups.map((g) => ({
    ...g,
    ...(GROUP[g.id] ?? {}),
    items: g.items.map(itemEn),
  }));
}
