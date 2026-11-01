// zod가 없는 서브패스(`@offside/contracts/card-special`) — T-11-372 시즌 특별 카드. 서버 시즌 결산(선정)과 웹 · 앱 카드 띠가 함께 쓴다.
// 설계: docs/tracking/season-special-cards-plan.md. 표식은 카드(career_id)에 영구히 붙고 능력치는 더하지 않는다(표시 전용).

/** 표식 종류(높은 것부터 — 여러 개면 카드 띠에는 첫 번째 하나만). */
export const CARD_SPECIAL_KINDS = ['mvp', 'top_scorer', 'top_assist', 'best11'] as const;
export type CardSpecialKind = (typeof CARD_SPECIAL_KINDS)[number];

/** 선정 규칙 버전. 기준이 바뀌면 올리고, 지난 시즌 표식은 다시 매기지 않는다. */
export const CARD_SPECIAL_RULE = 1;

/** 표식을 매기는 첫 시즌(프리시즌 0은 대상이 아니다). */
export const CARD_SPECIAL_FIRST_SEASON = 1;

export type CardSpecialMark = { season: number; kind: CardSpecialKind; rank: number };

/** 카드 띠에 그릴 대표 표식: 가장 최근 시즌, 같은 시즌이면 종류 순. 없으면 null. */
export function topSpecial<T extends CardSpecialMark>(
  marks: readonly T[] | null | undefined,
): T | null {
  let best: T | null = null;
  for (const m of marks ?? []) {
    if (
      !best ||
      m.season > best.season ||
      (m.season === best.season &&
        CARD_SPECIAL_KINDS.indexOf(m.kind) < CARD_SPECIAL_KINDS.indexOf(best.kind))
    )
      best = m;
  }
  return best;
}

/** 표식 목록을 띠 순서(최근 시즌 · 종류 순)로 정렬한 사본. */
export const sortSpecials = <T extends CardSpecialMark>(marks: readonly T[]): T[] =>
  [...marks].sort(
    (a, b) =>
      b.season - a.season ||
      CARD_SPECIAL_KINDS.indexOf(a.kind) - CARD_SPECIAL_KINDS.indexOf(b.kind),
  );
