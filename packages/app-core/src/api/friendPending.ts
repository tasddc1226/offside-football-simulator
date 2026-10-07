// T-11-142 받은 친구 신청 수 — 하단 '구단주' 탭 · 구단주 '내 팀' · 내 팀 '경기' 탭 · '친구' 버튼의 점. 첫 화면 번들에 들어가니
// 타입만 import한다. 구단주 화면(팀·친구)을 한 번이라도 연 기기만 묻는다 — 로그인하지 않은 방문자는 요청하지 않는다.
import type { FriendPendingResponse } from '@offside/contracts';
import { storage } from '@offside/game/storage';
import { cachedGet, hasSessionHint, invalidateApiCache, type ApiResult } from './client.js';

const OWNER_HINT = 'ft_owner';
const PATH = '/v1/friends/pending';
/** 앱을 다시 열 때마다 부르지 않게 5분 메모. */
export const FRIEND_PENDING_MS = 5 * 60_000;

function ownerHint() {
  try {
    return storage().getItem(OWNER_HINT) === '1';
  } catch {
    return false;
  }
}
/** 구단주 표시를 남기거나(팀·친구를 불러옴) 지운다(로그인 필요 · 로그아웃). 그대로면 쓰지 않는다. */
export function noteOwner(on: boolean) {
  if (ownerHint() === on) return;
  try {
    storage().setItem(OWNER_HINT, on ? '1' : '0');
  } catch {
    // 저장소를 못 쓰면 점을 띄우지 않는다.
  }
}

/** 구단주 화면 응답(팀·친구)을 보고 표시를 남긴 뒤 그대로 돌려준다. */
export async function withOwnerHint<T>(p: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const r = await p;
  if (r.ok) noteOwner(true);
  else if (r.error.reason === 'GOOGLE_LOGIN_REQUIRED') noteOwner(false);
  return r;
}

let last = 0;
/** 받은 신청 수. 구단주가 아닌 기기·실패면 0. fresh면 메모를 비우고 다시 받는다(푸시를 받았을 때). 수가 바뀌면 친구 목록 메모도
 *  비운다 — 점을 따라 들어간 친구 화면이 신청 전 목록을 보이지 않게. */
export async function pendingFriendRequests(fresh = false): Promise<number> {
  if (!hasSessionHint() || !ownerHint()) return 0;
  if (fresh) invalidateApiCache(PATH);
  const r = await cachedGet<FriendPendingResponse>(PATH, FRIEND_PENDING_MS);
  const n = r.ok ? r.data.received : 0;
  // '/v1/friends' 아래 메모(이 조회 포함)를 함께 비운다 — 수가 바뀔 때만이라 다음 확인에서 한 번 더 받는 정도다.
  if (r.ok && n !== last) invalidateApiCache('/v1/friends');
  last = n;
  return n;
}
