// ───────── 앱 로그인 (T-11-003) ─────────
// 구글: 시스템 브라우저 인증 세션으로 웹과 같은 구글 로그인을 거쳐 offside://auth로 돌아오고, 받은 티켓을 PKCE
// verifier와 함께 새 앱 세션 토큰으로 바꾼다. 애플: Sign in with Apple(iOS) 신원 토큰을 서버가 검증해 새 토큰을 준다.
// 로그인을 마치면 back이 가리키는 곳(소식 글·은퇴 선수)으로, 없으면 구단주 화면으로 간다(웹 login.ts와 같다).
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { BoardKey } from '@offside/contracts/board-limits';
import { apiFetch, clearApiCache } from '@offside/app-core/api/client';
import { flushOutbox } from '@offside/app-core/outbox';
import { googleFailText, loginDoneText, loginOfflineText } from '@offside/app-core/loginText';
import { loadHOF } from '@offside/game/hof-store';
import { appState } from '../store';
import { openLocalLegend, refreshAccount, syncClubCustom, toast } from '../game/host';
import { openBoard } from '../game/nav';
import { ensureSession, setSessionToken } from './session';
import { accountText as L } from '@offside/app-core/i18n/ko/account';

/** 로그인을 마치고 돌아가 다시 열 곳. 소식 글(댓글) · 내 은퇴 선수(공유). */
export type LoginReturn =
  | { board: BoardKey; postId: string | null }
  | { career: string }
  /** T-11-015 채팅 화면에서 로그인했으면 채팅으로 돌아온다. */
  | { chat: true }
  /** 이적시장 매물을 보다 로그인했으면 이적시장으로 돌아온다. */
  | { market: true }
  | { cup: true };

/** API가 구글 로그인을 마치고 돌려보내는 주소(contracts APP_AUTH_REDIRECT_URL). */
const REDIRECT_URL = 'offside://auth';

type AuthResult = { token: string; result: 'linked' | 'switched' };

const b64url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function randomToken(): string {
  const bytes = Crypto.getRandomBytes(32);
  return b64url(btoa(String.fromCharCode(...bytes)));
}

let busy = false;

export async function startGoogleLogin(back: LoginReturn | null): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    if (!(await ensureSession())) return toast(loginOfflineText());
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
    if (!start.ok) return toast(loginOfflineText());
    const res = await WebBrowser.openAuthSessionAsync(start.data.url, REDIRECT_URL);
    if (res.type !== 'success') return;
    const q = Linking.parse(res.url).queryParams ?? {};
    const google = typeof q.google === 'string' ? q.google : 'error';
    const ticket = typeof q.ticket === 'string' ? q.ticket : null;
    if (google === 'error' || !ticket) {
      const reason = typeof q.reason === 'string' ? q.reason : '';
      return toast(googleFailText(reason));
    }
    const ex = await apiFetch<AuthResult>('/v1/auth/app/exchange', {
      method: 'POST',
      body: JSON.stringify({ ticket, verifier }),
    });
    if (!ex.ok) return toast(L.googleFinishFail);
    await finishLogin(ex.data, back, L.viaGoogle);
  } finally {
    busy = false;
  }
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

export async function startAppleLogin(back: LoginReturn | null): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    if (!(await ensureSession())) return toast(loginOfflineText());
    // Apple에는 nonce의 SHA-256(hex)을 넘기고, 서버에는 원문을 보내 토큰의 nonce와 맞춰 보게 한다(재전송 방지).
    const nonce = randomToken();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    let identityToken: string | null;
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [], nonce: hashed });
      identityToken = cred.identityToken;
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      return toast(L.appleStartFail);
    }
    if (!identityToken) return toast(L.appleStartFail);
    const r = await apiFetch<AuthResult>('/v1/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, nonce }),
    });
    if (!r.ok) return toast(L.appleFinishFail);
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
  void flushOutbox();
  if (back) {
    if ('board' in back) return openBoard(back.board, back.postId);
    if ('chat' in back) return void (appState.screen = 'chat');
    if ('market' in back) return void (appState.screen = 'market');
    if ('cup' in back) return void (appState.screen = 'cup');
    const h = loadHOF().find((x) => x.id === back.career);
    if (h) return openLocalLegend(h);
  }
  appState.screen = 'owner';
}
