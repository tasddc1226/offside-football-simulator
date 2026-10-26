import { AttendanceCheckInResponseSchema, AttendanceSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import { MEMBER_ATTENDANCE_MULT } from '@offside/contracts/membership';
import { attendanceOf, checkIn } from '../db/repos/attendance.js';
import { isMember } from '../db/repos/memberships.js';
import { getDb, type AppEnv } from '../env.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, nowIso, ok } from './shared.js';

// T-11-360 출석 체크 1단계. 로그인한 구단주만(아니면 403 GOOGLE_LOGIN_REQUIRED) 하루(KST) 한 번 출석한다. 조회는 PK 한 번이고
// 홈을 열 때 구단주 표시가 있는 기기만 부른다. 출석은 재시도가 두 번 받지 않게 멱등 키를 쓴다(요약 줄 비교가 최종 방어선).
export function registerAttendanceRoutes(app: Hono<AppEnv>) {
  app.get('/v1/attendance', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    const [attendance, member] = await Promise.all([
      attendanceOf(db, me.id, now),
      isMember(db, me.id, now),
    ]);
    return ok(c, AttendanceSchema, { ...attendance, member }, 200, NO_STORE);
  });

  app.post('/v1/attendance/check-in', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const now = nowIso();
    // T-11-512 클럽 멤버십 구독 중이면 이번 출석 보상을 2배로 준다.
    const member = await isMember(db, me.id, now);
    const done = await checkIn(db, me.id, now, member ? MEMBER_ATTENDANCE_MULT : 1);
    if (!done) throw conflictError(cupKo('attendanceChecked'), 'ATTENDANCE_CHECKED');
    return ok(
      c,
      AttendanceCheckInResponseSchema,
      { ...done, attendance: { ...done.attendance, member } },
      200,
      NO_STORE,
    );
  });
}
