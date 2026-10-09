// ───────── T-11-083 잠재력 강화 ─────────
// 커리어 중 쌓인 자금으로 잠재력 보너스(flags.potBonus)를 한 단계씩 올린다. 시즌마다 한 번, 첫 시즌을 마친 뒤부터
// 29세까지. 비용은 연봉 비례(최소 금액이 있다)라 자금이 많은 선수와 적은 선수의 부담이 같고, 확률은 단계마다 낮아진다.
// 실패하면 비용만 잃고 같은 단계의 다음 시도 확률이 오른다. 밸런스 근거: docs/tracking/potential-boost-plan.md.
// 판정은 게임 RNG(세이브에 저장된다)를 한 번 쓴다 — 다시 불러와도 같은 결과다. 시도하지 않은 커리어는 RNG를 쓰지 않는다.
// T-11-116 자금이 모자란 시즌엔 앱에서 보상형 광고를 끝까지 보면 자금 없이 한 번 시도할 수 있다(확률·시즌 한 번 규칙은 같다).
// T-11-153 광고 대신 구단주의 구단 자금으로도 같은 한 번을 받는다(선수 자금은 쓰지 않는다, 기록만 다르다).
// T-11-157 자금이 모자란 시즌엔 그 시즌의 한 번을 쓴 뒤에도 광고·구단 자금으로 더 시도할 수 있다. 한 커리어에서 모두 합쳐
// BAL.boostExtraTotal번까지(확률 규칙은 같다). 시즌마다 열면 광고를 보는 선수가 모두 최고 단계에 닿아 커리어 전체로 묶었다.
// 자금이 충분하면 다음 시즌을 기다린다 — 자금이 모자란 시기를 돕는 길이라서다.
// 광고 · 구단 자금 모두 하루 횟수를 세지 않는다(T-11-172 · 173). 구단 자금은 같은 날 다시 받을수록 값만 오른다.
import { BAL } from './balance.js';
import { rnd } from './rng.js';
import { fmtMoney } from './player.js';
import { log, potScouted } from './stats.js';
import { salaryCost } from './training.js';
import type { BoostState, GameState } from './types.js';
import { gBoostText as BT } from './i18n/ko/gBoost.js';

export const BOOST = {
  /** 단계(0부터)별 기본 성공 확률. 길이가 최대 단계(+4). */
  p: [0.5, 0.35, 0.25, 0.15],
  /** 단계별 비용 = max(min, 연봉 × rate)(만 원). */
  min: [2000, 4000, 8000, 15000],
  rate: [0.7, 1.2, 1.8, 2.5],
  /** 같은 단계에서 실패할 때마다 다음 확률에 더한다. 성공하면 처음으로 돌아간다. */
  pity: 0.05,
  maxAge: 29,
} as const;
export const BOOST_MAX = BOOST.p.length;
/** 실패 보정(%p, 정수) — 화면 문구용. */
export const BOOST_PITY_PCT = Math.round(BOOST.pity * 100);

export const boostState = (s: GameState): BoostState => s.boost ?? { lv: 0, fails: 0, log: [] };

/** 다음 단계 비용(만 원, 10 단위). 최대 단계면 0. */
export function boostCost(s: GameState): number {
  const L = boostState(s).lv;
  if (L >= BOOST_MAX) return 0;
  return salaryCost(s, BOOST.rate[L]!, BOOST.min[L]!);
}

/** 다음 시도 성공 확률(%, 정수). 화면에 그대로 보여 준다. */
export function boostChance(s: GameState): number {
  const b = boostState(s);
  if (b.lv >= BOOST_MAX) return 0;
  return Math.round(Math.min(1, BOOST.p[b.lv]! + BOOST.pity * b.fails) * 100);
}

export type BoostStatus =
  /** 첫 시즌 전 — 스카우트 평가가 없다. */
  | 'locked'
  /** 나이 제한(29세)을 넘었다. */
  | 'aged'
  | 'max'
  /** 이번 시즌에 이미 시도했다. */
  | 'done'
  /** 자금이 모자라다. */
  | 'short'
  | 'ready';

export function boostStatus(s: GameState): BoostStatus {
  const b = boostState(s);
  if (!potScouted(s)) return 'locked';
  if (b.lv >= BOOST_MAX) return 'max';
  if (s.age > BOOST.maxAge) return 'aged';
  if (b.year === s.year) return 'done';
  if (s.money < boostCost(s)) return 'short';
  return 'ready';
}

/**
 * T-11-157 지금 광고·구단 자금으로 더 시도할 수 있는 횟수 — 이번 시즌의 한 번을 썼고, 다음 단계 비용만큼 선수 자금이 없을 때만
 * 커리어에 남은 횟수, 아니면 0.
 */
export function boostExtraLeft(s: GameState): number {
  if (boostStatus(s) !== 'done' || s.money >= boostCost(s)) return 0;
  const used = boostState(s).log.filter((x) => x.x).length;
  return Math.max(0, BAL.boostExtraTotal - used);
}

/** 광고·구단 자금으로 지금 시도할 수 있는지 — 자금이 모자란 시즌의 한 번(T-11-116)이거나 추가 시도(T-11-157). */
export const boostFreeOpen = (s: GameState): boolean =>
  boostStatus(s) === 'short' || boostExtraLeft(s) > 0;

export interface BoostResult {
  ok: boolean;
  /** 시도 뒤 단계. */
  lv: number;
  cost: number;
  /** 시도한 확률(%). */
  chance: number;
}

/**
 * 강화를 시도한다. 시도할 수 없으면 null(상태를 바꾸지 않는다). pay: 'money'는 선수 자금. 'ad'(보상형 광고)와
 * 'club'(구단주의 구단 자금, T-11-153)은 자금이 모자란('short') 시즌의 한 번이나, 그 시즌의 한 번을 쓴 뒤의 추가 시도
 * (T-11-157)에 선수 자금 없이 시도한다 — 자금이 충분한 시즌의 첫 시도는 선수 자금으로만 한다.
 */
export type BoostPay = 'money' | 'ad' | 'club';
export function tryBoost(s: GameState, pay: BoostPay = 'money'): BoostResult | null {
  const free = pay !== 'money';
  const ad = pay === 'ad';
  const club = pay === 'club';
  if (free ? !boostFreeOpen(s) : boostStatus(s) !== 'ready') return null;
  const b = boostState(s);
  // 이번 시즌의 한 번을 이미 썼으면 추가 시도다.
  const extra = b.year === s.year;
  const cost = free ? 0 : boostCost(s);
  const chance = boostChance(s);
  const ok = rnd() * 100 < chance;
  s.money -= cost;
  const next: BoostState = {
    lv: ok ? b.lv + 1 : b.lv,
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
        ...(ad ? { ad: true as const } : {}),
        ...(club ? { club: true as const } : {}),
        ...(extra ? { x: true as const } : {}),
      },
    ],
  };
  s.boost = next;
  if (ok) s.flags.potBonus = (s.flags.potBonus ?? 0) + 1;
  // 잠재력 등급은 은퇴 때 공개한다 — 소식에도 단계만 남긴다.
  log(
    s,
    ok
      ? ad
        ? BT.successAd({ lv: next.lv })
        : club
          ? BT.successClub({ lv: next.lv })
          : BT.success({ lv: next.lv, cost: fmtMoney(cost) })
      : ad
        ? BT.failAd
        : club
          ? BT.failClub
          : BT.fail({ cost: fmtMoney(cost) }),
    ok ? 'good' : 'bad',
  );
  return { ok, lv: next.lv, cost, chance };
}
