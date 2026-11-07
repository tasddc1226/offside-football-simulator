// T-11-373 카드 강화(docs/tracking/card-enhance-plan.md, 2026-10-30 다시 짬). 은퇴 카드를 +1~+10까지 올린다. zod가 없는
// 서브패스(`@offside/contracts/card-enhance`)라 웹 · 앱 · 서버가 같은 표로 확률 · 비용 · 효과를 그린다. 판정은 서버만 한다.
// - 효과: 단계마다 정수 강화 OVR(ENHANCE_OVR). 자리 실력 · 팀 OVR · 경기 · 급여 · 컵 구간이 같은 값을 쓴다. 커리어 최고 OVR
//   (레전드 점수 · 명예의 전당 · BEST 11 · 기준가)은 바꾸지 않는다.
// - 결과는 셋이다: 성공(+1) · 유지(그대로) · 실패(-1, +0에서는 내려가지 않는다). 천장은 없다(확률은 몇 번을 실패해도 그대로다).
// 표의 모양은 여기에 고정하고, 운영 도구에서는 열기 · 비용 · 확률 배율(balance-spec enhance*)만 바꾼다.

import { priceBand } from './market-value.js';

/** 가장 높은 단계. */
export const ENHANCE_MAX = 10;

/** 지금 단계(0~9)에서 한 단계 올리는 시도의 기본 성공 확률. */
export const ENHANCE_RATES = [0.9, 0.75, 0.6, 0.45, 0.3, 0.25, 0.2, 0.15, 0.1, 0.1] as const;

/** 지금 단계(0~9)에서 실패해 한 단계 내려갈 확률. 성공도 실패도 아닌 나머지가 유지다. */
export const ENHANCE_DOWN_RATES = [0, 0.05, 0.1, 0.15, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2] as const;

/** 지금 단계(0~9)에서 한 번 시도하는 비용(만 원). 10억 · 20억 · 40억 · 70억 · 100억 · 150억 · 200억 · 300억 · 500억 · 1000억. */
export const ENHANCE_COSTS = [
  100_000, 200_000, 400_000, 700_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000,
  10_000_000,
] as const;

/** 단계(0~10)별 강화 OVR. 성공하면 단계마다 +1(상한 +10). 자리 실력에 그대로 더한다. */
export const ENHANCE_OVR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** 운영 도구 밸런스 설정에서 읽는 강화 수치(resolveBalance의 enhance* 키). */
export type EnhanceRules = {
  /** 강화 시도를 받는가(0이면 닫힘 — 이미 올린 단계의 효과는 그대로다). */
  open: boolean;
  costScale: number;
  rateScale: number;
};

export const DEFAULT_ENHANCE_RULES: EnhanceRules = {
  open: false,
  costScale: 1,
  rateScale: 1,
};

/**
 * 최고 OVR로 나뉜 강화 구간. 은퇴 때 정해져 바뀌지 않는다. 레전드 점수로 나누면 일찍 은퇴할수록 강화가 쉬워지고
 * 오래 뛸수록 손해라서 카드 전력 자체인 최고 OVR을 쓴다(2026-11-04).
 */
export const ENHANCE_HIGH_PEAK = 90;
export const ENHANCE_TOP_PEAK = 95;
export const ENHANCE_TIERS = ['normal', 'high', 'top'] as const;
export type EnhanceTier = (typeof ENHANCE_TIERS)[number];
/** 구간별 성공 확률 배율. 높은 등급일수록 잘 붙지 않아 좋은 카드만 앞서가지 않게 한다. */
export const ENHANCE_TIER_SCALE: Record<EnhanceTier, number> = {
  normal: 1,
  high: 0.9,
  top: 0.8,
};
export const enhanceTierOf = (peak: number | null | undefined): EnhanceTier => {
  const ovr = peak ?? 0;
  return ovr >= ENHANCE_TOP_PEAK ? 'top' : ovr >= ENHANCE_HIGH_PEAK ? 'high' : 'normal';
};
/** 그 구간의 판정에 쓰는 수치(운영 배율에 구간 배율을 곱한다). 화면과 서버가 같이 쓴다. */
export const enhanceTierRules = <R extends { rateScale: number }>(r: R, tier: EnhanceTier): R => ({
  ...r,
  rateScale: r.rateScale * ENHANCE_TIER_SCALE[tier],
});

/** 0~10 정수로(옛 응답 · 잘못된 값은 0). */
export const enhanceLevel = (v: unknown): number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 ? Math.min(v, ENHANCE_MAX) : 0;

/** 그 단계의 강화 OVR. */
export const enhanceOvr = (level: unknown): number => ENHANCE_OVR[enhanceLevel(level)] ?? 0;

/** 커리어 최고 OVR에 강화 OVR을 더한 값(구단주 팀 전력 · 급여에 쓴다). */
export const enhancedPeak = (card: { peak: number; enhance?: number | null | undefined }) =>
  card.peak + enhanceOvr(card.enhance);

/**
 * 지금 단계에서 다음 시도의 성공 확률(만분율 정수, 100% = 10000). 화면에 보이는 정수 퍼센트와 서버 판정이 같도록 퍼센트 단위로
 * 자른다. +10이면 0.
 */
export function enhanceRateBp(level: number, r: Pick<EnhanceRules, 'rateScale'>) {
  const base = ENHANCE_RATES[level];
  if (base === undefined) return 0;
  return Math.min(100, Math.max(1, Math.round(base * r.rateScale * 100))) * 100;
}

/** 지금 단계에서 한 번 시도하는 비용(만 원, 100 단위). +10이면 null. */
export function enhanceCost(level: number, r: Pick<EnhanceRules, 'costScale'>): number | null {
  const base = ENHANCE_COSTS[level];
  return base === undefined ? null : Math.max(100, Math.round((base * r.costScale) / 100) * 100);
}

/**
 * 지금 단계에서 실패해 내려갈 확률(만분율 정수). 성공 확률 배율이 커져 합이 100%를 넘으면 실패를 그만큼 줄인다. 운영 배율은 없다.
 */
export function enhanceDownBp(level: number, r: Pick<EnhanceRules, 'rateScale'>) {
  const base = ENHANCE_DOWN_RATES[level];
  if (base === undefined) return 0;
  return Math.min(Math.round(base * 100) * 100, 10_000 - enhanceRateBp(level, r));
}

/** 카드의 강화 상태(서버 응답). fails는 마지막 성공 뒤 실패 · 유지한 수로, 화면이 본 상태가 지금과 같은지 잴 때만 쓴다(확률에 영향 없음). */
export type EnhanceCardState = { level: number; fails: number; tier: EnhanceTier };

/**
 * 0에서 target 단계까지 가는 기대 비용(만 원)과 기대 시도 수. 내려간 단계를 다시 올리는 몫까지 넣는다:
 * 한 단계 값 = (이번 시도 값 + 실패 확률 × 아래 단계를 다시 올리는 값) / 성공 확률.
 */
export function enhanceExpectedCost(
  target: number,
  r: Pick<EnhanceRules, 'costScale' | 'rateScale'> = DEFAULT_ENHANCE_RULES,
): { cost: number; tries: number } {
  let cost = 0;
  let tries = 0;
  let stepCost = 0;
  let stepTries = 0;
  for (let l = 0; l < Math.min(target, ENHANCE_MAX); l++) {
    const up = enhanceRateBp(l, r) / 10_000;
    const down = enhanceDownBp(l, r) / 10_000;
    stepCost = ((enhanceCost(l, r) ?? 0) + down * stepCost) / up;
    stepTries = (1 + down * stepTries) / up;
    cost += stepCost;
    tries += stepTries;
  }
  return { cost, tries };
}

/**
 * 강화 가치(만 원): 기본 표(구간 배율 없음)로 0에서 그 단계까지 가는 기대 비용의 절반(100만 원 단위). 이적시장 판매 가격 범위의 기준 가치에
 * 더한다(card_value + 강화 가치). 운영 배율과 상관없이 기본 표로 고정한다.
 */
export const enhanceValue = (level: number): number =>
  Math.round(enhanceExpectedCost(enhanceLevel(level)).cost / 2 / 100) * 100;

/**
 * 시도 결과(서버 판정). roll은 [0, 10000) 정수 — 성공 확률 안이면 성공, 그다음 실패 확률 안이면 한 단계 내려가고, 나머지는 유지다.
 */
export function enhanceOutcome(
  level: number,
  fails: number,
  roll: number,
  r: Pick<EnhanceRules, 'rateScale'>,
): { success: boolean; to: number; fails: number } {
  const up = enhanceRateBp(level, r);
  if (roll < up) return { success: true, to: level + 1, fails: 0 };
  const to = roll < up + enhanceDownBp(level, r) ? level - 1 : level;
  return { success: false, to, fails: fails + 1 };
}

/**
 * T-11-373 판매 가격 범위의 기준 가치: 카드 기준가 + 강화 가치(그 단계까지 기대 비용의 절반). 첫 화면 번들에 실리는
 * market-value에서 떼어 여기 둔다. 강화로 쓴 자금이 거래로 일부 돌아오지만 구단주끼리 오가는 돈이라 새 자금은 생기지 않는다. 시세 집계(market-value marketRatio)는 이 값으로 나눠 강화 웃돈을 빼고 센다.
 */
export const tradeValue = (cardValue: number, enhance?: number | null) =>
  cardValue + enhanceValue(enhance ?? 0);

/**
 * T-11-650 강화 단계 열(SQL)을 강화 가치(만 원)로 바꾸는 식. 구단 가치(자금 + 카드 몫)와 구단 가치 랭킹(선발 가치)이 카드 기준가에
 * 이 값을 더한다. 값은 코드 상수라 그대로 넣는다. 선발 가치 트리거(마이그레이션 0150)는 같은 숫자를 직접 적고 테스트가 맞춰 본다.
 */
export const enhanceValueSql = (col: string) =>
  `CASE ${col} ${Array.from({ length: ENHANCE_MAX }, (_, i) => `WHEN ${i + 1} THEN ${enhanceValue(i + 1)}`).join(' ')} ELSE 0 END`;

/**
 * T-11-373 강화 단계까지 넣은 판매가 범위(만 원, 100 단위). 하한은 전체 가치에 priceMin을 곱하고, 상한은 기준가에만 priceMax를
 * 곱한 뒤 강화 가치를 더한다. 강화해서 파는 일이 평균적으로 남지 않게 하고, 카드 한 장으로 옮길 수 있는 자금을 넓히지 않으려는 규칙이다.
 */
export function tradeBand(
  cardValue: number,
  enhance: number | null | undefined,
  r: { priceMin: number; priceMax: number },
) {
  const band = priceBand(tradeValue(cardValue, enhance), r);
  const max = Math.floor((cardValue * r.priceMax + enhanceValue(enhance ?? 0)) / 100) * 100;
  return { min: band.min, max };
}
