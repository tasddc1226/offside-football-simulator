// ───────── T-11-733 은퇴 유산 ─────────
// 커리어 후반에 쌓인 선수 자금을 은퇴 순간의 업적으로 바꾼다. 은퇴 전에 종류(아카데미 · 재단 · 첫 구단 후원)를 골라 두면,
// 은퇴할 때(season.applyRetirement) 남은 자금으로 등급이 정해지고 자금을 모두 쓴다. 등급 기준은 운영 36세 이상 시즌의 남은 자금
// 분포(2026-11-16, 하위 25% · 중앙값 · 상위 25% · 상위 5%)에 맞췄다. 금 이상은 종류별 칭호, 레전드는 최고 칭호를 준다.
// 명예의 전당에는 종류와 등급만 남고 금액은 남지 않는다. 레전드 점수 · 구단 자금 · 게임 결과에는 영향이 없다. RNG를 쓰지 않는다.
import { fmtMoney } from './player.js';
import { collectionValue } from './collection.js';
import { fameEff, log } from './stats.js';
import type { GameState, LegacyKind, LegacyTier } from './types.js';
import { gLegacyText as T } from './i18n/ko/gLegacy.js';

export const LEGACY_KINDS: readonly LegacyKind[] = ['academy', 'charity', 'club'];
/** 등급별 최소 남은 자금(만 원): 동 70억 · 은 170억 · 금 370억 · 레전드 800억. */
export const LEGACY_TIERS: readonly number[] = [700_000, 1_700_000, 3_700_000, 8_000_000];
/** 카드를 보이는 나이(30대 소비처). */
export const LEGACY_AGE = 30;

/** 소장품 가치(만 원) — 인기가 높을수록 비싸게 쳐 준다(인기 100이면 1.5배). T-11-735. */
export function legacyItemsValue(s: GameState): number {
  const v = collectionValue(s.auction?.items);
  return v ? Math.round((v * (1 + fameEff(s) / 200)) / 10) * 10 : 0;
}

/** 은퇴 유산에 쓰는 돈 = 남은 자금 + 소장품 가치. */
export const legacyFund = (s: GameState): number => s.money + legacyItemsValue(s);

/** 이 자금이면 몇 등급인가(못 미치면 0). */
export function legacyTierOf(money: number): LegacyTier | 0 {
  let t = 0;
  for (const min of LEGACY_TIERS) if (money >= min) t++;
  return t as LegacyTier | 0;
}

/** 다음 등급까지 모자란 자금(만 원). 최고 등급이면 0. */
export function legacyToNext(money: number): number {
  const t = legacyTierOf(money);
  return t >= LEGACY_TIERS.length ? 0 : LEGACY_TIERS[t]! - money;
}

/** 종류를 고른다(같은 것을 다시 고르면 취소). 은퇴했으면 바꾸지 않는다. */
export function pickLegacy(s: GameState, k: LegacyKind): void {
  if (s.retired) return;
  s.legacyPick = s.legacyPick === k ? undefined : k;
}

/** 은퇴할 때 부른다(칭호 판정 전). 고른 종류가 있고 동 등급 이상이면 유산을 남기고 자금을 쓴다. */
export function settleLegacy(s: GameState): void {
  const k = s.legacyPick;
  if (!k || s.legacy) return;
  const fund = legacyFund(s);
  const t = legacyTierOf(fund);
  if (!t) return;
  s.legacy = { k, t };
  log(s, T.settled({ kind: T[k], tier: T[`tier${t}`], money: fmtMoney(fund) }), 'big');
  s.money = 0;
}
