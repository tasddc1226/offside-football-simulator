// ───────── 웹 Sign in with Apple (T-11-202) ─────────
// 구글 웹 로그인과 같은 주소창 흐름이다: start가 state·nonce를 쿠키에 담아 Apple로 보내고, 콜백이 신원 토큰(JWT)을
// 서명·aud(Services ID)·nonce로 검증한 뒤 로그인 규칙(resolveAppleSignIn — 연결·전환)을 적용해 세션을 돌린다.
// Apple은 결과를 form_post(교차 사이트 POST)로 보내 Lax 쿠키(세션·state)가 실리지 않는다. 그래서 POST는 받은 값만
// 같은 주소의 GET으로 넘기고(303), 쿠키가 실리는 GET에서 검증한다.
import type { Hono } from 'hono';
import { verifyApple } from '../auth/apple-id-token.js';
import {
  APPLE_OAUTH_COOKIE,
  clearOauthCookie,
  decodeOauthCookieValue,
  encodeOauthCookieValue,
  generateOauthToken,
  oauthCookie,
  readOauthCookie,
} from '../auth/oauth-cookie.js';
import { rotateSession, sessionCookie } from '../auth/session.js';
import { sha256Hex } from '../db/hash.js';
import { tryAttempt } from '../db/repos/authAttempts.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { APPLE_WEB_CALLBACK_PATH } from '../middleware/originGuard.js';
import { resolveSession } from '../middleware/session.js';
import { resolveAppleSignIn } from '../profile/apple-link.js';
import { resolveRequestHostPair } from '../production-hosts.js';
import { isLocalEnv, settingsUrl } from './auth.js';
import { clientIp, nowIso } from './shared.js';

const APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';
/** 앱 애플 로그인과 같은 시간당 한도. */
const APPLE_WEB_START_RATE_LIMIT_MAX = 30;
/** 로컬 APPLE_FAKE=1이고 Services ID가 없으면 Apple 대신 이 가짜 토큰으로 바로 콜백한다(로컬 확인·e2e). */
const FAKE_WEB_TOKEN = 'fake:web-local';
/** form_post에서 GET으로 넘기는 값. code는 쓰지 않는다(신원 토큰만 검증). */
const FORWARD_FIELDS = ['state', 'id_token', 'error'] as const;

const unavailable = () =>
  new AppError({
    code: 'SERVICE_UNAVAILABLE',
    // i18n-ignore: 던지는 자리 원문(errorText.ts가 요청 언어로 옮긴다)
    message: '지금은 Apple 로그인을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.',
  });

export function registerAppleWebAuthRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/auth/apple/start', async (c) => {
    const hostPair = resolveRequestHostPair(c.req.url, c.env);
    if (hostPair === null) throw unavailable();
    const fail = (reason: string) =>
      c.redirect(settingsUrl(hostPair.webOrigin, { apple: 'error', reason }), 302);
    const session = await resolveSession(c);
    if (!session) return fail('session');
    const local = isLocalEnv(c.env);
    const clientId = c.env.APPLE_WEB_CLIENT_ID;
    const fake = local && c.env.APPLE_FAKE === '1' && !clientId;
    if (!clientId && !fake) return fail('unavailable');

    const now = nowIso();
    if (
      !(await tryAttempt(
        getDb(c),
        'APPLE_SIGNIN',
        clientIp(c),
        APPLE_WEB_START_RATE_LIMIT_MAX,
        now,
      ))
    ) {
      return fail('rate_limited');
    }
    const state = generateOauthToken();
    const nonce = generateOauthToken();
    c.header(
      'Set-Cookie',
      oauthCookie(encodeOauthCookieValue(state, nonce, session.id), local, APPLE_OAUTH_COOKIE),
    );
    const redirectUri = `${hostPair.apiOrigin}${APPLE_WEB_CALLBACK_PATH}`;
    if (fake) {
      return c.redirect(
        `${redirectUri}?${new URLSearchParams({ state, id_token: FAKE_WEB_TOKEN })}`,
        302,
      );
    }
    const url = new URL(APPLE_AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId!);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code id_token');
    url.searchParams.set('response_mode', 'form_post');
    url.searchParams.set('state', state);
    // 토큰에는 해시가 실리고 원래 값은 쿠키에만 있다 — 앱과 같은 nonce 규칙(verifyAppleIdToken).
    url.searchParams.set('nonce', await sha256Hex(nonce));
    return c.redirect(url.toString(), 302);
  });

  app.post(APPLE_WEB_CALLBACK_PATH, async (c) => {
    const form = await c.req.parseBody();
    const query = new URLSearchParams();
    for (const key of FORWARD_FIELDS) {
      const v = form[key];
      if (typeof v === 'string' && v.length <= 4096) query.set(key, v);
    }
    return c.redirect(`${APPLE_WEB_CALLBACK_PATH}?${query}`, 303);
  });

  app.get(APPLE_WEB_CALLBACK_PATH, async (c) => {
    const now = nowIso();
    const local = isLocalEnv(c.env);
    const hostPair = resolveRequestHostPair(c.req.url, c.env);
    if (hostPair === null) throw unavailable();
    const db = getDb(c);
    const back = (query: Record<string, string>, rotatedToken?: string): Response => {
      c.header('Set-Cookie', clearOauthCookie(local, APPLE_OAUTH_COOKIE));
      if (rotatedToken) c.header('Set-Cookie', sessionCookie(rotatedToken), { append: true });
      return c.redirect(settingsUrl(hostPair.webOrigin, query), 302);
    };

    const session = await resolveSession(c);
    const raw = readOauthCookie(c, APPLE_OAUTH_COOKIE);
    const decoded = raw !== undefined ? decodeOauthCookieValue(raw) : null;
    const state = c.req.query('state');
    if (
      !session ||
      !decoded ||
      !state ||
      decoded.state !== state ||
      decoded.sessionId !== session.id
    ) {
      return back({ apple: 'error', reason: 'state' });
    }
    // 사용자가 Apple 창에서 취소하면 user_cancelled_authorize가 온다.
    if (c.req.query('error')) return back({ apple: 'error', reason: 'cancelled' });
    const idToken = c.req.query('id_token');
    if (!idToken) return back({ apple: 'error', reason: 'exchange' });

    let sub: string;
    try {
      const audience = c.env.APPLE_WEB_CLIENT_ID;
      ({ sub } = await verifyApple(c.env, idToken, decoded.codeVerifier, audience));
    } catch {
      return back({ apple: 'error', reason: 'exchange' });
    }
    const outcome = await resolveAppleSignIn(db, {
      sub,
      currentProfileId: session.profileId,
      now,
    });
    const token = await rotateSession(db, {
      oldSessionId: session.id,
      profileId: outcome.profileId,
      now,
    });
    return back({ apple: outcome.kind }, token);
  });
}
