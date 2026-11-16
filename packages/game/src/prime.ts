// ───────── T-11-733 전성기 연장 ─────────
// 잠재력 강화가 29세에 끝나 30대엔 선수 자금이 쌓이기만 한다. 정점 나이(care.ts peakEndAge) 1년 전 시즌부터 선수 자금으로
// 정점 나이를 한 해씩 늦추는 데 도전한다. 시즌마다 한 번, 최대 PRIME_MAX단계. 확률은 단계마다 낮아지고 실패하면 비용만 잃고
// 같은 단계의 다음 확률이 오른다(잠재력 강화와 같은 규칙). 성공 중 BAL.primeGreat 비율은 두 단계를 한 번에 올린다(같은 난수 값으로 가른다).
// 몸 관리는 "이번 시즌 하락 폭을 확실히 줄임", 전성기 연장은 "하락 시작을 확률로 늦춤"이라 같이 쓸 수 있다.
// 판정은 게임 RNG를 행동할 때 한 번만 쓴다 — 시도하지 않은 커리어는 결과가 예전과 같다(golden.test.ts).
// 자금이 모자란 시즌엔 앱에서 보상형 광고를 끝까지 보면 자금 없이 한 번 시도한다(커리어 합계 BAL.primeAdTotal번, 확률 규칙은 같다).
import { BAL } from './balance.js';
import { peakEndAge } from './care.js';
import { rnd } from './rng.js';
import { fmtMoney } from './player.js';
import { log } from './stats.js';
import { salaryCost } from './training.js';
import type { GameState, PrimeState } from './types.js';
import { gPrimeText as T } from './i18n/ko/gPrime.js';

export const PRIME = {
  /** 단계(0부터)별 기본 성공 확률. 길이가 최대 단계. */
  p: [0.4, 0.25, 0.15],
  /** 단계별 비용 = max(min, 연봉 × rate)(만 원). */
  rate: [1, 2, 3.5],
  min: [10000, 30000, 60000],
  /** 같은 단계에서 실패할 때마다 다음 확률에 더한다. 성공하면 처음으로 돌아간다. */
  pity: 0.05,
} as const;
export const PRIME_MAX = PRIME.p.length;
export const PRIME_PITY_PCT = Math.round(PRIME.pity * 100);

export const primeState = (s: Pick<GameState, 'prime'>): PrimeState =>
  s.prime ?? { lv: 0, fails: 0, log: [] };

/** 다음 단계 비용(만 원, 10 단위). 최대 단계면 0. */
export function primeCost(s: GameState): number {
  const L = primeState(s).lv;
  if (L >= PRIME_MAX) return 0;
  return salaryCost(s, PRIME.rate[L]!, PRIME.min[L]!, BAL.primeCost);
}

/** 다음 시도 성공 확률(%, 정수). */
export function primeChance(s: GameState): number {
  const b = primeState(s);
  if (b.lv >= PRIME_MAX) return 0;
  return Math.round(Math.min(1, PRIME.p[b.lv]! + PRIME.pity * b.fails) * 100);
}

/** 다음 시도의 대성공(두 단계) 확률(%, 소수 허용). 두 단계를 올리면 최고 단계를 넘거나 비율이 0이면 0. */
export function primeGreatChance(s: GameState): number {
  const b = primeState(s);
  if (b.lv + 2 > PRIME_MAX) return 0;
  return primeChance(s) * BAL.primeGreat;
}

export type PrimeStatus =
  /** 아직 정점 나이 1년 전이 되지 않았다(또는 은퇴했다). */
  | 'early'
  | 'max'
  /** 이번 시즌에 이미 시도했다. */
  | 'done'
  /** 자금이 모자라다. */
  | 'short'
  | 'ready';

export function primeStatus(s: GameState): PrimeStatus {
  const b = primeState(s);
  if (s.retired || s.age < peakEndAge(s) - 1) return 'early';
  if (b.lv >= PRIME_MAX) return 'max';
  if (b.year === s.year) return 'done';
  if (s.money < primeCost(s)) return 'short';
  return 'ready';
}

/** 광고로 지금 시도할 수 있는 남은 횟수 — 자금이 모자란 시즌에만, 아니면 0. */
export function primeAdLeft(s: GameState): number {
  if (primeStatus(s) !== 'short') return 0;
  const used = primeState(s).log.filter((x) => x.ad).length;
  return Math.max(0, BAL.primeAdTotal - used);
}

export interface PrimeResult {
  ok: boolean;
  great: boolean;
  /** 시도 뒤 단계. */
  lv: number;
  cost: number;
  chance: number;
  greatChance: number;
  /** 시도 뒤 정점 나이. */
  peak: number;
}

/** 시도한다. 시도할 수 없으면 null(상태를 바꾸지 않는다). pay 'ad'는 자금이 모자란 시즌에 광고로 한 번(primeAdLeft). */
export function tryPrime(s: GameState, pay: 'money' | 'ad' = 'money'): PrimeResult | null {
  const ad = pay === 'ad';
  if (ad ? primeAdLeft(s) <= 0 : primeStatus(s) !== 'ready') return null;
  const b = primeState(s);
  const cost = ad ? 0 : primeCost(s);
  const chance = primeChance(s);
  const greatChance = primeGreatChance(s);
  const roll = rnd() * 100;
  const ok = roll < chance;
  const great = ok && roll < greatChance;
  const up = great ? 2 : ok ? 1 : 0;
  s.money -= cost;
  s.prime = {
    lv: b.lv + up,
    fails: ok ? 0 : b.fails + 1,
    year: s.year,
    log: [
      ...b.log,
      {
        y: s.year,
        age: s.age,
        lv: b.lv,
        p: chance,
        c: cost,
        ok,
        ...(great ? { g: true as const } : {}),
        ...(ad ? { ad: true as const } : {}),
      },
    ],
  };
  const peak = peakEndAge(s);
  const money = fmtMoney(cost);
  log(
    s,
    ok ? (great ? T.great : T.success)({ peak, cost: money, ad }) : T.fail({ cost: money, ad }),
    ok ? 'good' : 'bad',
  );
  return { ok, great, lv: b.lv + up, cost, chance, greatChance, peak };
}
