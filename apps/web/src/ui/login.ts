// ───────── 구글 로그인 ─────────
// 시작(startGoogleLogin), 로그인 뒤 돌아올 곳 기억, OAuth 콜백(/settings?google=linked|switched|error) 처리.
import type { BoardKey } from '@offside/contracts/board-limits';
import { getProfile, googleStartUrl } from '@offside/app-core/api/client';
import { loadHOF } from '@offside/game/season';
import { toast } from './helpers.js';
import { currentInApp, showInAppLoginNotice } from './inapp-open.js';
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
  if (!(await getProfile()).ok)
    return toast('서버에 연결하지 못해 로그인을 시작하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
  window.location.assign(googleStartUrl());
}
/** 로그인 시작(/v1/auth/google/start)이 설정 화면으로 돌려보낸 이유별 안내. */
const FAIL_MSG: Record<string, string> = {
  session: '로그인 준비가 끝나지 않았어요. 구글로 로그인을 한 번 더 눌러 주세요.',
  rate_limited: '로그인 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
  unavailable: '지금은 구글 로그인을 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요.',
};
export function handleOAuthReturn() {
  const url = new URL(window.location.href);
  const google = url.searchParams.get('google');
  if (!google) return;
  const reason = url.searchParams.get('reason');
  const msg =
    google === 'linked'
      ? '구글 계정을 연결했습니다.'
      : google === 'switched'
        ? '다른 구글 계정으로 전환했습니다.'
        : ((reason && FAIL_MSG[reason]) ??
          `구글 로그인에 실패했습니다${reason ? ` (${reason})` : ''}.`);
  toast(msg);
  window.history.replaceState({}, '', '/');
  const back = takeLoginReturn();
  if (back && google !== 'error') {
    if ('board' in back) return openBoard(back.board, back.postId);
    if ('chat' in back) return void (appState.screen = 'chat');
    // 은퇴 화면에서 로그인했으면 그 선수의 상세로 돌아온다.
    const h = loadHOF().find((x) => x.id === back.career);
    if (h) return openLocalLegend(h);
  }
  // 계정 패널이 구단주 화면에 있으므로, 로그인을 마치고 돌아오면 구단주 화면을 연다.
  appState.screen = 'owner';
}
