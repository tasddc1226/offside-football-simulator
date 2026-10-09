/**
 * T-10-016. 서버에서 조정하는 게임 밸런스 수치. zod가 없는 서브패스(`@offside/contracts/balance`)라
 * 웹이 값으로 가져와도 번들에 zod가 들어가지 않는다 — 게임(웹)·API 검증·밸런스 시뮬레이터가 같은
 * 기본값과 허용 범위를 쓴다.
 *
 * 서버에는 기본값과 다른 값(overrides)만 저장한다. 게임은 `resolveBalance(overrides)`로 전체 값을 만든다.
 * 수치를 새로 열 때는 여기에 키를 더하고, 게임 코드가 `BAL.<키>`를 읽게 한다(기본값 = 지금까지 하드코딩된 값).
 */
export const BALANCE_GROUPS = {
  event: '이벤트',
  growth: '성장 · 부상',
  transfer: '이적',
  national: '대표팀',
  military: '병역',
  // T-11-080 이적시장. 게임(웹)은 읽지 않고, 서버가 방출·등록·구매 요청 때 활성 버전을 바로 읽는다(커리어별 고정 아님).
  market: '이적시장',
} as const;
export type BalanceGroup = keyof typeof BALANCE_GROUPS;

export interface BalanceKnob {
  group: BalanceGroup;
  label: string;
  desc: string;
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
    group: 'event',
    label: '프리시즌 이벤트 확률',
    desc: '프리시즌 구간마다 확률 이벤트가 생길 확률',
    def: 0.55,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  eventRateSeason: {
    group: 'event',
    label: '전·후반기 이벤트 확률',
    desc: '전반기·후반기 구간마다 확률 이벤트가 생길 확률',
    def: 0.7,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  eventTwist: {
    group: 'event',
    label: '선택 뒤 반전 확률',
    desc: '선택지를 고른 뒤 능력치 반전이 붙을 확률',
    def: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  growthScale: {
    group: 'growth',
    label: '성장 배율',
    desc: '경기·훈련으로 오르는 능력치에 곱하는 값',
    def: 1,
    min: 0.5,
    max: 1.5,
    step: 0.01,
    unit: 'x',
  },
  investGain: {
    group: 'growth',
    label: '특훈 성장 비율',
    desc: '자기 투자 특훈(약점 보강·강점 특화)이 능력치 훈련 한 번의 몇 배만큼 올리는지',
    def: 0.4,
    min: 0,
    max: 1,
    step: 0.05,
    unit: 'pct',
  },
  investCost: {
    group: 'growth',
    label: '자기 투자 비용 배율',
    desc: '자기 투자 비용(연봉 비례·최소 금액)에 곱하는 값',
    def: 1,
    min: 0.25,
    max: 4,
    step: 0.05,
    unit: 'x',
  },
  boostExtraTotal: {
    group: 'growth',
    label: '커리어당 추가 강화 횟수',
    desc: '선수 자금이 모자란 시즌에 잠재력 강화 한 번을 쓴 뒤 광고나 구단 자금으로 더 시도할 수 있는 횟수(한 커리어 전체). 0이면 더 시도하지 않는다',
    def: 2,
    min: 0,
    max: 5,
    step: 1,
  },
  potMean: {
    group: 'growth',
    label: '잠재력 평균',
    desc: '새 선수의 실제 잠재력 추첨 평균 — 높을수록 S·A가 늘고 D가 줄어든다. 시즌에 만든 새 커리어에만 쓰인다',
    def: 75,
    min: 65,
    max: 85,
    step: 1,
  },
  potSd: {
    group: 'growth',
    label: '잠재력 편차',
    desc: '새 선수의 실제 잠재력 추첨 표준편차 — 클수록 S와 D가 늘어난다. 시즌에 만든 새 커리어에만 쓰인다',
    def: 6,
    min: 4,
    max: 12,
    step: 0.5,
  },
  potScoutSd: {
    group: 'growth',
    label: '스카우트 평가 오차',
    desc: '화면에 보이는 스카우트 평가가 실제 잠재력에서 벗어나는 표준편차 — 0이면 평가가 정확하다',
    def: 3,
    min: 0,
    max: 6,
    step: 0.5,
  },
  injuryRate: {
    group: 'growth',
    label: '경기당 부상 확률',
    desc: '한 경기를 뛸 때 다칠 기본 확률(체력·나이·특성 보정 전)',
    def: 0.012,
    min: 0,
    max: 0.05,
    step: 0.001,
    unit: 'pct',
  },
  bigInjuryShare: {
    group: 'growth',
    label: '큰 부상 비율',
    desc: '부상 중 8~18경기 결장하는 큰 부상의 비율',
    def: 0.12,
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: 'pct',
  },
  mlsYoungPull: {
    group: 'transfer',
    label: '30세 미만 MLS 오퍼 가중치',
    desc: '30세 미만 선수에게 MLS 구단이 오퍼를 낼 가중치(30세 이상은 1)',
    def: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
  },
  koreaStr: {
    group: 'national',
    label: 'A대표팀 전력',
    desc: '월드컵·아시안컵·A매치에서 한국 대표팀 전력',
    def: 75,
    min: 60,
    max: 90,
    step: 1,
  },
  koreaU23: {
    group: 'national',
    label: 'U-23 대표팀 전력',
    desc: '아시안게임·올림픽에서 한국 U-23 대표팀 전력',
    def: 69,
    min: 55,
    max: 85,
    step: 1,
  },
  wcQual: {
    group: 'national',
    label: '월드컵 예선 통과 확률',
    desc: '월드컵 아시아 예선을 통과할 확률',
    def: 0.9,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  olympicQual: {
    group: 'national',
    label: '올림픽 예선 통과 확률',
    desc: '올림픽 아시아 예선(AFC U-23 아시안컵)을 통과할 확률',
    def: 0.85,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  agRelease: {
    group: 'national',
    label: '아시안게임 해외 구단 차출 허락',
    desc: '협상 이벤트 없이 해외 구단이 아시안게임 차출을 허락할 확률',
    def: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  olyRelease: {
    group: 'national',
    label: '올림픽 해외 구단 차출 허락',
    desc: '협상 이벤트 없이 해외 구단이 올림픽 차출을 허락할 확률',
    def: 0.7,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  sangmuBase: {
    group: 'military',
    label: '상무 기본 합격률',
    desc: 'OVR 63 · 명성 30 기준 상무 합격률(리그·나이 보정 전)',
    def: 0.28,
    min: 0,
    max: 1,
    step: 0.01,
    unit: 'pct',
  },
  marketReleaseRate: {
    group: 'market',
    label: '방출 지급률',
    desc: '선수를 방출하면 카드 기준가에 이 값을 곱한 만큼 구단 자금이 생긴다',
    def: 1,
    min: 0,
    max: 2,
    step: 0.05,
    unit: 'pct',
  },
  marketFeeRate: {
    group: 'market',
    label: '거래 수수료율',
    desc: '선수가 팔리면 판매가에서 이 비율만큼 떼고 판매자에게 준다',
    def: 0.05,
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: 'pct',
  },
  marketPriceMin: {
    group: 'market',
    label: '최저 판매가(기준가 배수)',
    desc: '판매가를 기준가의 이 배수 아래로 정할 수 없다',
    def: 0.5,
    min: 0.1,
    max: 1,
    step: 0.05,
    unit: 'x',
  },
  marketPriceMax: {
    group: 'market',
    label: '최고 판매가(기준가 배수)',
    desc: '판매가를 기준가의 이 배수 위로 정할 수 없다',
    def: 3,
    min: 1,
    max: 10,
    step: 0.1,
    unit: 'x',
  },
  marketListLimit: {
    group: 'market',
    label: '동시 판매 등록 수',
    desc: '한 구단주가 한 번에 올려 둘 수 있는 판매 등록 수',
    def: 10,
    min: 1,
    max: 50,
    step: 1,
  },
  marketDailyBuys: {
    group: 'market',
    label: '하루 영입 수',
    desc: '한 구단주가 하루(한국 시각)에 영입할 수 있는 선수 수',
    def: 20,
    min: 1,
    max: 100,
    step: 1,
  },
  // T-11-152 구단 자금으로 사는 선수 후보 리롤권. 쌓이기만 하는 구단 자금을 없애려고 비싸게 판다.
  rerollPrice: {
    group: 'market',
    label: '리롤권 가격',
    desc: '그날 첫 리롤권 가격(만 원). 같은 날 더 살 때마다 가격 상승 배율을 곱한다',
    def: 1_000_000,
    min: 10_000,
    max: 100_000_000,
    step: 100_000,
    unit: 'man',
  },
  rerollPriceGrowth: {
    group: 'market',
    label: '리롤권 가격 상승 배율',
    desc: '같은 날(0시 한국 시각부터) 한 장 더 살 때마다 가격에 곱한다',
    def: 2,
    min: 1,
    max: 5,
    step: 0.5,
    unit: 'x',
  },
  rerollDailyCap: {
    group: 'market',
    label: '하루 리롤권 구매 수',
    desc: '한 구단주가 하루(한국 시각)에 구단 자금으로 살 수 있는 리롤권 수. 0이면 팔지 않는다',
    def: 3,
    min: 0,
    max: 20,
    step: 1,
  },
  // T-11-153 앱의 보상형 광고 자리(후보 잠재력 · 시즌 평가 보기 · 자금이 모자란 시즌의 강화)를 광고 대신 구단 자금으로
  // 받는다. 웹은 광고가 없어 후보 잠재력 · 강화만 구단 자금으로 받는다.
  rewardPriceCandidates: {
    group: 'market',
    label: '후보 잠재력 보기 가격',
    desc: '광고 대신 구단 자금으로 후보 3명의 잠재력을 볼 때 그날 첫 가격(만 원). 같은 날 더 쓸 때마다 상승 배율을 곱한다',
    def: 300_000,
    min: 10_000,
    max: 100_000_000,
    step: 10_000,
    unit: 'man',
  },
  rewardPricePeek: {
    group: 'market',
    label: '시즌 평가 보기 가격',
    desc: '광고 대신 구단 자금으로 이번 시즌 스카우트 평가를 볼 때 그날 첫 가격(만 원)',
    def: 200_000,
    min: 10_000,
    max: 100_000_000,
    step: 10_000,
    unit: 'man',
  },
  rewardPriceBoost: {
    group: 'market',
    label: '잠재력 강화 가격',
    desc: '선수 자금이 모자란 시즌에 광고 대신 구단 자금으로 강화를 한 번 시도할 때 그날 첫 가격(만 원)',
    def: 500_000,
    min: 10_000,
    max: 100_000_000,
    step: 10_000,
    unit: 'man',
  },
  rewardPriceGrowth: {
    group: 'market',
    label: '광고 대신 구단 자금 가격 상승 배율',
    desc: '같은 날(0시 한국 시각부터) 같은 보상을 한 번 더 받을 때마다 가격에 곱한다',
    def: 2,
    min: 1,
    max: 5,
    step: 0.5,
    unit: 'x',
  },
  rewardDailyCap: {
    group: 'market',
    label: '광고 대신 구단 자금 하루 횟수',
    desc: '보상마다 한 구단주가 하루(한국 시각)에 구단 자금으로 받을 수 있는 횟수. 0이면 구단 자금으로 받지 않는다. 잠재력 강화는 앱에서 광고로 받은 횟수와 합쳐 센다',
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
