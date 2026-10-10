// T-11-150 구단주 대표 칭호. 지금은 오프사이드 컵 성적(우승·준우승·4강)이 칭호가 된다 — id는 'cup-{회차}-{단계}'라
// 랭킹·댓글·채팅이 회차와 단계를 바로 읽어 그린다(따로 찾아보지 않는다). zod 없는 서브패스(`@offside/contracts/owner-title`).
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

/** Permanent account titles. Criteria v1 includes preseason and every service season. */
export const PERMANENT_TITLES = [
  { id: 'owner-developer', metric: 'retired', target: 10, symbol: 'academy' },
  { id: 'owner-academy', metric: 'retired', target: 50, symbol: 'academy' },
  { id: 'owner-star-maker', metric: 'elite', target: 3, symbol: 'star' },
  { id: 'owner-ballon-maker', metric: 'ballon', target: 1, symbol: 'ball' },
  { id: 'owner-legend-home', metric: 'numbers', target: 1, symbol: 'shirt' },
  { id: 'owner-pioneer', metric: 'firsts', target: 1, symbol: 'flag' },
] as const;
export type PermanentTitleId = (typeof PERMANENT_TITLES)[number]['id'];
export type TitleMetric = (typeof PERMANENT_TITLES)[number]['metric'];
export const TITLE_CRITERIA_VERSION = 1;
export const permanentTitleOf = (id: string | null | undefined) =>
  PERMANENT_TITLES.find((t) => t.id === id);
export const isOwnerTitle = (id: string): boolean => !!parseTitle(id) || !!permanentTitleOf(id);
