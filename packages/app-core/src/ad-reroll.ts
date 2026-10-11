// T-11-154 광고 보고 후보 다시 뽑기(앱 전용). 리롤권(서버)과 따로, 보상형 광고를 끝까지 보면 리롤권 없이 바로 후보를 다시 뽑는다.
// 하루(한국 시간) 횟수는 이 기기에만 센다 — 후보 뽑기가 기기에서 일어나고 서버는 광고 시청을 확인할 수 없어서다.
// 광고 보상은 하루 2번, 구단 자금 구매는 기본 하루 3장이다. 보유 리롤권 사용에는 하루 5회 제한이 없다.
import { kstDay } from '@offside/contracts/kst';

export const AD_REROLL_DAILY = 2;

type AdRerollLog = { day: string; n: number };

function parse(raw: string | null | undefined): AdRerollLog | null {
  try {
    const v = JSON.parse(raw ?? '') as Partial<AdRerollLog>;
    return typeof v.day === 'string' && Number.isInteger(v.n) ? { day: v.day, n: v.n! } : null;
  } catch {
    return null;
  }
}

/** 오늘 남은 횟수. 기록이 없거나 다른 날이면 하루치 전부. */
export function adRerollsLeft(raw: string | null | undefined, now = new Date()): number {
  const log = parse(raw);
  const used = log && log.day === kstDay(now.toISOString()) ? log.n : 0;
  return Math.max(0, AD_REROLL_DAILY - used);
}

/** 한 번 쓴 뒤 저장할 값. */
export function spendAdReroll(raw: string | null | undefined, now = new Date()): string {
  const n = AD_REROLL_DAILY - adRerollsLeft(raw, now) + 1;
  return JSON.stringify({ day: kstDay(now.toISOString()), n });
}
