// ───────── 구글 로그인 ─────────
// 시작(startGoogleLogin), 로그인 뒤 돌아올 곳 기억, OAuth 콜백(/settings?google=linked|switched|error) 처리.
import type { BoardKey } from '@offside/contracts/board-limits';
import { getProfile, googleStartUrl } from '@offside/app-core/api/client';
import { loginOfflineText, googleFailText, loginDoneText } from '@offside/app-core/loginText';
import { loadHOF } from '@offside/game/hof-store';
import { toast } from './helpers.js';
import { currentInApp, showInAppLoginNotice } from './inapp-open.js';
import { openFriends, pendingInvite } from './friendInvite.svelte.js';
import { openLocalLegend } from './legend.js';
import { openBoard } from './nav.js';
import { appState } from './state.svelte.js';

/** 로그인을 마치고 돌아와 다시 열 곳. T-10-028 소식 글(댓글), T-10-029 내 은퇴 선수(공유), T-11-015 채팅. */
type LoginReturn = { board: BoardKey; postId: string | null } | { career: string } | { chat: true };
const LOGIN_RETURN_KEY = 'ft_board_return';
/** null이면 기록을 지운다(설정에서 로그인할 때). */
function rememberLoginReturn(to: LoginReturn | null) {
  try {
    if (to) sessionStorage.setItem(LOGIN_RETURN_KEY, JSON.stringify(to));
    else sessionStorage.removeItem(LOGIN_RETURN_KEY);
  } catch {
    // 저장소를 못 쓰면 평소처럼 설정 화면으로 돌아온다.
  }
}
function takeLoginReturn(): LoginReturn | null {
  try {
    const raw = sessionStorage.getItem(LOGIN_RETURN_KEY);
    sessionStorage.removeItem(LOGIN_RETURN_KEY);
    return raw ? (JSON.parse(raw) as LoginReturn) : null;
  } catch {
    return null;
  }
}
/** 구글 로그인을 시작한다. 로그인은 프로필 세션이 있어야 시작된다 — 없으면 GET /v1/profile이 익명
 * 프로필을 만든다. */
export async function startGoogleLogin(back: LoginReturn | null) {
  // T-10-115 인앱 브라우저에서는 구글이 로그인을 막는다(403 disallowed_useragent) — 구글로 보내지 않고 안내한다.
  const inApp = currentInApp();
  if (inApp) return showInAppLoginNotice(inApp);
  rememberLoginReturn(back);
  if (!(await getProfile()).ok) return toast(loginOfflineText());
  window.location.assign(googleStartUrl());
}
export function handleOAuthReturn() {
  const url = new URL(window.location.href);
  const google = url.searchParams.get('google');
  if (!google) return;
  const reason = url.searchParams.get('reason');
  toast(
    google === 'linked' || google === 'switched'
      ? loginDoneText(google, '구글')
      : googleFailText(reason),
  );
  window.history.replaceState({}, '', '/');
  const back = takeLoginReturn();
  if (back && google !== 'error') {
    if ('board' in back) return openBoard(back.board, back.postId);
    if ('chat' in back) return void (appState.screen = 'chat');
    // 은퇴 화면에서 로그인했으면 그 선수의 상세로 돌아온다.
    const h = loadHOF().find((x) => x.id === back.career);
    if (h) return openLocalLegend(h);
  }
  // T-11-098 친구 초대 링크로 들어와 로그인했으면 친구 화면으로 돌아가 신청을 마저 보낸다.
  if (google !== 'error' && pendingInvite()) return openFriends();
  // 계정 패널이 구단주 화면에 있으므로, 로그인을 마치고 돌아오면 구단주 화면을 연다.
  appState.screen = 'owner';
}
