// T-11-150 대표 칭호 표시 — 칭호 id('cup-3-champion')에서 회차와 단계를 읽어 문구와 트로피를 고른다.
import {
  parseTitle,
  permanentTitleOf,
  type TitleGrade,
  type TitleStage,
} from '@offside/contracts/owner-title';
import { ownerProfileText as L } from './i18n/ko/ownerProfile.js';

export {
  parseTitle,
  TITLE_NONE,
  TITLE_GRADES,
  permanentTitleOf,
} from '@offside/contracts/owner-title';

const LABEL: Record<TitleStage, (p: { n: number }) => string> = {
  champion: (p) => L.titleChampion(p),
  runnerup: (p) => L.titleRunnerup(p),
  sf: (p) => L.titleSf(p),
};

/** '제3회 챔피언'(지금 언어). 알 수 없는 id면 null. */
export function titleLabel(id: string | null | undefined): string | null {
  const t = parseTitle(id);
  const permanent = permanentTitleOf(id);
  return t
    ? LABEL[t.stage]({ n: t.edition })
    : permanent
      ? {
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
        }[permanent.id]
      : null;
}

export function titleCondition(id: string): string | null {
  const t = permanentTitleOf(id);
  return t
    ? {
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
      }[t.id]
    : null;
}

/** Shared 16 × 16 pixel art. Each filled cell is a square, with no font or stroke dependency. */
const TITLE_PIXELS = {
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
} as const;

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
export const titleIconPath = (id: string): string => PIXEL_PATHS[id] ?? '';

export const titleGradeLabel = (grade: TitleGrade): string =>
  ({ entry: L.gradeEntry, skilled: L.gradeSkilled, honor: L.gradeHonor, legend: L.gradeLegend })[
    grade
  ];
export const titleGradeNote = (grade: TitleGrade): string =>
  ({ entry: L.noteEntry, skilled: L.noteSkilled, honor: L.noteHonor, legend: L.noteLegend })[grade];
export const titleRelated = (id: string): string | null => {
  const t = permanentTitleOf(id);
  return t
    ? {
        retire: L.relatedRetire,
        goals: L.relatedGoals,
        assists: L.relatedAssists,
        caps: L.relatedCaps,
        numbers: L.relatedNumbers,
        ballon: L.relatedBallon,
        firsts: L.relatedFirsts,
      }[t.related]
    : null;
};
/** Matching metal accents on light and dark backgrounds; grade is also expressed in text. */
export const titleGradeColor = (id: string): string =>
  ({ entry: '#93A49A', skilled: '#6EAA8C', honor: '#80A8C9', legend: '#D7AF54' })[
    permanentTitleOf(id)?.grade ?? 'entry'
  ];
