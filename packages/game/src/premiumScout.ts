// T-11-196 프리미엄 스카우트 잠재력 식과 확률 공개표. candidates.ts에서 떼어 둔 이유는 첫 화면 번들 예산 — 후보 선택
// 화면 · 확률표가 이 파일을 불러오면 프리미엄 식이 candidates.ts에 등록된다(setPremiumPot).
import { potDraw, setPremiumPot, type PotDraw } from './candidates.js';
import type { DetailPos } from './data.js';

// 일반 후보의 잠재력은 정규분포(평균·표준편차는 밸런스 설정)에서 뽑는다. 프리미엄은 등급을 먼저 정확한 확률로 고른 뒤
// 그 등급 구간 안에서 같은 정규분포를 따라 값을 뽑는다. 후보 한 명이 S일 확률은 일반의 정확히 2배이고, 세 명 중 한 명(보장
// 후보)은 A 이상이다. 보장 후보가 아닌 두 명은 S가 아닐 때 일반 분포의 A~D 비율을 그대로 따른다. 화면에 공개하는 확률표는
// scoutOdds()가 같은 식으로 계산한다.

/** 등급 경계(반올림 전 값). gradeOf: S ≥ 90, A ≥ 84, B ≥ 78, C ≥ 70. */
const CUT = { S: 89.5, A: 83.5, B: 77.5, C: 69.5 } as const;
export const SCOUT_GRADES = ['S', 'A', 'B', 'C', 'D'] as const;
export type ScoutGrade = (typeof SCOUT_GRADES)[number];

/** 표준정규 누적분포(Abramowitz–Stegun 7.1.26, 오차 1e-7 수준). 확률 도감(app-core fairness.ts)도 이 함수를 쓴다. */
export function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** phi의 역함수(이분법). */
function phiInv(p: number): number {
  let lo = -9,
    hi = 9;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (phi(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 일반 후보 한 명의 등급 확률(0~1). */
function normalOdds(draw: PotDraw): Record<ScoutGrade, number> {
  const at = (cut: number) => phi((cut - draw.mean) / draw.sd);
  const [s, a, b, c] = [at(CUT.S), at(CUT.A), at(CUT.B), at(CUT.C)];
  return { S: 1 - s, A: s - a, B: a - b, C: b - c, D: c };
}

/** 정규분포를 [lo, hi) 누적확률 구간으로 자른 뒤 u(0~1)로 값 하나. */
const within = (draw: PotDraw, lo: number, hi: number, u: number) =>
  draw.mean + draw.sd * phiInv(lo + (hi - lo) * u);

function premiumPot(draw: PotDraw, r: () => number, sure: boolean): number {
  const sCut = phi((CUT.S - draw.mean) / draw.sd);
  const pS = Math.min(1, 2 * (1 - sCut));
  const pick = r(),
    u = r();
  if (pick < pS) return within(draw, sCut, 1, u);
  if (sure) return within(draw, phi((CUT.A - draw.mean) / draw.sd), sCut, u);
  return within(draw, 0, sCut, u);
}

export interface ScoutOdds {
  /** 일반 후보 한 명. */
  normal: Record<ScoutGrade, number>;
  /** 프리미엄 보장 후보(세 명 중 한 명). */
  sure: Record<ScoutGrade, number>;
  /** 프리미엄의 나머지 두 명. */
  rest: Record<ScoutGrade, number>;
}

/** T-11-196 확률 공개표 — 지금 밸런스 설정(시즌 개막 전이면 개막 전 분포)으로 계산한 후보 한 명의 등급 확률(0~1). */
export function scoutOdds(dpos?: DetailPos | null): ScoutOdds {
  const normal = normalOdds(potDraw(dpos));
  const pS = Math.min(1, 2 * normal.S);
  const keep = normal.S < 1 ? (1 - pS) / (1 - normal.S) : 0;
  return {
    normal,
    sure: { S: pS, A: 1 - pS, B: 0, C: 0, D: 0 },
    rest: {
      S: pS,
      A: normal.A * keep,
      B: normal.B * keep,
      C: normal.C * keep,
      D: normal.D * keep,
    },
  };
}

setPremiumPot(premiumPot);
