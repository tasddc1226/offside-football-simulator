// T-11-720 시즌 결산 광고 보너스. 앱의 시즌 결산 화면에서 보상형 광고를 끝까지 보면(광고 제거 · 멤버십은 바로) 선수 자금을
// 받는다. 시즌마다 한 번이고, 금액은 이번 계약 연봉의 비율(BAL.adSeasonBonus)이며 연봉이 없거나 적으면 하한(BAL.adSeasonBonusMin).
// 게임 RNG를 쓰지 않고, 고르지 않으면 커리어는 예전과 똑같이 흘러간다. 웹에는 보상형 광고가 없어 부르지 않는다.
import { BAL } from './balance.js';
import { fmtMoney } from './player.js';
import { gSeasonText as T } from './i18n/ko/gSeason.js';
import { addStat, log } from './stats.js';
import { salaryCost } from './training.js';
import type { GameState } from './types.js';

const flagOf = (year: number) => `adSeasonBonus${year}`;

/** year 시즌 결산 보너스 금액(만 원). 꺼져 있으면 0. */
export function seasonAdBonus(s: GameState): number {
  if (BAL.adSeasonBonus <= 0 && BAL.adSeasonBonusMin <= 0) return 0;
  return salaryCost(s, BAL.adSeasonBonus, BAL.adSeasonBonusMin);
}

/** 이 시즌 보너스를 아직 받을 수 있는지. */
export const canClaimSeasonAdBonus = (s: GameState, year: number): boolean =>
  !s.retired && !s.flags[flagOf(year)] && seasonAdBonus(s) > 0;

/** 보너스를 준다. 이미 받았거나 받을 수 없으면 0을 돌려주고 아무것도 바꾸지 않는다. */
export function claimSeasonAdBonus(s: GameState, year: number): number {
  if (!canClaimSeasonAdBonus(s, year)) return 0;
  const amount = seasonAdBonus(s);
  s.flags[flagOf(year)] = 1;
  addStat(s, 'money', amount);
  log(s, T.adBonusLog({ year, money: fmtMoney(amount) }));
  return amount;
}
