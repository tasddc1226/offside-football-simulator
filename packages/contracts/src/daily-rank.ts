// zod가 없는 서브패스(`@offside/contracts/daily-rank`) — T-11-723 오늘의 랭킹. 서버(목록 · 자정 확정)와 웹 · 앱 화면이 함께 쓴다.
// 오늘(한국 시각) 은퇴해 명예의 전당에 오른 선수를 레전드 점수로 줄 세운다. 로그인한 구단주의 선수만, 구단주마다 가장 높은
// 선수 한 명만 오른다. 자정에 1 · 2 · 3위를 굳혀 그 선수 카드에 표식을 남기고 아이템을 조금 준다.
import { DAY_MS, KST_MS, kstDay } from './kst.js';

/** 순위를 매기는 첫 날(한국 날짜). 그 전 날짜는 목록도 확정도 없다 — 기능을 알린 뒤에 은퇴한 선수부터 겨룬다. */
export const DAILY_RANK_FIRST_DAY = '2026-11-14';
/** 그 날짜에 순위를 매기는가. */
export const dailyRankOpen = (day: string): boolean => day >= DAILY_RANK_FIRST_DAY;

/** 목록에 보이는 순위 수. */
export const DAILY_RANK_LIMIT = 50;
/** 표식 · 아이템을 받는 순위 수. */
export const DAILY_RANK_WINNERS = 3;

/** 순위별 아이템(1위부터). 표식은 늘 받고, 아이템은 한 주(월~일, 한국 시각)에 한 번만 받는다. */
export const DAILY_RANK_REWARDS: readonly { scout: number; reroll: number }[] = [
  { scout: 1, reroll: 1 },
  { scout: 0, reroll: 1 },
  { scout: 0, reroll: 1 },
];

/** 한국 날짜(YYYY-MM-DD)가 시작하는 시각(UTC ISO). */
export const dailyRankStart = (day: string): string =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) - KST_MS).toISOString();

/** 그 날짜의 앞뒤 날짜(n일 뒤, 음수면 앞). */
export const dailyRankShift = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** 지금 시각의 오늘 · 어제(한국 날짜)와 오늘이 끝나는 시각. */
export function dailyRankDays(now: string): { today: string; yesterday: string; resetAt: string } {
  const today = kstDay(now);
  return {
    today,
    yesterday: dailyRankShift(today, -1),
    resetAt: dailyRankStart(dailyRankShift(today, 1)),
  };
}

/** 그 날짜가 든 주의 월요일(한국 날짜). 아이템을 한 주에 한 번만 주는 기준이다. */
export function dailyRankWeekStart(day: string): string {
  const dow = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return dailyRankShift(day, -((dow + 6) % 7));
}
