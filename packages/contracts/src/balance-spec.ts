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
}

export const BALANCE_SPEC = {
  eventRatePreseason: { group: 'event', label: '프리시즌 이벤트 확률', desc: '프리시즌 구간마다 확률 이벤트가 생길 확률', def: 0.55, min: 0, max: 1, step: 0.01 },
  eventRateSeason: { group: 'event', label: '전·후반기 이벤트 확률', desc: '전반기·후반기 구간마다 확률 이벤트가 생길 확률', def: 0.7, min: 0, max: 1, step: 0.01 },
  eventTwist: { group: 'event', label: '선택 뒤 반전 확률', desc: '선택지를 고른 뒤 능력치 반전이 붙을 확률', def: 0.3, min: 0, max: 1, step: 0.01 },
  growthScale: { group: 'growth', label: '성장 배율', desc: '경기·훈련으로 오르는 능력치에 곱하는 값', def: 1, min: 0.5, max: 1.5, step: 0.01 },
  injuryRate: { group: 'growth', label: '경기당 부상 확률', desc: '한 경기를 뛸 때 다칠 기본 확률(체력·나이·특성 보정 전)', def: 0.012, min: 0, max: 0.05, step: 0.001 },
  bigInjuryShare: { group: 'growth', label: '큰 부상 비율', desc: '부상 중 8~18경기 결장하는 큰 부상의 비율', def: 0.12, min: 0, max: 0.5, step: 0.01 },
  mlsYoungPull: { group: 'transfer', label: '30세 미만 MLS 오퍼 가중치', desc: '30세 미만 선수에게 MLS 구단이 오퍼를 낼 가중치(30세 이상은 1)', def: 0.1, min: 0, max: 1, step: 0.01 },
  koreaStr: { group: 'national', label: 'A대표팀 전력', desc: '월드컵·아시안컵·A매치에서 한국 대표팀 전력', def: 75, min: 60, max: 90, step: 1 },
  koreaU23: { group: 'national', label: 'U-23 대표팀 전력', desc: '아시안게임·올림픽에서 한국 U-23 대표팀 전력', def: 69, min: 55, max: 85, step: 1 },
  wcQual: { group: 'national', label: '월드컵 예선 통과 확률', desc: '월드컵 아시아 예선을 통과할 확률', def: 0.9, min: 0, max: 1, step: 0.01 },
  olympicQual: { group: 'national', label: '올림픽 예선 통과 확률', desc: '올림픽 아시아 예선(AFC U-23 아시안컵)을 통과할 확률', def: 0.85, min: 0, max: 1, step: 0.01 },
  agRelease: { group: 'national', label: '아시안게임 해외 구단 차출 허락', desc: '협상 이벤트 없이 해외 구단이 아시안게임 차출을 허락할 확률', def: 0.6, min: 0, max: 1, step: 0.01 },
  olyRelease: { group: 'national', label: '올림픽 해외 구단 차출 허락', desc: '협상 이벤트 없이 해외 구단이 올림픽 차출을 허락할 확률', def: 0.7, min: 0, max: 1, step: 0.01 },
  sangmuBase: { group: 'military', label: '상무 기본 합격률', desc: 'OVR 63 · 명성 30 기준 상무 합격률(리그·나이 보정 전)', def: 0.28, min: 0, max: 1, step: 0.01 },
} as const satisfies Record<string, BalanceKnob>;

export type BalanceKey = keyof typeof BALANCE_SPEC;
export const BALANCE_KEYS = Object.keys(BALANCE_SPEC) as BalanceKey[];

/** 이벤트별 등장 가중치 배율(기본 1)과 선택지별 성공 확률 가감(기본 0, `이벤트id:선택지번호`). */
export const EVENT_WEIGHT_RANGE = { min: 0, max: 5 } as const;
export const CHOICE_BONUS_RANGE = { min: -0.5, max: 0.5 } as const;
export const EVENT_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
export const CHOICE_KEY_PATTERN = /^[a-z0-9-]{1,40}:\d{1,2}$/;

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

const clampTo = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitizeMap(raw: unknown, pattern: RegExp, range: { min: number; max: number }): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) if (pattern.test(k) && isNum(v)) out[k] = clampTo(v, range.min, range.max);
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
  const values = { eventWeight: o.eventWeight ?? {}, choiceBonus: o.choiceBonus ?? {} } as BalanceValues;
  for (const k of BALANCE_KEYS) values[k] = o[k] ?? BALANCE_SPEC[k].def;
  return values;
}
