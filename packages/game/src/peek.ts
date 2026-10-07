// ───────── T-11-133 잠재력 평가 구매(웹) ─────────
// 앱은 보상형 광고로 이번 시즌 스카우트 평가를 열고(app-core potential-peek), 광고가 없는 웹은 자금을 낸다.
// 비용 = max(1,000만, 연봉 × 0.35) — 잠재력 강화 첫 단계(boost.ts max(2,000만, 연봉 × 0.7))의 절반.
// 자금과 소식만 바꾼다. 연 기록(커리어 id + 시즌)은 세이브가 아니라 기기에 둔다.
import { fmtMoney } from './player.js';
import { log, potScouted } from './stats.js';
import { salaryCost } from './training.js';
import type { GameState } from './types.js';
import { gPeekText as PT } from './i18n/ko/gPeek.js';

/** 웹에서 여는 비용(만 원, 10 단위). */
export const peekCost = (s: GameState): number => salaryCost(s, 0.35, 1000);

/** 자금이 모자라 살 수 없다. */
export const peekShort = (s: GameState): boolean => s.money < peekCost(s);

/** 자금을 내고 산다. 살 수 없으면(첫 시즌 전 · 자금 부족) false, 상태를 바꾸지 않는다. */
export function buyPeek(s: GameState): boolean {
  if (!potScouted(s) || peekShort(s)) return false;
  const cost = peekCost(s);
  s.money -= cost;
  log(s, PT.paid({ cost: fmtMoney(cost) }));
  return true;
}
