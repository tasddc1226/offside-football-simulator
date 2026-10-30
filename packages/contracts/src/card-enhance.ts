// T-11-373 카드 강화(docs/tracking/card-enhance-plan.md, 2026-10-30 다시 짬). 은퇴 카드를 +1~+5까지 올린다. zod가 없는
// 서브패스(`@offside/contracts/card-enhance`)라 웹 · 앱 · 서버가 같은 표로 확률 · 비용 · 효과를 그린다. 판정은 서버만 한다.
// - 시도권: 그 카드가 구단주 팀 선발로 뛴 랭크 경기 수로 얻는다(startsPerTry 경기마다 1번). 돈만으로는 올릴 수 없다.
// - 효과: 단계마다 정수 강화 OVR(ENHANCE_OVR). 자리 실력 · 팀 OVR · 경기 · 급여 · 컵 구간이 같은 값을 쓴다. 커리어 최고 OVR
//   (레전드 점수 · 명예의 전당 · BEST 11 · 기준가)은 바꾸지 않는다.
// - 실패: 단계는 내려가지 않고 비용과 시도권만 쓴다. 그 단계에서 ENHANCE_CEILING번 실패하면 다음 시도는 확정이다.
// 표의 모양은 여기에 고정하고, 운영 도구에서는 열기 · 시도권 경기 수 · 비용 · 확률 배율(balance-spec enhance*)만 바꾼다.

/** 가장 높은 단계. */
export const ENHANCE_MAX = 5;

/** 지금 단계(0~4)에서 한 단계 올리는 시도의 기본 성공 확률. */
export const ENHANCE_RATES = [0.9, 0.75, 0.6, 0.45, 0.3] as const;

/** 지금 단계(0~4)에서 이만큼 실패하면 다음 시도는 확정이다(진짜 천장, 성공하면 다시 0부터 센다). */
export const ENHANCE_CEILING = [1, 2, 3, 4, 5] as const;

/** 지금 단계(0~4)에서 한 번 시도하는 비용(만 원). 10억 · 20억 · 40억 · 70억 · 100억. */
export const ENHANCE_COSTS = [100_000, 200_000, 400_000, 700_000, 1_000_000] as const;

/** 단계(0~5)별 강화 OVR(+N 강화 = OVR +N). 자리 실력에 그대로 더한다. */
export const ENHANCE_OVR = [0, 1, 2, 3, 4, 5] as const;

/** 운영 도구 밸런스 설정에서 읽는 강화 수치(resolveBalance의 enhance* 키). */
export type EnhanceRules = {
  /** 강화 시도를 받는가(0이면 닫힘 — 이미 올린 단계의 효과는 그대로다). */
  open: boolean;
  /** 시도권 1장을 얻는 선발 랭크 경기 수. */
  startsPerTry: number;
  costScale: number;
  rateScale: number;
};

export const DEFAULT_ENHANCE_RULES: EnhanceRules = {
  open: false,
  startsPerTry: 20,
  costScale: 1,
  rateScale: 1,
};

/** 0~5 정수로(옛 응답 · 잘못된 값은 0). */
export const enhanceLevel = (v: unknown): number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 ? Math.min(v, ENHANCE_MAX) : 0;

/** 그 단계의 강화 OVR. */
export const enhanceOvr = (level: unknown): number => ENHANCE_OVR[enhanceLevel(level)] ?? 0;

/** 커리어 최고 OVR에 강화 OVR을 더한 값(구단주 팀 전력 · 급여에 쓴다). */
export const enhancedPeak = (card: { peak: number; enhance?: number | null | undefined }) =>
  card.peak + enhanceOvr(card.enhance);

/** 그 단계에서 확정까지 남은 실패 수(0이면 다음 시도가 확정). +5면 null. */
export function enhanceCeilingLeft(level: number, fails: number): number | null {
  const ceil = ENHANCE_CEILING[level];
  return ceil === undefined ? null : Math.max(0, ceil - Math.max(0, fails));
}

/**
 * 지금 단계 · 그 단계 실패 수에서 다음 시도의 성공 확률(만분율 정수, 100% = 10000). 화면에 보이는 정수 퍼센트와 서버 판정이
 * 같도록 퍼센트 단위로 자른다. +5면 0.
 */
export function enhanceRateBp(level: number, fails: number, r: Pick<EnhanceRules, 'rateScale'>) {
  const base = ENHANCE_RATES[level];
  if (base === undefined) return 0;
  if (enhanceCeilingLeft(level, fails) === 0) return 10_000;
  return Math.min(100, Math.max(1, Math.round(base * r.rateScale * 100))) * 100;
}

/** 지금 단계에서 한 번 시도하는 비용(만 원, 100 단위). +5면 null. */
export function enhanceCost(level: number, r: Pick<EnhanceRules, 'costScale'>): number | null {
  const base = ENHANCE_COSTS[level];
  return base === undefined ? null : Math.max(100, Math.round((base * r.costScale) / 100) * 100);
}

/** 선발 랭크 경기 수로 얻은 시도권 수. */
export const enhanceTriesEarned = (starts: number, startsPerTry: number) =>
  startsPerTry > 0 ? Math.floor(Math.max(0, starts) / startsPerTry) : 0;

/** 카드의 강화 상태(서버 응답). starts는 지금까지 센 선발 랭크 경기 수, used는 쓴 시도권 수. */
export type EnhanceCardState = { level: number; fails: number; starts: number; used: number };

/** 지금 쓸 수 있는 시도권 수. */
export const enhanceTriesLeft = (s: EnhanceCardState, r: Pick<EnhanceRules, 'startsPerTry'>) =>
  Math.max(0, enhanceTriesEarned(s.starts, r.startsPerTry) - s.used);

/** 다음 시도권까지 남은 선발 경기 수. */
export const enhanceStartsToNext = (s: EnhanceCardState, r: Pick<EnhanceRules, 'startsPerTry'>) =>
  r.startsPerTry > 0 ? r.startsPerTry - (Math.max(0, s.starts) % r.startsPerTry) : 0;

/** 한 단계 올리는 데 드는 기대 시도 수(천장 포함). */
export function enhanceExpectedTries(level: number, r: Pick<EnhanceRules, 'rateScale'>): number {
  const ceil = ENHANCE_CEILING[level];
  if (ceil === undefined) return 0;
  const p = enhanceRateBp(level, 0, r) / 10_000;
  // 실패 k번(k < 천장) 뒤 성공할 확률의 합 + 천장에서 확정.
  let tries = 0;
  for (let k = 0; k < ceil; k++) tries += (k + 1) * (1 - p) ** k * p;
  return tries + (ceil + 1) * (1 - p) ** ceil;
}

/** 0에서 target 단계까지 가는 기대 비용(만 원)과 기대 시도 수. */
export function enhanceExpectedCost(
  target: number,
  r: Pick<EnhanceRules, 'costScale' | 'rateScale'> = DEFAULT_ENHANCE_RULES,
): { cost: number; tries: number } {
  let cost = 0;
  let tries = 0;
  for (let l = 0; l < Math.min(target, ENHANCE_MAX); l++) {
    const n = enhanceExpectedTries(l, r);
    tries += n;
    cost += n * (enhanceCost(l, r) ?? 0);
  }
  return { cost, tries };
}

/**
 * 강화 가치(만 원): 기본 표로 0에서 그 단계까지 가는 기대 비용의 절반(100만 원 단위). 이적시장 판매 가격 범위의 기준 가치에
 * 더한다(card_value + 강화 가치). 운영 배율과 상관없이 기본 표로 고정한다.
 */
export const enhanceValue = (level: number): number =>
  Math.round(enhanceExpectedCost(enhanceLevel(level)).cost / 2 / 100) * 100;

/** 시도 결과(서버 판정). roll은 [0, 10000) 정수 — roll < 확률(만분율)이면 성공. 실패해도 단계는 그대로다. */
export function enhanceOutcome(
  level: number,
  fails: number,
  roll: number,
  r: Pick<EnhanceRules, 'rateScale'>,
): { success: boolean; to: number; fails: number } {
  const success = roll < enhanceRateBp(level, fails, r);
  return success ? { success, to: level + 1, fails: 0 } : { success, to: level, fails: fails + 1 };
}

/**
 * T-11-373 판매 가격 범위의 기준 가치: 카드 기준가 + 강화 가치(그 단계까지 기대 비용의 절반). 첫 화면 번들에 실리는
 * market-value에서 떼어 여기 둔다. 강화로 쓴 자금이 거래로 일부 돌아오지만 구단주끼리 오가는 돈이라 새 자금은 생기지 않는다. 시세 집계(market-value marketRatio)는 이 값으로 나눠 강화 웃돈을 빼고 센다.
 */
export const tradeValue = (cardValue: number, enhance?: number | null) =>
  cardValue + enhanceValue(enhance ?? 0);
