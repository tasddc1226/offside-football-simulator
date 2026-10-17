// T-11-360 출석 체크 1단계(docs/tracking/daily-attendance-plan.md). 로그인한 구단주가 하루(KST) 한 번 출석해 도장을 찍고
// 그 칸의 보상을 받는다(매일 리롤권, 정해진 칸은 강화권 · 스카우트권). 도장은 연속이 아니어도 쌓이고 ATTENDANCE_BOARD칸마다
// 새 판이 시작된다. 연속 출석은 표시만 하고, 한 주(월~일)에 하루까지 빠져도 이어진다.
// 서버(api attendance 지급)와 화면(도장판 · 다음 보상)이 같은 규칙을 쓰게 한 곳에 둔다. zod 없는 서브패스(`@offside/contracts/attendance`).
import type { OwnerItem } from './cup.js';

export type AttendanceReward = Partial<Record<OwnerItem, number>>;

/** 도장판 한 판의 칸 수. */
export const ATTENDANCE_BOARD = 28;

/** 매일 받는 기본 보상. */
export const ATTENDANCE_DAILY: AttendanceReward = { reroll: 1 };
/** 기본 보상 대신 주는 칸(1~ATTENDANCE_BOARD). 7 · 14 · 21 · 28칸이 큰 보상이다. */
export const ATTENDANCE_SPECIAL: Readonly<Record<number, AttendanceReward>> = {
  4: { boost: 1 },
  7: { boost: 2 },
  11: { boost: 1 },
  14: { scout: 1 },
  18: { boost: 1 },
  21: { boost: 3 },
  25: { boost: 1 },
  28: { scout: 2, boost: 3 },
};
/** 큰 보상 칸(도장판에서 강조한다). */
export const ATTENDANCE_BIG = [7, 14, 21, 28] as const;

/** 판 안의 칸(1~ATTENDANCE_BOARD)에 도장을 찍는 날 받는 보상. */
export const dayReward = (cell: number): AttendanceReward =>
  ATTENDANCE_SPECIAL[cell] ?? ATTENDANCE_DAILY;

/** 지금까지 찍은 도장 수 → 이번 판에서 채운 칸(0~ATTENDANCE_BOARD). 판을 다 채운 날은 ATTENDANCE_BOARD다. */
export const boardFilled = (stamps: number) =>
  stamps <= 0 ? 0 : ((stamps - 1) % ATTENDANCE_BOARD) + 1;

/** 다음에 찍을 칸(오늘 출석 전이면 오늘 칸, 출석했으면 내일 칸)과 그 칸의 보상. 판을 다 채웠으면 다음 판의 1칸이다. */
export function nextStamp(stamps: number): { cell: number; reward: AttendanceReward } {
  const cell = (boardFilled(stamps) % ATTENDANCE_BOARD) + 1;
  return { cell, reward: dayReward(cell) };
}

const dayNo = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;
const dayOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
/** 그 날짜(YYYY-MM-DD)가 든 주의 월요일. 1970-01-01은 목요일이다. */
export const weekOf = (day: string) => {
  const n = dayNo(day);
  return dayOf(n - ((n + 3) % 7));
};

export type StreakState = { lastDay: string | null; streak: number; graceWeek: string | null };

/** 빠진 날이 하루이고 그 주의 유예를 아직 안 썼으면 그 주(유예를 쓸 주), 아니면 null. */
function graceFor(s: StreakState, today: string): string | null {
  if (!s.lastDay || dayNo(today) - dayNo(s.lastDay) !== 2) return null;
  const week = weekOf(dayOf(dayNo(s.lastDay) + 1));
  return week === s.graceWeek ? null : week;
}

/** 오늘(아직 출석 전) 출석하면 연속 기록이 이어지는지. 오늘 이미 출석했으면 true. */
export function streakAlive(s: StreakState, today: string): boolean {
  if (!s.lastDay || s.streak <= 0) return false;
  const gap = dayNo(today) - dayNo(s.lastDay);
  return gap <= 1 || graceFor(s, today) !== null;
}

/** 오늘 출석한 뒤의 연속 기록. 끊겼으면 1부터 다시 센다. 빠진 하루를 유예로 메우면 graceWeek가 그 주가 된다. */
export function nextStreak(s: StreakState, today: string): Omit<StreakState, 'lastDay'> {
  const gap = s.lastDay ? dayNo(today) - dayNo(s.lastDay) : Infinity;
  if (gap === 1) return { streak: s.streak + 1, graceWeek: s.graceWeek };
  const grace = graceFor(s, today);
  if (grace && s.streak > 0) return { streak: s.streak + 1, graceWeek: grace };
  return { streak: 1, graceWeek: s.graceWeek };
}

/** 오늘 출석으로 받는 보상. stamps는 출석한 뒤의 값. */
export const checkInReward = (stamps: number): AttendanceReward => dayReward(boardFilled(stamps));
