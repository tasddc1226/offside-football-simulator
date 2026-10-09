/**
 * T-10-016. 서버에서 조정하는 게임 밸런스 수치. zod가 없는 서브패스(`@offside/contracts/balance`)라
 * 웹이 값으로 가져와도 번들에 zod가 들어가지 않는다 — 게임(웹)·API 검증·밸런스 시뮬레이터가 같은
 * 기본값과 허용 범위를 쓴다.
 *
 * 서버에는 기본값과 다른 값(overrides)만 저장한다. 게임은 `resolveBalance(overrides)`로 전체 값을 만든다.
 * 수치를 새로 열 때는 여기에 키를 더하고, 게임 코드가 `BAL.<키>`를 읽게 한다(기본값 = 지금까지 하드코딩된 값).
 * 운영 도구에 보이는 구분·이름·설명은 `./balance-text`(BALANCE_TEXT)에 같은 키로 더한다(T-11-157c).
 */

export interface BalanceKnob {
  def: number;
  min: number;
  max: number;
  /** 입력 칸 증감 단위. */
  step: number;
  /** T-11-141 공개 이력의 표시 단위: 확률(%)·배율(×)·금액(만 원, T-11-152). 없으면 숫자 그대로. */
  unit?: 'pct' | 'x' | 'man';
}

/** T-11-093 프리시즌에 만든 선수의 잠재력 추첨(평균·편차). 서버 설정과 상관없이 고정이라 예전과 같은 선수가 나온다. */
export const PRESEASON_POT = { mean: 74, sd: 8 } as const;

export const BALANCE_SPEC = {
  eventRatePreseason: {
    def: 0.55,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  eventRateSeason: {
    def: 0.7,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  eventTwist: {
    def: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  growthScale: {
    def: 1,
    min: 0.5,
    max: 1.5,
    step: 0.01,
    unit: 'x',
  },
  investGain: {
    def: 0.4,
    min: 0,
    max: 1,
    step: 0.05,
    unit: 'pct',
  },
  investCost: {
    def: 1,
    min: 0.25,
    max: 4,
    step: 0.05,
    unit: 'x',
  },
  boostExtraTotal: {
    def: 2,
    min: 0,
    max: 5,
    step: 1,
  },
  potMean: {
    def: 75,
    min: 65,
    max: 85,
    step: 1,
  },
  potSd: {
    def: 6,
    min: 4,
    max: 12,
    step: 0.5,
  },
  potScoutSd: {
    def: 3,
    min: 0,
    max: 6,
    step: 0.5,
  },
  injuryRate: {
    def: 0.012,
    min: 0,
    max: 0.05,
    step: 0.001,
    unit: 'pct',
  },
  bigInjuryShare: {
    def: 0.12,
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: 'pct',
  },
  mlsYoungPull: {
    def: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
  },
  koreaStr: {
    def: 75,
    min: 60,
    max: 90,
    step: 1,
  },
  koreaU23: {
    def: 69,
    min: 55,
    max: 85,
    step: 1,
  },
  wcQual: {
    def: 0.9,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  olympicQual: {
    def: 0.85,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  agRelease: {
    def: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  olyRelease: {
    def: 0.7,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  sangmuBase: {
    def: 0.28,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  marketReleaseRate: {
    def: 1,
    min: 0,
    max: 2,
    step: 0.05,
    unit: 'pct',
  },
  // T-11-163 키운 선수를 방출하지 않고도 구단 자금을 조금 받는다. 방출(기준가 100%)보다 훨씬 적게 둔다.
  marketRetireBonusRate: {
    group: 'market',
    label: '은퇴 장려금 비율',
    desc: '선수가 은퇴해 카드가 생길 때 카드 기준가에 이 값을 곱한 만큼 키운 사람에게 구단 자금을 준다. 0이면 주지 않는다',
    def: 0.1,
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: 'pct',
  },
  marketFeeRate: {
    def: 0.05,
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: 'pct',
  },
  marketPriceMin: {
    def: 0.5,
    min: 0.1,
    max: 1,
    step: 0.05,
    unit: 'x',
  },
  marketPriceMax: {
    def: 3,
    min: 1,
    max: 10,
    step: 0.1,
    unit: 'x',
  },
  marketListLimit: {
    def: 10,
    min: 1,
    max: 50,
    step: 1,
  },
  marketDailyBuys: {
    def: 20,
    min: 1,
    max: 100,
    step: 1,
  },
  // T-11-152 구단 자금으로 사는 선수 후보 리롤권. 쌓이기만 하는 구단 자금을 없애려고 비싸게 판다.
  rerollPrice: {
    def: 1_000_000,
    min: 10_000,
    max: 100_000_000,
    step: 100_000,
    unit: 'man',
  },
  rerollPriceGrowth: {
    def: 2,
    min: 1,
    max: 5,
    step: 0.5,
    unit: 'x',
  },
  rerollDailyCap: {
    def: 3,
    min: 0,
    max: 20,
    step: 1,
  },
  // T-11-153 앱의 보상형 광고 자리(후보 잠재력 · 시즌 평가 보기 · 자금이 모자란 시즌의 강화)를 광고 대신 구단 자금으로
  // 받는다. 웹은 광고가 없어 후보 잠재력 · 강화만 구단 자금으로 받는다.
  rewardPriceCandidates: {
    def: 300_000,
    min: 10_000,
    max: 100_000_000,
    step: 10_000,
    unit: 'man',
  },
  rewardPricePeek: {
    def: 200_000,
    min: 10_000,
    max: 100_000_000,
    step: 10_000,
    unit: 'man',
  },
  rewardPriceBoost: {
    def: 500_000,
    min: 10_000,
    max: 100_000_000,
    step: 10_000,
    unit: 'man',
  },
  rewardPriceGrowth: {
    def: 2,
    min: 1,
    max: 5,
    step: 0.5,
    unit: 'x',
  },
  rewardDailyCap: {
    def: 5,
    min: 0,
    max: 50,
    step: 1,
  },
} as const satisfies Record<string, BalanceKnob>;

export type BalanceKey = keyof typeof BALANCE_SPEC;
export const BALANCE_KEYS = Object.keys(BALANCE_SPEC) as BalanceKey[];

/** 이벤트별 등장 가중치 배율(기본 1)과 선택지별 성공 확률 가감(기본 0, `이벤트id:선택지번호`). */
export const EVENT_WEIGHT_RANGE = { min: 0, max: 5 } as const;
export const CHOICE_BONUS_RANGE = { min: -0.5, max: 0.5 } as const;
export const EVENT_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
export const CHOICE_KEY_PATTERN = /^[a-z0-9-]{1,40}:\d{1,2}$/;
/** 버전 메모 최대 길이. */
export const BALANCE_NOTE_MAX = 200;

/** 서버에 저장·전송되는 형태: 기본값과 다른 값만(zod 스키마의 추론 타입과 맞도록 undefined도 허용). */
export type BalanceOverrides = { [K in BalanceKey]?: number | undefined } & {
  eventWeight?: Record<string, number> | undefined;
  choiceBonus?: Record<string, number> | undefined;
};
/** 게임이 읽는 전체 값. */
export type BalanceValues = Record<BalanceKey, number> & {
  eventWeight: Record<string, number>;
  choiceBonus: Record<string, number>;
};

export const clampTo = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitizeMap(
  raw: unknown,
  pattern: RegExp,
  range: { min: number; max: number },
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw))
    if (pattern.test(k) && isNum(v)) out[k] = clampTo(v, range.min, range.max);
  return out;
}

/** 믿을 수 없는 입력(서버 응답·저장)에서 알려진 키의 숫자만 남기고 범위로 자른다. */
export function sanitizeBalance(raw: unknown): BalanceOverrides {
  const out: BalanceOverrides = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const k of BALANCE_KEYS) {
    const v = r[k];
    if (isNum(v)) out[k] = clampTo(v, BALANCE_SPEC[k].min, BALANCE_SPEC[k].max);
  }
  const eventWeight = sanitizeMap(r.eventWeight, EVENT_ID_PATTERN, EVENT_WEIGHT_RANGE);
  const choiceBonus = sanitizeMap(r.choiceBonus, CHOICE_KEY_PATTERN, CHOICE_BONUS_RANGE);
  if (Object.keys(eventWeight).length) out.eventWeight = eventWeight;
  if (Object.keys(choiceBonus).length) out.choiceBonus = choiceBonus;
  return out;
}

export function resolveBalance(overrides: BalanceOverrides = {}): BalanceValues {
  const o = sanitizeBalance(overrides);
  const values = {
    eventWeight: o.eventWeight ?? {},
    choiceBonus: o.choiceBonus ?? {},
  } as BalanceValues;
  for (const k of BALANCE_KEYS) values[k] = o[k] ?? BALANCE_SPEC[k].def;
  return values;
}
