// ───────── 앱 로그인 (T-11-003) ─────────
// 구글: 시스템 브라우저 인증 세션으로 웹과 같은 구글 로그인을 거쳐 offside://auth로 돌아오고, 받은 티켓을 PKCE
// verifier와 함께 새 앱 세션 토큰으로 바꾼다. 애플: Sign in with Apple(iOS) 신원 토큰을 서버가 검증해 새 토큰을 준다.
// 로그인을 마치면 back이 가리키는 곳(소식 글·은퇴 선수)으로, 없으면 구단주 화면으로 간다(웹 login.ts와 같다).
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { BoardKey } from '@offside/contracts/board-limits';
import { apiFetch, clearApiCache } from '@offside/app-core/api/client';
import { flushOutbox } from '@offside/app-core/outbox';
import { googleFailText, loginDoneText, loginOfflineText } from '@offside/app-core/loginText';
import type { LoginOutcome, LoginPlace, LoginProvider } from '@offside/app-core/funnelEvents';
import { loadHOF } from '@offside/game/hof-store';
import { hofStart } from '@offside/app-core/state';
import { trackFunnel } from '../analytics';
import { appState } from '../store';
import {
  openLocalLegend,
  refreshAccount,
  syncClubCustom,
  syncCompCustom,
  toast,
} from '../game/host';
import { openBoard } from '../game/nav';
import { ensureSession, setSessionToken } from './session';
import { onAuthReturn } from './authReturn';
import { accountText as L } from '@offside/app-core/i18n/ko/account';

/** 로그인을 마치고 돌아가 다시 열 곳. 소식 글(댓글) · 내 은퇴 선수(공유). */
export type LoginReturn =
  | { board: BoardKey; postId: string | null }
  | { career: string }
  /** T-11-015 채팅 화면에서 로그인했으면 채팅으로 돌아온다. */
  | { chat: true }
  /** 이적시장 매물을 보다 로그인했으면 이적시장으로 돌아온다. */
  | { market: true }
  | { cup: true }
  /** T-11-418 리그 화면에서 로그인했으면 리그로 돌아온다. */
  | { league: true }
  /** T-11-290 팀 프로필(스쿼드 댓글)에서 로그인했으면 그 팀 프로필로 돌아온다. */
  | { team: string }
  /** T-11-360 홈 출석 체크에서 로그인했으면 홈으로 돌아와 바로 출석한다. */
  | { home: true };

/** API가 구글 로그인을 마치고 돌려보내는 주소(contracts APP_AUTH_REDIRECT_URL). */
const REDIRECT_URL = 'offside://auth';

type AuthResult = { token: string; result: 'linked' | 'switched' };

const b64url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function randomToken(): string {
  const bytes = Crypto.getRandomBytes(32);
  return b64url(btoa(String.fromCharCode(...bytes)));
}

let busy = false;

/** T-11-792 로그인 시도 계측. 누른 곳 · 제공자 · 결과만 보낸다(서버 사유는 funnelEvents가 허용 목록으로 접는다). */
const track =
  (place: LoginPlace, provider: LoginProvider) => (outcome: LoginOutcome, reason?: unknown) =>
    trackFunnel({ kind: 'login', outcome, place, provider, reason });

/**
 * T-11-846 브라우저로 떠나기 전에 남기는 로그인 기록. 브라우저에 가 있는 동안 앱이 종료되거나(Android) 로그인을 마치기 전에 앱으로
 * 먼저 돌아오면 인증 세션이 끝나 버려, 나중에 온 복귀 주소를 받을 곳이 없었다(안내 없이 끝남). 기록이 있으면 그 주소로 마저 로그인한다.
 * verifier는 PKCE 확인값이라 기기 보안 저장소에 둔다. 오래된 기록은 쓰지 않는다.
 */
type PendingGoogle = { verifier: string; back: LoginReturn | null; place: LoginPlace; at: number };
const PENDING_KEY = 'ft_google_pending';
const PENDING_TTL_MS = 15 * 60 * 1000;
const savePending = (p: PendingGoogle) =>
  SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(p)).catch(() => {});
const clearPending = () => SecureStore.deleteItemAsync(PENDING_KEY).catch(() => {});
async function takePending(): Promise<PendingGoogle | null> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    await clearPending();
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingGoogle;
    return typeof p.verifier === 'string' && Date.now() - p.at < PENDING_TTL_MS ? p : null;
  } catch {
    return null;
  }
}

/** 복귀 주소(offside://auth?google=…&ticket=…)를 새 세션으로 바꾸고 돌아갈 곳을 연다. 인증 세션과 늦게 온 주소가 같이 쓴다. */
async function finishGoogle(
  url: string,
  verifier: string,
  back: LoginReturn | null,
  t: ReturnType<typeof track>,
) {
  const q = Linking.parse(url).queryParams ?? {};
  const google = typeof q.google === 'string' ? q.google : 'error';
  const ticket = typeof q.ticket === 'string' ? q.ticket : null;
  if (google === 'error' || !ticket) {
    const reason = typeof q.reason === 'string' ? q.reason : '';
    if (reason === 'cancelled') t('cancel');
    else t('fail', reason);
    return toast(googleFailText(reason));
  }
  const ex = await apiFetch<AuthResult>('/v1/auth/app/exchange', {
    method: 'POST',
    body: JSON.stringify({ ticket, verifier }),
  });
  if (!ex.ok) {
    t('fail', 'finish');
    return toast(L.googleFinishFail);
  }
  t(ex.data.result);
  await finishLogin(ex.data, back, L.viaGoogle);
}

export async function startGoogleLogin(back: LoginReturn | null, place: LoginPlace): Promise<void> {
  if (busy) return;
  busy = true;
  const t = track(place, 'google');
  t('start');
  try {
    if (!(await ensureSession())) {
      t('fail', 'offline');
      return toast(loginOfflineText());
    }
    const verifier = randomToken();
    const challenge = b64url(
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
        encoding: Crypto.CryptoEncoding.BASE64,
      }),
    );
    const start = await apiFetch<{ url: string }>('/v1/auth/app/google', {
      method: 'POST',
      body: JSON.stringify({ challenge }),
    });
    if (!start.ok) {
      t('fail', 'start');
      return toast(loginOfflineText());
    }
    await savePending({ verifier, back, place, at: Date.now() });
    let res: WebBrowser.WebBrowserAuthSessionResult;
    try {
      res = await WebBrowser.openAuthSessionAsync(start.data.url, REDIRECT_URL);
    } catch {
      // T-11-796 로그인 창을 열지 못했다(브라우저가 없는 기기, 이미 열린 로그인 창 등). 안내도 끝 이벤트도 없이 끝나던 경우다.
      await clearPending();
      t('fail', 'provider');
      return toast(L.googleFinishFail);
    }
    if (res.type !== 'success') {
      // T-11-846 Android는 로그인을 마치기 전에 앱으로 돌아오면 dismiss다. 기록은 남겨 두어 브라우저에서 마저 마치면 이어서
      // 받고, 창이 닫혔다는 것을 알린다. iOS의 cancel은 사용자가 닫은 것이라 기록을 지우고 조용히 끝낸다.
      if (Platform.OS === 'android' && res.type === 'dismiss') toast(L.googleNotFinished);
      else await clearPending();
      return t('cancel');
    }
    await clearPending();
    await finishGoogle(res.url, verifier, back, t);
  } finally {
    busy = false;
  }
}

/**
 * T-11-846 인증 세션 밖에서 온 복귀 주소(앱 재시작 · 먼저 돌아온 뒤 마친 로그인)를 받는다. 로그인이 진행 중이면(busy) 인증 세션이
 * 같은 주소를 받으므로 건너뛴다. 남긴 기록이 없거나 오래됐으면(15분) 아무것도 하지 않는다.
 */
async function completeAuthReturn(url: string) {
  if (busy) return;
  busy = true;
  try {
    // 기록이 없으면 인증 세션이 이미 처리한 주소다(Android는 정상 로그인에서도 이 주소가 여기로 한 번 더 온다). 조용히 넘긴다.
    const p = await takePending();
    if (!p) return;
    await finishGoogle(url, p.verifier, p.back, track(p.place, 'google'));
  } finally {
    busy = false;
  }
}

/** 앱 첫 화면이 뜬 뒤 부른다(로그인을 마치면 화면을 옮기므로). */
export function startAuthReturns() {
  onAuthReturn((url) => void completeAuthReturn(url));
}

/** 이 기기에서 Sign in with Apple을 쓸 수 있는가(iOS 13+). */
export async function appleLoginAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * T-11-167 계정 삭제 직전 Apple에 다시 확인받아 authorizationCode를 받는다(서버가 Apple 토큰을 해지한다,
 * 가이드라인 5.1.1(v)). 사용자가 취소하면 'cancel', 이 기기에서 못 쓰거나 실패하면 null(삭제는 그대로 진행).
 */
export async function appleReauthCode(): Promise<string | null | 'cancel'> {
  if (!(await appleLoginAvailable())) return null;
  try {
    const cred = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return cred.authorizationCode ?? null;
  } catch (e) {
    return (e as { code?: string }).code === 'ERR_REQUEST_CANCELED' ? 'cancel' : null;
  }
}

export async function startAppleLogin(back: LoginReturn | null, place: LoginPlace): Promise<void> {
  if (busy) return;
  busy = true;
  const t = track(place, 'apple');
  t('start');
  try {
    if (!(await ensureSession())) {
      t('fail', 'offline');
      return toast(loginOfflineText());
    }
    // Apple에는 nonce의 SHA-256(hex)을 넘기고, 서버에는 원문을 보내 토큰의 nonce와 맞춰 보게 한다(재전송 방지).
    const nonce = randomToken();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    let identityToken: string | null;
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [], nonce: hashed });
      identityToken = cred.identityToken;
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return t('cancel');
      t('fail', 'provider');
      return toast(L.appleStartFail);
    }
    if (!identityToken) {
      t('fail', 'token');
      return toast(L.appleStartFail);
    }
    const r = await apiFetch<AuthResult>('/v1/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, nonce }),
    });
    if (!r.ok) {
      t('fail', 'finish');
      return toast(L.appleFinishFail);
    }
    t(r.data.result);
    await finishLogin(r.data, back, L.viaApple);
  } finally {
    busy = false;
  }
}

/** 새 토큰으로 바꾸고 계정·서버 데이터를 다시 맞춘 뒤 돌아갈 곳을 연다(웹은 페이지를 다시 읽어 이 일을 한다). */
async function finishLogin(r: AuthResult, back: LoginReturn | null, via: string) {
  await setSessionToken(r.token);
  clearApiCache();
  toast(loginDoneText(r.result, via));
  await refreshAccount();
  void syncClubCustom().catch(() => {});
  void syncCompCustom().catch(() => {});
  void flushOutbox();
  if (back) {
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
    const h = loadHOF().find((x) => x.id === back.career);
    if (h) return openLocalLegend(h);
  }
  appState.screen = 'owner';
}
