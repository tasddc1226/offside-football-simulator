import { z } from 'zod';

// T-11-360 출석 체크 API 모양. 규칙 · 보상 표는 zod 없는 attendance-rules.ts(`@offside/contracts/attendance`).

const Count = z.number().int().min(0);

/** GET /v1/attendance — 로그인한 구단주의 오늘 출석 상태. streak은 오늘 출석하면 이어질 기록(끊겼으면 0). */
export const AttendanceSchema = z.strictObject({
  /** 오늘(KST, YYYY-MM-DD). */
  today: z.string(),
  checkedIn: z.boolean(),
  /** 지금까지 찍은 도장 수(판을 넘어 누적). */
  stamps: Count,
  streak: Count,
  bestStreak: Count,
});
export type Attendance = z.infer<typeof AttendanceSchema>;

/** POST /v1/attendance/check-in — 출석한 뒤 상태와 이번 출석으로 받은 아이템. */
export const AttendanceCheckInResponseSchema = z.strictObject({
  attendance: AttendanceSchema,
  granted: z.strictObject({ reroll: Count, boost: Count, scout: Count, rename: Count }),
});
export type AttendanceCheckInResponse = z.infer<typeof AttendanceCheckInResponseSchema>;
