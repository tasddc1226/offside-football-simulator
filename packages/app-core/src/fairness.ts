// T-11-141 확률 도감의 '확률과 공정성' — 잠재력 등급·강화 확률을 게임 코드의 값에서 바로 계산한다(웹 Fairness.svelte · 앱
// screens/hof/Fairness.tsx는 이 결과를 그리기만 한다). 경기 중 화면에는 숫자를 내지 않고 이 표만 정확한 값을 보여 준다.
import type { BalanceHistory } from '@offside/contracts';
import {
  BALANCE_KEYS,
  BALANCE_SPEC,
  PRESEASON_POT,
  resolveBalance,
  type BalanceKey,
  type BalanceKnob,
} from '@offside/contracts/balance';
import { latestBalance } from '@offside/game/balance';
import { BOOST, BOOST_PITY_PCT } from '@offside/game/boost';
import { fmtValue } from './format.js';
import { gradeOf } from '@offside/game/stats';
import { phi } from '@offside/game/candidates';
import { cachedGet } from './api/client';
import { balanceKeysText as K } from './i18n/ko/balanceKeys';
import { fairnessText as L } from './i18n/ko/fairness';

export const GRADES = ['S', 'A', 'B', 'C', 'D'] as const;
export type Grade = (typeof GRADES)[number];

/** 잠재력 = clamp(round(평균 + 정규난수 × 편차), 55, 96)일 때(candidates.ts) 등급별 확률(0~1). 정수 잠재력마다 확률을
 * 구해 게임의 gradeOf로 묶으므로 등급 경계가 바뀌어도 표가 따라간다. */
export function gradeOdds(mean: number, sd: number): Record<Grade, number> {
  const below = (x: number) => phi((x - mean) / sd);
  const out = { S: 0, A: 0, B: 0, C: 0, D: 0 } as Record<Grade, number>;
  for (let v = 55; v <= 96; v++) {
    const lo = v === 55 ? 0 : below(v - 0.5);
    const hi = v === 96 ? 1 : below(v + 0.5);
    out[gradeOf(v) as Grade] += hi - lo;
  }
  return out;
}

/** 후보 셋 중 하나 이상이 그 등급 이상일 확률. */
export const atLeastOneOf3 = (p: number) => 1 - (1 - p) ** 3;

/** 표에 쓰는 퍼센트(소수 한 자리, 0.1% 미만은 '<0.1%'). */
export const oddsPct = (p: number) => (p > 0 && p < 0.001 ? '<0.1%' : `${(p * 100).toFixed(1)}%`);

/** 화면에 그대로 그리는 '확률과 공정성' 칸. */
export interface FairnessView {
  promises: (readonly [string, string])[];
  /** [등급, 시즌 중 시작, 프리시즌 시작]. */
  pot: (readonly [Grade, string, string])[];
  potNotes: string[];
  /** [단계 이름, 첫 시도 확률]. */
  boost: (readonly [string, string])[];
  boostNote: string;
  hidden: (readonly [string, string])[];
}

export function fairnessView(): FairnessView {
  const { v, values } = latestBalance();
  const season = gradeOdds(values.potMean, values.potSd);
  const pre = gradeOdds(PRESEASON_POT.mean, PRESEASON_POT.sd);
  return {
    promises: [
      [L.promiseSameTerm, L.promiseSame],
      [L.promiseDeviceTerm, L.promiseDevice],
      [L.promiseShownTerm, L.promiseShown],
      [L.promiseVersionTerm, L.promiseVersion],
    ],
    pot: GRADES.map((g) => [g, oddsPct(season[g]), oddsPct(pre[g])] as const),
    potNotes: [
      L.atLeastOne({
        grade: 'S',
        season: oddsPct(atLeastOneOf3(season.S)),
        pre: oddsPct(atLeastOneOf3(pre.S)),
      }),
      // T-11-196 프리미엄 스카우트권: 모든 후보의 S 확률 2배 · 1명 A 이상 보장(candidates.ts scoutOdds와 같은 식).
      L.premium({ season: oddsPct(2 * season.S), pre: oddsPct(2 * pre.S) }),
      `${L.potNote} ${L.version({ v })}`,
    ],
    boost: BOOST.p.map((p, i) => [L.boostLv({ lv: i + 1 }), `${Math.round(p * 100)}%`] as const),
    boostNote: L.boostNote({ pity: `${BOOST_PITY_PCT}%p` }),
    hidden: [
      [L.hiddenPotTerm, L.hiddenPot],
      [L.hiddenBloomTerm, L.hiddenBloom],
      [L.hiddenStoryTerm, L.hiddenStory],
    ],
  };
}

// ───────── T-11-141 공개 밸런스 이력 ─────────
const num = (v: number) => String(Math.round(v * 1000) / 1000);
function fmt(k: BalanceKey, v: number): string {
  const unit = (BALANCE_SPEC[k] as BalanceKnob).unit;
  if (unit === 'man') return fmtValue(v);
  return unit === 'pct' ? `${num(v * 100)}%` : unit === 'x' ? `×${num(v)}` : num(v);
}
const mapDiff = (a: Record<string, number>, b: Record<string, number>) =>
  new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => a[k] !== b[k])).size;

export interface HistoryRow {
  version: number;
  activatedAt: string;
  active: boolean;
  /** 바로 앞(먼저 적용된) 버전과 달라진 항목 — [이름, 이전 → 이후]. 맨 처음 버전은 기본값과 비교한다. */
  changes: (readonly [string, string])[];
}

/** 서버 이력(최근 적용 순)을 화면 줄로 바꾼다. */
export function historyRows(h: BalanceHistory): HistoryRow[] {
  // 맨 끝에 기본값을 붙여 버전마다 바로 뒤(먼저 적용된) 값과 비교한다.
  const resolved = [...h.versions.map((v) => resolveBalance(v.values)), resolveBalance()];
  return h.versions.map((v, i) => {
    const [after, before] = [resolved[i]!, resolved[i + 1]!];
    const changes: (readonly [string, string])[] = BALANCE_KEYS.filter(
      (k) => before[k] !== after[k],
    ).map((k) => [K[k], `${fmt(k, before[k])} → ${fmt(k, after[k])}`] as const);
    for (const m of ['eventWeight', 'choiceBonus'] as const) {
      const n = mapDiff(before[m], after[m]);
      if (n) changes.push([K[m]({ n }), '']);
    }
    return { version: v.version, activatedAt: v.activatedAt, active: v.active, changes };
  });
}

/** 확률 도감에서 이력을 펼칠 때만 부른다(10분 메모, 서버는 엣지 캐시). 실패는 메모하지 않아 다시 펼치면 다시 부른다. */
export const loadHistoryRows = (): Promise<HistoryRow[] | 'error'> =>
  cachedGet<BalanceHistory>('/v1/balance/history', 600_000).then((r) =>
    r.ok ? historyRows(r.data) : 'error',
  );
