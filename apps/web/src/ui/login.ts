// ───────── 구글 · Apple 로그인 ─────────
// 시작(startGoogleLogin · startAppleLogin), 로그인 뒤 돌아올 곳 기억, OAuth 콜백(/settings?google|apple=linked|switched|error) 처리.
import type { BoardKey } from '@offside/contracts/board-limits';
import { appleStartUrl, getProfile, googleStartUrl } from '@offside/app-core/api/client';
import { noteOwner } from '@offside/app-core/api/friendPending';
import {
  appleFailText,
  loginOfflineText,
  googleFailText,
  loginDoneText,
} from '@offside/app-core/loginText';
import {
  LOGIN_PLACES,
  type LoginOutcome,
  type LoginPlace,
  type LoginProvider,
} from '@offside/app-core/funnelEvents';
import { loadHOF } from '@offside/game/hof-store';
import { toast } from './helpers.js';
import { currentInApp, showInAppLoginNotice } from './inapp-open.js';
import { openFriends, pendingInvite } from './friendInvite.svelte.js';
import { openLocalLegend } from './legend.js';
import { openBoard } from './nav.js';
import { appState, hofStart } from './state.svelte.js';
import { prepareAcquisitionOAuth } from '../analytics/acquisition.js';
import { clearOAuthCampaign } from '../analytics/oauth-campaign.js';
import { trackFunnel } from '../analytics/index.js';

/** 로그인을 마치고 돌아와 다시 열 곳. T-10-028 소식 글(댓글), T-10-029 내 은퇴 선수(공유), T-11-015 채팅. */
export type LoginReturn =
  | { board: BoardKey; postId: string | null }
  | { career: string }
  | { chat: true }
  | { market: true }
  | { cup: true }
  /** T-11-418 리그 화면에서 로그인했으면 리그 화면으로 돌아온다. */
  | { league: true }
  /** T-11-290 팀 프로필(스쿼드 댓글)에서 로그인했으면 그 팀 프로필로 돌아온다. */
  | { team: string }
  /** T-11-360 홈 출석 체크에서 로그인했으면 홈으로 돌아와 바로 출석한다. */
  | { home: true };
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
// T-11-781 로그인 시도 계측. 로그인하러 페이지를 떠났다 돌아오므로 누른 곳을 탭 저장소에 적어 두고 돌아와서 읽는다.
const LOGIN_PLACE_KEY = 'ft_login_place';
const track = (
  outcome: LoginOutcome,
  place: LoginPlace,
  provider: LoginProvider,
  reason?: unknown,
) => trackFunnel({ kind: 'login', outcome, place, provider, reason });
function rememberLoginPlace(place: LoginPlace) {
  try {
    sessionStorage.setItem(LOGIN_PLACE_KEY, place);
  } catch {
    // 저장소를 못 쓰면 돌아온 뒤의 결과는 place=other로 남는다.
  }
}
/** 적어 둔 곳. 없거나 허용 목록 밖이면 other. */
function takeLoginPlace(): LoginPlace {
  try {
    const raw = sessionStorage.getItem(LOGIN_PLACE_KEY);
    sessionStorage.removeItem(LOGIN_PLACE_KEY);
    return LOGIN_PLACES.find((x) => x === raw) ?? 'other';
  } catch {
    return 'other';
  }
}
/** 구글 로그인을 시작한다. 로그인은 프로필 세션이 있어야 시작된다 — 없으면 GET /v1/profile이 익명
 * 프로필을 만든다. */
export async function startGoogleLogin(back: LoginReturn | null, place: LoginPlace) {
  clearOAuthCampaign();
  track('start', place, 'google');
  // T-10-115 인앱 브라우저에서는 구글이 로그인을 막는다(403 disallowed_useragent) — 구글로 보내지 않고 안내한다.
  const inApp = currentInApp();
  if (inApp) {
    track('fail', place, 'google', 'inapp');
    return showInAppLoginNotice(inApp);
  }
  rememberLoginReturn(back);
  const me = await getProfile();
  if (!me.ok) {
    track('fail', place, 'google', 'offline');
    return toast(loginOfflineText());
  }
  rememberLoginPlace(place);
  await prepareAcquisitionOAuth('google', me.data.id);
  window.location.assign(googleStartUrl());
}
/** T-11-204 Apple 로그인을 시작한다(주소창으로 Apple에 갔다가 /settings?apple=...로 돌아온다). */
export async function startAppleLogin(back: LoginReturn | null, place: LoginPlace) {
  clearOAuthCampaign();
  track('start', place, 'apple');
  rememberLoginReturn(back);
  const me = await getProfile();
  if (!me.ok) {
    track('fail', place, 'apple', 'offline');
    return toast(loginOfflineText());
  }
  rememberLoginPlace(place);
  await prepareAcquisitionOAuth('apple', me.data.id);
  window.location.assign(appleStartUrl());
}
export function handleOAuthReturn() {
  const url = new URL(window.location.href);
  const apple = url.searchParams.get('apple');
  const google = url.searchParams.get('google') ?? apple;
  if (!google) return;
  const reason = url.searchParams.get('reason');
  // T-11-781 주소의 결과 값은 정해진 넷만 읽는다(그 밖은 실패). 취소는 실패와 따로 센다.
  track(
    google === 'linked' || google === 'switched'
      ? google
      : reason === 'cancelled'
        ? 'cancel'
        : 'fail',
    takeLoginPlace(),
    apple ? 'apple' : 'google',
    reason,
  );
  toast(
    google === 'linked' || google === 'switched'
      ? loginDoneText(google, apple ? 'Apple' : '구글')
      : apple
        ? appleFailText(reason)
        : googleFailText(reason),
  );
  // 주소만 정리하고 화면 기록(history.svelte.ts)의 상태는 남긴다 — 지우면 다음 탭 이동이 홈으로 튄다(T-11-567).
  window.history.replaceState(window.history.state, '', '/');
  // T-11-360 로그인에 성공했으면 구단주 표시를 남긴다(홈 카드가 구단주 화면을 거치지 않고 바로 출석 상태를 묻게).
  if (google !== 'error') noteOwner(true);
  const back = takeLoginReturn();
  if (back && google !== 'error') {
    if ('board' in back) return openBoard(back.board, back.postId);
    if ('chat' in back) return void (appState.screen = 'chat');
    if ('market' in back) return void (appState.screen = 'market');
    if ('cup' in back) return void (appState.screen = 'cup');
    if ('league' in back) return void (appState.screen = 'league');
    if ('home' in back) return void (appState.screen = 'home');
    if ('team' in back) {
      appState.hof = { ...hofStart(), tab: 'teams', team: back.team };
      return void (appState.screen = 'hof');
    }
    // 은퇴 화면에서 로그인했으면 그 선수의 상세로 돌아온다.
    const h = loadHOF().find((x) => x.id === back.career);
    if (h) return openLocalLegend(h);
  }
  // T-11-098 친구 초대 링크로 들어와 로그인했으면 친구 화면으로 돌아가 신청을 마저 보낸다.
  if (google !== 'error' && pendingInvite()) return openFriends();
  // 로그인하면 내 팀 · 이적시장이 열리는 구단주 화면으로 돌아온다(계정 패널은 T-11-567부터 설정 화면).
  appState.screen = 'owner';
}
