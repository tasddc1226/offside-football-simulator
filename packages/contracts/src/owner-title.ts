// T-11-150 컵 성적과 여러 시즌의 육성 이력을 담는 대표 칭호. zod 없는 공통 서브패스.
import type { CupStage } from './cup.js';

export const TITLE_STAGES = ['champion', 'runnerup', 'sf'] as const;
export type TitleStage = (typeof TITLE_STAGES)[number];
/** 'cup-1-champion' 같은 칭호 id. */
export type OwnerTitle = string;

/** 칭호를 받는 성적(우승·준우승·4강)인가. */
export const isTitleStage = (stage: string): stage is TitleStage =>
  (TITLE_STAGES as readonly string[]).includes(stage);

export const TITLE_RE = /^cup-([1-9]\d{0,3})-(champion|runnerup|sf)$/;
/** 칭호를 달지 않기로 고른 상태(대표 칭호 PUT 본문). */
export const TITLE_NONE = 'none';

export const titleIdOf = (edition: number, stage: TitleStage): OwnerTitle =>
  `cup-${edition}-${stage}`;

export function parseTitle(
  id: string | null | undefined,
): { edition: number; stage: TitleStage } | null {
  const m = id ? TITLE_RE.exec(id) : null;
  return m ? { edition: Number(m[1]), stage: m[2] as TitleStage } : null;
}

const STAGE_RANK: Record<TitleStage, number> = { champion: 0, runnerup: 1, sf: 2 };

/** 칭호 순서: 우승 > 준우승 > 4강, 같은 단계면 최근 회차 먼저. 진열장·자동 대표 칭호가 같이 쓴다. */
function compareTitles(a: OwnerTitle, b: OwnerTitle): number {
  const x = parseTitle(a);
  const y = parseTitle(b);
  if (!x || !y) return x ? -1 : y ? 1 : 0;
  return STAGE_RANK[x.stage] - STAGE_RANK[y.stage] || y.edition - x.edition;
}

/** 컵 성적에서 받은 칭호(좋은 순). 8강 이하는 칭호가 아니다. */
export function titlesOf(honors: readonly { edition: number; stage: CupStage }[]): OwnerTitle[] {
  return honors
    .flatMap((h) => (isTitleStage(h.stage) ? [titleIdOf(h.edition, h.stage)] : []))
    .sort(compareTitles);
}

/** Shared single-career feats used by seasonal achievements and lifetime title counts. */
export const CAREER_FEATS = { goals: 500, caps: 150, assists: 300, peak: 90 } as const;
export const TITLE_GRADES = ['entry', 'skilled', 'honor', 'legend'] as const;
export type TitleGrade = (typeof TITLE_GRADES)[number];

/** Grades describe challenge depth, not measured rarity. Player milestones count distinct careers; firsts count finalized honors. */
export const PERMANENT_TITLES = [
  {
    id: 'owner-founder',
    metric: 'preseason',
    target: 1,
    symbol: 'flag',
    grade: 'entry',
    related: 'preseason',
  },
  {
    id: 'owner-developer',
    metric: 'retired',
    target: 10,
    symbol: 'academy',
    grade: 'entry',
    related: 'retire',
  },
  {
    id: 'owner-star-maker',
    metric: 'elite',
    target: 3,
    symbol: 'star',
    grade: 'skilled',
    related: 'retire',
  },
  {
    id: 'owner-midfield',
    metric: 'midfield',
    target: 5,
    symbol: 'pitch',
    grade: 'honor',
    related: 'retire',
  },
  {
    id: 'owner-defense',
    metric: 'defense',
    target: 5,
    symbol: 'shield',
    grade: 'honor',
    related: 'retire',
  },
  {
    id: 'owner-keeper',
    metric: 'keeper',
    target: 5,
    symbol: 'glove',
    grade: 'legend',
    related: 'retire',
  },
  {
    id: 'owner-academy',
    metric: 'retired',
    target: 50,
    symbol: 'academy',
    grade: 'honor',
    related: 'retire',
  },
  {
    id: 'owner-goals',
    metric: 'scorers',
    target: 5,
    symbol: 'ball',
    grade: 'skilled',
    related: 'goals',
  },
  {
    id: 'owner-assists',
    metric: 'creators',
    target: 5,
    symbol: 'pitch',
    grade: 'honor',
    related: 'assists',
  },
  {
    id: 'owner-national',
    metric: 'internationals',
    target: 5,
    symbol: 'flag',
    grade: 'skilled',
    related: 'caps',
  },
  {
    id: 'owner-legend-home',
    metric: 'numbers',
    target: 3,
    symbol: 'shirt',
    grade: 'honor',
    related: 'numbers',
  },
  {
    id: 'owner-pioneer',
    metric: 'firsts',
    target: 1,
    symbol: 'flag',
    grade: 'honor',
    related: 'firsts',
  },
  {
    id: 'owner-ballon-maker',
    metric: 'ballon',
    target: 5,
    symbol: 'ball',
    grade: 'honor',
    related: 'ballon',
  },
  {
    id: 'owner-dynasty',
    metric: 'numbers',
    target: 25,
    symbol: 'shirt',
    grade: 'legend',
    related: 'numbers',
  },
] as const;
export type PermanentTitleId = (typeof PERMANENT_TITLES)[number]['id'];
export type TitleMetric = (typeof PERMANENT_TITLES)[number]['metric'];
export const TITLE_CRITERIA_VERSION = 3;
export const permanentTitleOf = (id: string | null | undefined) =>
  PERMANENT_TITLES.find((t) => t.id === id);
export const isOwnerTitle = (id: string): boolean => !!parseTitle(id) || !!permanentTitleOf(id);
