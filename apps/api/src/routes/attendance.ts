import {
  AttendanceAdBonusResponseSchema,
  AttendanceCheckInResponseSchema,
  AttendanceSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import { attendanceOf, checkIn, claimAttendanceAdBonus } from '../db/repos/attendance.js';
import { isMember } from '../db/repos/memberships.js';
import { getDb, type AppEnv } from '../env.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from '../middleware/requireOwner.js';
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
    // T-11-512 클럽 멤버십 구독 중이면 이번 출석 보상을 2배로, T-11-517 잠재력 강화권 1장을 더 준다.
    const member = await isMember(db, me.id, now);
    const done = await checkIn(db, me.id, now, member);
    if (!done) throw conflictError(cupKo('attendanceChecked'), 'ATTENDANCE_CHECKED');
    return ok(
      c,
      AttendanceCheckInResponseSchema,
      { ...done, attendance: { ...done.attendance, member } },
      200,
      NO_STORE,
    );
  });

  // T-11-720 앱에서 보상형 광고를 끝까지 본 뒤 부른다. 광고 시청을 서버가 확인하지는 않는다(하루 한 번 · 그날 칸 기본 보상까지라
  // 따로 부르는 이득이 광고를 보는 것과 같다). 멤버십 여부는 묻지 않는다(멤버는 앱이 광고 없이 바로 부른다).
  app.post('/v1/attendance/ad-bonus', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const r = await claimAttendanceAdBonus(getDb(c), me.id, nowIso());
    if (r === 'not-checked')
      throw conflictError(cupKo('attendanceAdNotChecked'), 'ATTENDANCE_NOT_CHECKED');
    if (r === 'taken') throw conflictError(cupKo('attendanceAdTaken'), 'ATTENDANCE_AD_TAKEN');
    return ok(c, AttendanceAdBonusResponseSchema, r, 200, NO_STORE);
  });
}
