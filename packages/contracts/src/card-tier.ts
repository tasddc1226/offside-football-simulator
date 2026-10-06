// zod가 없는 서브패스(`@offside/contracts/card-tier`) — 웹 · 앱 카드 색과 서버 시즌 결산(등급별 카드 수)이 함께 쓴다.
/**
 * 선수 카드 등급(카드 색). 레전드 점수로 정하는 두 특별 등급이 먼저, 나머지는 최고 OVR 구간으로 정한다.
 * - 아이콘: 레전드 점수 1,800 이상(은퇴 등급 '역대 최고의 전설'의 시즌 1 기준). 시즌 1 카드의 약 2%.
 * - 레전드: 1,100 이상('월드클래스 레전드' 기준). 약 14%.
 * - 엘리트 85+ · 골드 75–84 · 실버 65–74 · 브론즈 64 이하. 근거: 2026-10-07 운영 카드 분포(시즌 1 8,693장).
 * 프리시즌 카드도 같은 점수 기준을 쓴다 — 프리시즌 은퇴 등급표(preMin)로 가르면 프리시즌 카드의 19%가 아이콘이 된다.
 */
/** 높은 등급부터. */
export const CARD_TIERS = ['icon', 'legend', 'elite', 'gold', 'silver', 'bronze'] as const;
export type CardTier = (typeof CARD_TIERS)[number];
export const CARD_ICON_SCORE = 1800;
export const CARD_LEGEND_SCORE = 1100;
export const CARD_ELITE_PEAK = 85;
export const CARD_GOLD_PEAK = 75;
export const CARD_SILVER_PEAK = 65;
export const cardTier = (legendScore: number | null | undefined, peak: number): CardTier => {
  const score = legendScore ?? 0;
  if (score >= CARD_ICON_SCORE) return 'icon';
  if (score >= CARD_LEGEND_SCORE) return 'legend';
  return peak >= CARD_ELITE_PEAK
    ? 'elite'
    : peak >= CARD_GOLD_PEAK
      ? 'gold'
      : peak >= CARD_SILVER_PEAK
        ? 'silver'
        : 'bronze';
};
/** 레전드 점수로 오른 특별 등급(아이콘 · 레전드)인지. */
export const isLegendTier = (tier: string): boolean => tier === 'icon' || tier === 'legend';
