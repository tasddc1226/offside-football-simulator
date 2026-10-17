// T-11-360 홈 출석 체크. 서버는 로그인한 구단주만 부른다 — 세션이 없거나 로그인하지 않은 것으로 확인된 기기는 묻지 않고 로그인을
// 권하는 카드를 띄운다. 구단주인지 모르는 기기는 한 번 묻고 답(403이면 비로그인)을 구단주 표시로 남긴다(홈 선물과 같다). 5분 메모.
import type { Attendance, AttendanceCheckInResponse } from '@offside/contracts';
import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import { kstDay } from '@offside/contracts/kst';
import {
  apiFetch,
  hasSessionHint,
  invalidateApiCache,
  ownerCachedGet,
  type ApiResult,
} from './client.js';
import { ownerHintState, withOwnerHint } from './friendPending.js';

const PATH = '/v1/attendance';

/** 홈 출석 카드: 구단주면 오늘 출석 상태, 로그인하지 않은 기기면 로그인을 권하는 카드. 실패하면 null(카드를 숨긴다). */
export type AttendanceCard = { kind: 'owner'; att: Attendance } | { kind: 'guest' };

const ask = () => withOwnerHint(ownerCachedGet<Attendance>(PATH, 5 * 60_000));

/** 세션이 없거나 로그인하지 않은 것으로 확인된 기기는 묻지 않고 guest. 메모가 어제 것이면(자정을 넘겨 홈에 머문 경우) 다시 받는다. */
export async function fetchAttendance(): Promise<AttendanceCard | null> {
  if (!hasSessionHint() || ownerHintState() === false) return { kind: 'guest' };
  let r = await ask();
  if (r.ok && r.data.today !== kstDay(new Date().toISOString())) {
    invalidateApiCache(PATH);
    r = await ask();
  }
  if (r.ok) return { kind: 'owner', att: r.data };
  return r.error.reason === 'GOOGLE_LOGIN_REQUIRED' ? { kind: 'guest' } : null;
}

/** 출석하기. key는 한 번의 누름마다 하나(응답을 못 받아 다시 누르면 같은 키로 보내 두 번 받지 않는다). */
export function checkInAttendance(key: string): Promise<ApiResult<AttendanceCheckInResponse>> {
  return apiFetch<AttendanceCheckInResponse>(`${PATH}/check-in`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
  });
}
