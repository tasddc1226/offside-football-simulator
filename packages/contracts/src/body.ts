// T-10-096 선수 키·몸무게. 선수 생성 때 유저가 입력하고, 웹(입력 검사)과 서버(메타 검증)가 같은 범위를 쓴다.
// 범위는 프로 축구선수 실측 분포(키 160~200cm, 몸무게 55~100kg)에서 벗어난 값과, 키에 비해 지나치게 마르거나
// 무거운 조합(BMI 18.5 미만·30 초과)을 막는다.
export const BODY_LIMITS = {
  height: { min: 160, max: 200 },
  weight: { min: 55, max: 100 },
  bmi: { min: 18.5, max: 30 },
} as const;

export interface Body {
  /** 키(cm, 정수). */
  h: number;
  /** 몸무게(kg, 정수). */
  w: number;
}

export const bmiOf = (b: Body) => b.w / (b.h / 100) ** 2;

/** 입력 오류 문구(없으면 null). 정수가 아니거나 범위 밖이면 이유를 알려 준다. */
export function bodyError(b: Body): string | null {
  const { height: H, weight: W, bmi: B } = BODY_LIMITS;
  if (!Number.isInteger(b.h) || b.h < H.min || b.h > H.max)
    return `키는 ${H.min}~${H.max}cm 사이로 입력해 주세요.`;
  if (!Number.isInteger(b.w) || b.w < W.min || b.w > W.max)
    return `몸무게는 ${W.min}~${W.max}kg 사이로 입력해 주세요.`;
  const bmi = bmiOf(b);
  if (bmi < B.min) return '키에 비해 몸무게가 너무 가벼워요.';
  if (bmi > B.max) return '키에 비해 몸무게가 너무 무거워요.';
  return null;
}

/** 포지션별 기본 체격(프로 선수 평균에 가깝게). 입력 칸의 처음 값이자 능력치 보정의 기준점이다. */
export const BODY_DEFAULT: Record<'GK' | 'DF' | 'MF' | 'FW', Body> = {
  GK: { h: 189, w: 83 },
  DF: { h: 183, w: 77 },
  MF: { h: 177, w: 71 },
  FW: { h: 180, w: 74 },
};
