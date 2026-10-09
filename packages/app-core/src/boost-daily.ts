// T-11-157 잠재력 강화의 하루 횟수(웹 · 앱 공용). 광고(광고 제거 구매자의 바로 받기 포함)와 구단 자금으로 받은 강화를 합쳐
// 하루(한국 시각)에 상한(rewardDailyCap)까지 센다. 구단 자금 횟수는 서버(GET /v1/items/rewards의 bought)가, 광고 횟수는
// 서버가 광고 시청을 확인할 수 없어 이 기기가 센다. 상한이 0이면 구단 자금을 받지 않고 광고만 횟수 없이 받는다.
import type { RewardShopResponse } from '@offside/contracts';
import { kstDay } from '@offside/contracts/kst';
import { latestBalance } from '@offside/game/balance';

type DayCount = { day: string; n: number };

function parse(raw: string | null | undefined): DayCount | null {
  try {
    const v = JSON.parse(raw ?? '') as Partial<DayCount>;
    return typeof v.day === 'string' && Number.isInteger(v.n) ? { day: v.day, n: v.n! } : null;
  } catch {
    return null;
  }
}

/** 오늘 광고로 받은 강화 횟수. 기록이 없거나 다른 날이면 0. */
export function adBoostsToday(raw: string | null | undefined, now = new Date()): number {
  const v = parse(raw);
  return v && v.day === kstDay(now.toISOString()) ? v.n : 0;
}

/** 광고로 한 번 받은 뒤 저장할 값. */
export function spendAdBoost(raw: string | null | undefined, now = new Date()): string {
  return JSON.stringify({ day: kstDay(now.toISOString()), n: adBoostsToday(raw, now) + 1 });
}

/**
 * 오늘 광고 · 구단 자금으로 더 받을 수 있는 강화 횟수. shop이 없으면(로그인 안 함 · 웹) 구단 자금 횟수는 0으로 보고 상한은
 * 최신 밸런스 값을 쓴다. 상한이 0이면 Infinity(광고는 횟수 없이 받는다).
 */
export function boostDayLeft(
  adRaw: string | null | undefined,
  shop: RewardShopResponse | null,
  now = new Date(),
): number {
  const cap = shop?.offers.boost.cap ?? latestBalance().values.rewardDailyCap;
  if (cap <= 0) return Infinity;
  return Math.max(0, cap - (shop?.offers.boost.bought ?? 0) - adBoostsToday(adRaw, now));
}
