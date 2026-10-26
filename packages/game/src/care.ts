// ───────── T-11-513 몸 관리 ─────────
// 정점 나이(peakEndAge)를 넘기면 시즌이 끝날 때마다(season.nextYear) 능력치가 떨어진다. 잠재력 강화가 29세에 끝나 30대엔
// 선수 자금을 쓸 곳이 없다는 유저 의견에 따라, 다음 하락을 앞둔 시즌에 선수 자금으로 관리 프로그램을 받으면 이번 시즌 끝의
// 하락 폭이 줄어든다. 시즌마다 한 번, 단계 셋. 비용은 연봉 비례(최소 금액이 있다)이고 하락이 깊어질수록(정점에서 멀수록) 오른다.
// 하락에 배율만 곱해 RNG를 쓰는 횟수 · 순서는 그대로다 — 받지 않은 커리어는 결과가 같다(golden.test.ts).
import { BAL } from './balance.js';
import { fmtMoney } from './player.js';
import { log } from './stats.js';
import { salaryCost } from './training.js';
import type { GameState } from './types.js';
import { gCareText as T } from './i18n/ko/gCare.js';

export type CareTier = 1 | 2 | 3;
export interface CareDef {
  t: CareTier;
  /** 받으면 남는 하락 몫(1이면 그대로). */
  keep: number;
  /** 비용 = max(min, 연봉 × rate) × 밸런스 배율 × 하락 깊이 배율(만 원). */
  rate: number;
  min: number;
}
export const CARES: readonly CareDef[] = [
  { t: 1, keep: 0.7, rate: 0.5, min: 5000 },
  { t: 2, keep: 0.45, rate: 1.2, min: 15000 },
  { t: 3, keep: 0.25, rate: 2.5, min: 40000 },
];
export const careDef = (t: CareTier): CareDef => CARES[t - 1]!;
/** 줄여 주는 하락 몫(%, 정수) — 화면 문구용. */
export const careCutPct = (d: CareDef): number => Math.round((1 - d.keep) * 100);

/** 이 나이를 넘기는 시즌 끝부터 능력치가 떨어진다(T-11-428 커브 2는 1년 늦게). */
export function peakEndAge(s: Pick<GameState, 'trait' | 'pos' | 'gcv'>): number {
  const v2 = (s.gcv ?? 1) >= 2;
  return (
    (s.trait === 'early' ? (v2 ? 30 : 29) : s.trait === 'late' ? (v2 ? 31 : 32) : 30) +
    (s.pos === 'GK' ? 3 : 0)
  );
}

/** 이번 시즌 끝에 맞을 하락의 깊이(정점을 넘긴 해 수). 0이면 이번 시즌 끝엔 떨어지지 않는다. */
export const careDepth = (s: GameState): number => Math.max(0, s.age + 1 - peakEndAge(s));

/** 이번 시즌에 받은 관리(없으면 null). */
export const careNow = (s: GameState): CareDef | null =>
  s.care && s.care.y === s.year ? careDef(s.care.t) : null;

export type CareStatus =
  /** 이번 시즌 끝엔 떨어지지 않는다(아직 정점 전). */
  | 'early'
  /** 이번 시즌 관리를 이미 받았다. */
  | 'done'
  | 'open';
export function careStatus(s: GameState): CareStatus {
  if (careDepth(s) < 1) return 'early';
  return careNow(s) ? 'done' : 'open';
}

/** 단계별 비용(만 원, 10 단위). 하락이 한 해 깊어질 때마다 기본 값의 절반씩 더한다. */
export function careCost(s: GameState, d: CareDef): number {
  const depth = Math.max(1, careDepth(s));
  return (
    Math.round((salaryCost(s, d.rate, d.min, BAL.careCost) * (1 + 0.5 * (depth - 1))) / 10) * 10
  );
}

/** 관리를 받는다. 받을 수 없거나 자금이 모자라면 null(상태를 바꾸지 않는다). */
export function buyCare(s: GameState, t: CareTier): { cost: number } | null {
  if (s.retired || careStatus(s) !== 'open') return null;
  const d = careDef(t);
  const cost = careCost(s, d);
  if (s.money < cost) return null;
  s.money -= cost;
  s.care = { y: s.year, t, c: cost };
  log(s, T.bought({ cut: careCutPct(d), cost: fmtMoney(cost) }), 'good');
  return { cost };
}

/** 이번 시즌 끝 하락에 곱할 배율. season.nextYear가 해를 넘기기 전에 부른다. */
export const careKeep = (s: GameState): number => careNow(s)?.keep ?? 1;
