// T-11-150 구단주 대표 칭호. 지금은 오프사이드 컵 성적(우승·준우승·4강)이 칭호가 된다 — id는 'cup-{회차}-{단계}'라
// 랭킹·댓글·채팅이 회차와 단계를 바로 읽어 그린다(따로 찾아보지 않는다). zod 없는 서브패스(`@offside/contracts/owner-title`).
import type { CupStage } from './cup.js';

export const TITLE_STAGES = ['champion', 'runnerup', 'sf'] as const;
export type TitleStage = (typeof TITLE_STAGES)[number];
/** 'cup-1-champion' 같은 칭호 id. */
export type OwnerTitle = string;

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
export function compareTitles(a: OwnerTitle, b: OwnerTitle): number {
  const x = parseTitle(a);
  const y = parseTitle(b);
  if (!x || !y) return x ? -1 : y ? 1 : 0;
  return STAGE_RANK[x.stage] - STAGE_RANK[y.stage] || y.edition - x.edition;
}

/** 컵 성적에서 받은 칭호(좋은 순). 8강 이하는 칭호가 아니다. */
export function titlesOf(honors: readonly { edition: number; stage: CupStage }[]): OwnerTitle[] {
  return honors
    .filter((h): h is { edition: number; stage: TitleStage } =>
      (TITLE_STAGES as readonly string[]).includes(h.stage),
    )
    .map((h) => titleIdOf(h.edition, h.stage))
    .sort(compareTitles);
}
