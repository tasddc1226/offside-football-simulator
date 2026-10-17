// T-11-373 카드 강화. 은퇴 카드를 구단 자금으로 +1~+10까지 올린다(docs/tracking/card-enhance-plan.md). zod가 없는
// 서브패스(`@offside/contracts/card-enhance`)라 웹 · 앱 · 서버가 같은 표로 확률 · 비용 · 효과를 그린다. 판정은 서버만 한다.
// 표의 모양은 여기에 고정하고, 운영 도구에서는 배율과 한도(balance-spec enhance*)만 바꾼다.

/** 가장 높은 단계. */
export const ENHANCE_MAX = 10;

/** 지금 단계(0~9)에서 한 단계 올리는 시도의 기본 성공 확률. */
export const ENHANCE_RATES = [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2] as const;

/** 지금 단계(0~9)에서 한 번 시도하는 비용(만 원). 5억 · 10억 · 15억 · 25억 · 40억 · 60억 · 90억 · 130억 · 180억 · 250억. */
export const ENHANCE_COSTS = [
  50_000, 100_000, 150_000, 250_000, 400_000, 600_000, 900_000, 1_300_000, 1_800_000, 2_500_000,
] as const;

/** 이 단계 이상에서 시도하다 실패하면 한 단계 내려간다(+6 → +7 시도부터). 그 아래는 실패해도 그대로다. */
export const ENHANCE_DROP_FROM = 6;

/** 고단계 알림(홈 전광판)에 싣는 가장 낮은 성공 단계. */
export const ENHANCE_TICKER_FROM = 8;

/** 운영 도구 밸런스 설정에서 읽는 강화 수치(resolveBalance의 enhance* 키). */
export type EnhanceRules = {
  costScale: number;
  rateScale: number;
  /** 연속 실패 한 번마다 기본 확률에 더하는 비율(0.1 = 기본 확률의 10%씩). */
  pity: number;
  /** 구단주 하루 시도 한도(한국 시각 0시부터). 0이면 강화를 닫는다. */
  dailyCap: number;
  /** 구단주 팀 경기 효과 배율(0 = 효과 끔). */
  effectScale: number;
};

export const DEFAULT_ENHANCE_RULES: EnhanceRules = {
  costScale: 1,
  rateScale: 1,
  pity: 0.1,
  dailyCap: 30,
  effectScale: 0.8,
};

/** 0~10 정수로(옛 응답 · 잘못된 값은 0). */
export const enhanceLevel = (v: unknown): number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 ? Math.min(v, ENHANCE_MAX) : 0;

/** 지금 단계 · 연속 실패 수에서 다음 시도의 성공 확률(0~1, 소수 넷째 자리). +10이면 0. */
export function enhanceRate(
  level: number,
  fails: number,
  r: Pick<EnhanceRules, 'rateScale' | 'pity'>,
) {
  const base = ENHANCE_RATES[level];
  if (base === undefined) return 0;
  const p = base * r.rateScale * (1 + r.pity * Math.max(0, fails));
  return Math.round(Math.min(1, p) * 10_000) / 10_000;
}

/** 지금 단계에서 한 번 시도하는 비용(만 원, 100 단위). +10이면 null. */
export function enhanceCost(level: number, r: Pick<EnhanceRules, 'costScale'>): number | null {
  const base = ENHANCE_COSTS[level];
  return base === undefined ? null : Math.max(100, Math.round((base * r.costScale) / 100) * 100);
}

/** 실패하면 갈 단계(+7~+10 시도는 한 단계 아래, 그 아래는 그대로). */
export const enhanceFailLevel = (level: number) => (level >= ENHANCE_DROP_FROM ? level - 1 : level);

/**
 * 구단주 팀 경기에서 그 카드의 자리 능력치에 더하는 값. +1~+5는 단계마다 0.1, +6~+10은 단계마다 0.3(+10 = 2.0).
 * 선수 커리어 기록 · 레전드 점수 · 팀 OVR 표시는 바꾸지 않는다.
 */
export function enhanceBoost(level: number, effectScale = 1): number {
  const l = enhanceLevel(level);
  const raw = l <= 5 ? 0.1 * l : 0.5 + 0.3 * (l - 5);
  return Math.round(raw * effectScale * 100) / 100;
}

/**
 * 강화 가치(만 원): 0에서 그 단계까지 기본 표(배율 1 · 천장 0.1)로 가는 기대 비용의 절반을 100만 원 단위로. 이적시장 판매 가격
 * 범위의 기준 가치에 더한다(card_value + 강화 가치). 값은 enhanceExpectedCost로 만든 고정 표다(card-enhance.test.ts가 확인한다).
 */
export const ENHANCE_VALUE = [
  0, 25_000, 77_500, 160_100, 313_200, 589_400, 1_064_600, 2_402_500, 5_879_500, 16_424_200,
  62_573_200,
] as const;

export const enhanceValue = (level: number): number => ENHANCE_VALUE[enhanceLevel(level)] ?? 0;

/**
 * 0에서 target 단계까지 가는 기대 비용(만 원)과 기대 시도 수. 상태(단계, 연속 실패 수)의 기대값을 값 반복으로 푼다 — 실패하면
 * 실패 수가 늘어 확률이 1에 닿으므로 상태 수가 유한하다. 테스트와 문서 표를 만드는 데만 쓴다(요청 경로에서는 부르지 않는다).
 */
export function enhanceExpectedCost(
  target: number,
  r: Pick<EnhanceRules, 'costScale' | 'rateScale' | 'pity'> = DEFAULT_ENHANCE_RULES,
): { cost: number; tries: number } {
  const maxFails = 400;
  const states = (fill: number) =>
    Array.from({ length: target }, () => new Array<number>(maxFails + 1).fill(fill));
  const cost = states(0);
  const tries = states(0);
  const at = (t: number[][], l: number, f: number) =>
    l >= target ? 0 : t[l]![Math.min(f, maxFails)]!;
  for (let it = 0; it < 20_000; it++) {
    let delta = 0;
    for (let l = target - 1; l >= 0; l--) {
      for (let f = maxFails; f >= 0; f--) {
        const p = enhanceRate(l, f, r);
        const fl = enhanceFailLevel(l);
        const c = (enhanceCost(l, r) ?? 0) + p * at(cost, l + 1, 0) + (1 - p) * at(cost, fl, f + 1);
        const n = 1 + p * at(tries, l + 1, 0) + (1 - p) * at(tries, fl, f + 1);
        delta = Math.max(delta, Math.abs(c - cost[l]![f]!));
        cost[l]![f] = c;
        tries[l]![f] = n;
      }
    }
    if (delta < 1e-6) break;
  }
  return { cost: target > 0 ? at(cost, 0, 0) : 0, tries: target > 0 ? at(tries, 0, 0) : 0 };
}

/** 시도 결과(서버 판정). roll은 [0, 1) 난수 — roll < 확률이면 성공. */
export function enhanceOutcome(
  level: number,
  fails: number,
  roll: number,
  r: Pick<EnhanceRules, 'rateScale' | 'pity'>,
): { success: boolean; to: number; fails: number } {
  const success = roll < enhanceRate(level, fails, r);
  return success
    ? { success, to: level + 1, fails: 0 }
    : { success, to: enhanceFailLevel(level), fails: fails + 1 };
}
