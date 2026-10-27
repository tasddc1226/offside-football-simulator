// T-11-150 대표 칭호 표시 — 칭호 id('cup-3-champion')에서 회차와 단계를 읽어 문구와 트로피를 고른다.
import {
  parseTitle,
  permanentTitleOf,
  type PermanentTitleId,
  type TitleCategory,
  type TitleGrade,
  type TitleStage,
} from '@offside/contracts/owner-title';
import { divisionLabel } from './cupDivision.js';
import { ownerProfileText as L } from './i18n/ko/ownerProfile.js';

export { parseTitle, TITLE_NONE, permanentTitleOf } from '@offside/contracts/owner-title';

const LABEL: Record<TitleStage, (p: { n: number; d?: string | undefined }) => string> = {
  champion: (p) => L.titleChampion(p),
  runnerup: (p) => L.titleRunnerup(p),
  sf: (p) => L.titleSf(p),
};

/** '제3회 챔피언'(지금 언어). 알 수 없는 id면 null. */
export function titleLabel(id: string | null | undefined): string | null {
  const t = parseTitle(id);
  const permanent = permanentTitleOf(id);
  return t
    ? t.league
      ? L.titleLeagueChampion({ n: t.edition })
      : LABEL[t.stage]({ n: t.edition, d: divisionLabel(t.division) })
    : permanent
      ? (
          {
            'owner-founder': L.titleFounder,
            'owner-developer': L.titleDeveloper,
            'owner-academy': L.titleAcademy,
            'owner-star-maker': L.titleStarMaker,
            'owner-ballon-maker': L.titleBallonMaker,
            'owner-legend-home': L.titleLegendHome,
            'owner-pioneer': L.titlePioneer,
            'owner-midfield': L.titleMidfield,
            'owner-defense': L.titleDefense,
            'owner-keeper': L.titleKeeper,
            'owner-goals': L.titleGoals,
            'owner-assists': L.titleAssists,
            'owner-national': L.titleNational,
            'owner-dynasty': L.titleDynasty,
            'owner-exchange': L.titleExchange,
            'owner-youth-kingdom': L.titleYouthKingdom,
            'owner-star-factory': L.titleStarFactory,
            'owner-star-cradle': L.titleStarCradle,
            'owner-forward': L.titleForward,
            'owner-all-rounder': L.titleAllRounder,
            'owner-goal-dynasty': L.titleGoalDynasty,
            'owner-assist-dynasty': L.titleAssistDynasty,
            'owner-national-dynasty': L.titleNationalDynasty,
            'owner-ballon-dynasty': L.titleBallonDynasty,
            'owner-world': L.titleWorld,
            'owner-world-tour': L.titleWorldTour,
            'owner-exchange-master': L.titleExchangeMaster,
            'owner-cup-regular': L.titleCupRegular,
            'owner-cup-contender': L.titleCupContender,
            'owner-seasons': L.titleSeasons,
            'owner-division-elite': L.titleDivisionElite,
            'owner-division-master': L.titleDivisionMaster,
          } satisfies Record<PermanentTitleId, string>
        )[permanent.id]
      : null;
}

export function titleCondition(id: string): string | null {
  const t = permanentTitleOf(id);
  return t
    ? (
        {
          'owner-founder': L.conditionFounder,
          'owner-developer': L.conditionDeveloper,
          'owner-academy': L.conditionAcademy,
          'owner-star-maker': L.conditionStarMaker,
          'owner-ballon-maker': L.conditionBallonMaker,
          'owner-legend-home': L.conditionLegendHome,
          'owner-pioneer': L.conditionPioneer,
          'owner-midfield': L.conditionMidfield,
          'owner-defense': L.conditionDefense,
          'owner-keeper': L.conditionKeeper,
          'owner-goals': L.conditionGoals,
          'owner-assists': L.conditionAssists,
          'owner-national': L.conditionNational,
          'owner-dynasty': L.conditionDynasty,
          'owner-exchange': L.conditionExchange,
          'owner-youth-kingdom': L.conditionYouthKingdom,
          'owner-star-factory': L.conditionStarFactory,
          'owner-star-cradle': L.conditionStarCradle,
          'owner-forward': L.conditionForward,
          'owner-all-rounder': L.conditionAllRounder,
          'owner-goal-dynasty': L.conditionGoalDynasty,
          'owner-assist-dynasty': L.conditionAssistDynasty,
          'owner-national-dynasty': L.conditionNationalDynasty,
          'owner-ballon-dynasty': L.conditionBallonDynasty,
          'owner-world': L.conditionWorld,
          'owner-world-tour': L.conditionWorldTour,
          'owner-exchange-master': L.conditionExchangeMaster,
          'owner-cup-regular': L.conditionCupRegular,
          'owner-cup-contender': L.conditionCupContender,
          'owner-seasons': L.conditionSeasons,
          'owner-division-elite': L.conditionDivisionElite,
          'owner-division-master': L.conditionDivisionMaster,
        } satisfies Record<PermanentTitleId, string>
      )[t.id]
    : null;
}

/** Shared 16 × 16 pixel art. Each filled cell is a square, with no font or stroke dependency. */
const TITLE_PIXELS = {
  'owner-founder': [
    '..########..',
    '..#..####...',
    '..#..###....',
    '..#..####...',
    '..########..',
    '..#.........',
    '..#.........',
    '..#.........',
    '..#.........',
    '.###........',
    '#####.......',
    '............',
  ],
  'owner-developer': [
    '.....##.....',
    '....####....',
    '...##..##...',
    '..########..',
    '.##......##.',
    '..#.##.##.#.',
    '..#.......#.',
    '..#.##.##.#.',
    '..#.......#.',
    '..#..##...#.',
    '..#..##...#.',
    '..########..',
  ],
  'owner-star-maker': [
    '.....##.....',
    '.....##.....',
    '....####....',
    '....####....',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '..########..',
    '..###..###..',
    '.###....###.',
    '............',
  ],
  'owner-midfield': [
    '############',
    '#....##....#',
    '#....##....#',
    '#....##....#',
    '#...####...#',
    '#..##..##..#',
    '#..##..##..#',
    '#...####...#',
    '#....##....#',
    '#....##....#',
    '#....##....#',
    '############',
  ],
  'owner-defense': [
    '....####....',
    '..########..',
    '############',
    '##...##...##',
    '##...##...##',
    '##.######.##',
    '.##..##..##.',
    '.##..##..##.',
    '..##....##..',
    '...##..##...',
    '....####....',
    '.....##.....',
  ],
  'owner-keeper': [
    '.....##.....',
    '..##.##.##..',
    '..##.##.##..',
    '..##.##.####',
    '..##########',
    '..##########',
    '..##########',
    '##.########.',
    '###.######..',
    '.########...',
    '..######....',
    '..######....',
  ],
  'owner-academy': [
    '..#..##..#..',
    '..########..',
    '...######...',
    '............',
    '....####....',
    '...######...',
    '..########..',
    '.##......##.',
    '..#.##.##.#.',
    '..#..##...#.',
    '..#..##...#.',
    '..########..',
  ],
  'owner-goals': [
    '....####....',
    '..##....##..',
    '.##..##..##.',
    '.##.####.##.',
    '#..######..#',
    '#...####...#',
    '#..##..##..#',
    '#.##....##.#',
    '.###....###.',
    '.##.####.##.',
    '..##....##..',
    '....####....',
  ],
  'owner-assists': [
    '............',
    '.......##...',
    '.......###..',
    '..#########.',
    '..##########',
    '.......###..',
    '.......##...',
    '............',
    '..##........',
    '.####.......',
    '######......',
    '.####.......',
  ],
  'owner-national': [
    '..########..',
    '..########..',
    '..##.##.##..',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '..########..',
  ],
  'owner-legend-home': [
    '...##..##...',
    '..###..###..',
    '.##########.',
    '############',
    '###......###',
    '###..##..###',
    '..#..##..#..',
    '..#..##..#..',
    '..#..##..#..',
    '..#......#..',
    '..########..',
    '..########..',
  ],
  'owner-pioneer': [
    '.##.........',
    '.##########.',
    '.#########..',
    '.########...',
    '.#########..',
    '.##########.',
    '.##.........',
    '.##.........',
    '.##.........',
    '.##.........',
    '####........',
    '####........',
  ],
  'owner-ballon-maker': [
    '....####....',
    '..########..',
    '.###.##.###.',
    '.##.####.##.',
    '###.####.###',
    '##.######.##',
    '###.####.###',
    '.##########.',
    '..########..',
    '....####....',
    '...######...',
    '..########..',
  ],
  'owner-exchange': [
    '....####....',
    '...#....#...',
    '..#.####.#..',
    '..#.#..#.#..',
    '..#.####.#..',
    '...#....#...',
    '....####....',
    '.....##.....',
    '...######...',
    '..##....##..',
    '.##..##..##.',
    '.##########.',
  ],
  'owner-dynasty': [
    '.#...##...#.',
    '.##..##..##.',
    '.##########.',
    '..########..',
    '............',
    '...##..##...',
    '..###..###..',
    '.##########.',
    '###..##..###',
    '..#..##..#..',
    '..#..##..#..',
    '..########..',
  ],
  // T-11-547 새 칭호 그림. 같은 사다리의 윗 단계는 아래 TITLE_ICON_OF로 첫 단계 그림을 쓰고 등급 색으로 가른다.
  'owner-forward': [
    '............',
    '........##..',
    '.......####.',
    '......#####.',
    '.....####...',
    '....####....',
    '...####.....',
    '..####......',
    '.####.......',
    '#####.......',
    '.###...##...',
    '......####..',
  ],
  'owner-all-rounder': [
    '.....##.....',
    '....####....',
    '.....##.....',
    '............',
    '##........##',
    '###......###',
    '##........##',
    '............',
    '.....##.....',
    '....####....',
    '.....##.....',
    '............',
  ],
  'owner-world': [
    '....####....',
    '..##.##.##..',
    '.#..#..#..#.',
    '.#..#..#..#.',
    '############',
    '#...#..#...#',
    '#...#..#...#',
    '############',
    '.#..#..#..#.',
    '.#..#..#..#.',
    '..##.##.##..',
    '....####....',
  ],
  'owner-cup-regular': [
    '############',
    '#.########.#',
    '#.########.#',
    '#.########.#',
    '.##########.',
    '..########..',
    '...######...',
    '.....##.....',
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
  ],
  'owner-seasons': [
    '..#......#..',
    '############',
    '#..........#',
    '############',
    '#..#..#..#.#',
    '#..........#',
    '#..#..#..#.#',
    '#..........#',
    '#..#..#..#.#',
    '#..........#',
    '############',
    '............',
  ],
  'owner-division-elite': [
    '.....##.....',
    '....####....',
    '...##..##...',
    '..##....##..',
    '.##..##..##.',
    '##..####..##',
    '#..##..##..#',
    '..##....##..',
    '.##..##..##.',
    '##..####..##',
    '#..##..##..#',
    '...#....#...',
  ],
} as const;

/** T-11-547 윗 단계 칭호는 첫 단계 그림을 같이 쓴다. */
const TITLE_ICON_OF: Partial<Record<PermanentTitleId, keyof typeof TITLE_PIXELS>> = {
  'owner-youth-kingdom': 'owner-academy',
  'owner-star-factory': 'owner-star-maker',
  'owner-star-cradle': 'owner-star-maker',
  'owner-goal-dynasty': 'owner-goals',
  'owner-assist-dynasty': 'owner-assists',
  'owner-national-dynasty': 'owner-national',
  'owner-ballon-dynasty': 'owner-ballon-maker',
  'owner-world-tour': 'owner-world',
  'owner-exchange-master': 'owner-exchange',
  'owner-cup-contender': 'owner-cup-regular',
  'owner-division-master': 'owner-division-elite',
};

// Build once; badges in rankings/chat reuse the same compact path.
const PIXEL_PATHS = Object.fromEntries(
  Object.entries(TITLE_PIXELS).map(([id, rows]) => [
    id,
    rows
      .flatMap((row, y) =>
        [...row].flatMap((pixel, x) => (pixel === '#' ? [`M${x + 2} ${y + 2}h1v1h-1z`] : [])),
      )
      .join(''),
  ]),
);
export const titleIconPath = (id: string): string =>
  PIXEL_PATHS[TITLE_ICON_OF[id as PermanentTitleId] ?? id] ?? '';

export const titleGradeLabel = (grade: TitleGrade): string =>
  ({ entry: L.gradeEntry, skilled: L.gradeSkilled, honor: L.gradeHonor, legend: L.gradeLegend })[
    grade
  ];
export const titleRelated = (id: string): string | null => {
  const t = permanentTitleOf(id);
  return t
    ? {
        preseason: L.relatedPreseason,
        retire: L.relatedRetire,
        goals: L.relatedGoals,
        assists: L.relatedAssists,
        caps: L.relatedCaps,
        numbers: L.relatedNumbers,
        ballon: L.relatedBallon,
        firsts: L.relatedFirsts,
        exchange: L.relatedExchange,
        nations: L.relatedNations,
        cup: L.relatedCup,
        seasons: L.relatedSeasons,
        division: L.relatedDivision,
      }[t.related]
    : null;
};
export const titleCategoryLabel = (category: TitleCategory | 'trophy'): string =>
  ({
    growth: L.categoryGrowth,
    position: L.categoryPosition,
    record: L.categoryRecord,
    legacy: L.categoryLegacy,
    team: L.categoryTeam,
    trophy: L.categoryTrophy,
  })[category];
/** Matching metal accents on light and dark backgrounds; grade is also expressed in text. */
export const titleGradeColor = (id: string): string =>
  ({ entry: '#93A49A', skilled: '#6EAA8C', honor: '#80A8C9', legend: '#D7AF54' })[
    permanentTitleOf(id)?.grade ?? 'entry'
  ];
