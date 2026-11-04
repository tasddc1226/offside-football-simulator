import { APP_AUTH_REDIRECT_URL } from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { clientIp, nowIso } from './shared.js';
import {
  clearOauthCookie,
  decodeOauthCookieValue,
  encodeOauthCookieValue,
  generateOauthToken,
  oauthCookie,
  readOauthCookie,
} from '../auth/oauth-cookie.js';
import { selectGoogleOidc, verifiedGoogleEmail } from '../auth/google-oidc.js';
import { randomToken } from '../auth/base64url.js';
import { clearSessionCookie, rotateSession, sessionCookie } from '../auth/session.js';
import {
  completeTicket,
  findPendingTicket,
  type AppAuthTicket,
} from '../db/repos/appAuthTickets.js';
import { insertAuditLog } from '../db/repos/auditLog.js';
import { tryAttempt } from '../db/repos/authAttempts.js';
import { unlinkGoogleAccount } from '../db/repos/profiles.js';
import { revokeSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { resolveGoogleCallback } from '../profile/google-link.js';
import { resolveRequestHostPair } from '../production-hosts.js';

/** D-21: 시간당 30회. `auth_attempts`의 시간 윈도는 RATE_LIMIT_WINDOW_MS(1시간)를 그대로 쓴다. */
export const GOOGLE_START_RATE_LIMIT_MAX = 30;

export function isLocalEnv(env: { ENVIRONMENT: string }): boolean {
  return env.ENVIRONMENT === 'local';
}

/** 구글 로그인은 주소창으로 오가므로 결과·오류를 JSON 대신 웹 설정 화면의 쿼리로 돌려준다. */
export function settingsUrl(webOrigin: string, query: Record<string, string>): string {
  const url = new URL('/settings', webOrigin);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

/** 구글 인가 코드를 토큰으로 바꿔 계정을 확인한다. 교환 실패면 null. 웹·앱 콜백이 함께 쓴다. */
async function googleAccount(
  c: Context<AppEnv>,
  input: { code: string; codeVerifier: string; redirectUri: string },
): Promise<{ sub: string; email: string | null } | null> {
  const oidc = selectGoogleOidc({ ...c.env, GOOGLE_REDIRECT_URI: input.redirectUri });
  if (oidc === null) return null;
  try {
    const claims = await oidc.exchangeCode(input.code, input.codeVerifier);
    return { sub: claims.sub, email: verifiedGoogleEmail(claims) };
  } catch {
    return null;
  }
}

/**
 * T-11-003 앱 로그인 콜백. 쿠키 대신 state로 찾은 티켓이 verifier를 준다. 이 브라우저가 티켓을 만든 기기인지 알 수 없으므로
 * 여기서는 구글 계정만 적고 티켓 id를 새 값으로 바꿔 앱 스킴으로 돌려보낸다. 연결 · 전환과 새 토큰은 그 값을 받은 앱이
 * 교환할 때 처리한다(T-11-635).
 */
async function appGoogleCallback(
  c: Context<AppEnv>,
  ticket: AppAuthTicket,
  redirectUri: string,
): Promise<Response> {
  const back = (query: Record<string, string>) =>
    c.redirect(`${APP_AUTH_REDIRECT_URL}?${new URLSearchParams(query).toString()}`, 302);
  if (c.req.query('error') === 'access_denied')
    return back({ google: 'error', reason: 'cancelled' });
  const code = c.req.query('code');
  const account =
    code === undefined
      ? null
      : await googleAccount(c, { code, codeVerifier: ticket.codeVerifier, redirectUri });
  if (!account) return back({ google: 'error', reason: 'exchange' });
  const nextId = randomToken();
  const done = await completeTicket(getDb(c), {
    id: ticket.id,
    nextId,
    googleSub: account.sub,
    googleEmail: account.email,
  });
  if (!done) return back({ google: 'error', reason: 'exchange' });
  return back({ google: 'ok', ticket: nextId });
}

export function registerAuthRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/auth/logout', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const now = nowIso();

    await revokeSession(db, session.id, now);

    // ADR-008: web 채널은 쿠키를 제거한다. toss(Bearer) 채널은 토큰 폐기만으로 충분하다.
    if (session.channel === 'web') {
      c.header('Set-Cookie', clearSessionCookie());
    }

    return c.body(null, 204);
  });

  app.get('/v1/auth/google/start', async (c) => {
    const hostPair = resolveRequestHostPair(c.req.url, c.env);
    if (hostPair === null) {
      throw new AppError({
        code: 'SERVICE_UNAVAILABLE',
        message: '지금은 구글 로그인을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.',
      });
    }
    // 주소창으로 여는 경로라 실패는 JSON 대신 설정 화면으로 돌려보낸다. 세션이 없으면(로그아웃 직후의 옛 화면
    // 등) 설정 화면이 GET /v1/profile로 새 익명 세션을 받으므로 다시 누르면 시작된다.
    const fail = (reason: string) =>
      c.redirect(settingsUrl(hostPair.webOrigin, { google: 'error', reason }), 302);
    const session = await resolveSession(c);
    if (!session) return fail('session');
    const oidc = selectGoogleOidc({ ...c.env, GOOGLE_REDIRECT_URI: hostPair.googleRedirectUri });
    if (oidc === null) return fail('unavailable');

    const db = getDb(c);
    const now = nowIso();
    if (!(await tryAttempt(db, 'GOOGLE_START', clientIp(c), GOOGLE_START_RATE_LIMIT_MAX, now))) {
      return fail('rate_limited');
    }

    const state = generateOauthToken();
    const codeVerifier = generateOauthToken();
    const authUrl = oidc.createAuthorizationUrl(state, codeVerifier);

    c.header(
      'Set-Cookie',
      oauthCookie(encodeOauthCookieValue(state, codeVerifier, session.id), isLocalEnv(c.env)),
    );
    return c.redirect(authUrl.toString(), 302);
  });

  app.get('/v1/auth/google/callback', async (c) => {
    const now = nowIso();
    const local = isLocalEnv(c.env);
    const hostPair = resolveRequestHostPair(c.req.url, c.env);
    if (hostPair === null) {
      throw new AppError({
        code: 'SERVICE_UNAVAILABLE',
        message: '지금은 구글 로그인을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.',
      });
    }
    const callbackWebOrigin = hostPair.webOrigin;
    const db = getDb(c);

    // T-11-003 앱 로그인이면 state가 앱 티켓이다.
    const queryState = c.req.query('state');
    const ticket = queryState ? await findPendingTicket(db, queryState, now) : undefined;
    if (ticket) return appGoogleCallback(c, ticket, hostPair.googleRedirectUri);

    function redirectToSettings(query: Record<string, string>, rotatedToken?: string): Response {
      c.header('Set-Cookie', clearOauthCookie(local));
      if (rotatedToken) c.header('Set-Cookie', sessionCookie(rotatedToken), { append: true });
      return c.redirect(settingsUrl(callbackWebOrigin, query), 302);
    }

    const session = await resolveSession(c);
    if (!session) return redirectToSettings({ google: 'error', reason: 'state' });

    const cookieValue = readOauthCookie(c);
    const decoded = cookieValue !== undefined ? decodeOauthCookieValue(cookieValue) : null;
    const code = c.req.query('code');

    if (
      decoded === null ||
      queryState === undefined ||
      decoded.state !== queryState ||
      decoded.sessionId !== session.id
    ) {
      return redirectToSettings({ google: 'error', reason: 'state' });
    }
    if (c.req.query('error') === 'access_denied') {
      return redirectToSettings({ google: 'error', reason: 'cancelled' });
    }
    if (code === undefined) {
      return redirectToSettings({ google: 'error', reason: 'exchange' });
    }

    const account = await googleAccount(c, {
      code,
      codeVerifier: decoded.codeVerifier,
      redirectUri: hostPair.googleRedirectUri,
    });
    if (!account) return redirectToSettings({ google: 'error', reason: 'exchange' });
    const outcome = await resolveGoogleCallback(db, {
      sub: account.sub,
      email: account.email,
      currentProfileId: session.profileId,
      sessionId: session.id,
      now,
    });
    const token = await rotateSession(db, {
      oldSessionId: session.id,
      profileId: outcome.profileId,
      now,
    });
    return redirectToSettings({ google: outcome.kind }, token);
  });

  app.post('/v1/auth/google/unlink', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const now = nowIso();

    await unlinkGoogleAccount(db, session.profileId);
    await insertAuditLog(db, {
      kind: 'GOOGLE_UNLINKED',
      profileId: session.profileId,
      payload: {},
      createdAt: now,
    });

    return c.body(null, 204);
  });
}
