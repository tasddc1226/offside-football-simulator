import type { Hono } from 'hono';
import {
  clearOauthCookie,
  decodeOauthCookieValue,
  encodeOauthCookieValue,
  generateOauthToken,
  oauthCookie,
  readOauthCookie,
} from '../auth/oauth-cookie.js';
import { selectGoogleOidc, verifiedGoogleEmail } from '../auth/google-oidc.js';
import { clearSessionCookie, rotateWebSession, sessionCookie } from '../auth/session.js';
import { insertAuditLog } from '../db/repos/auditLog.js';
import { getAttemptCount, recordAttempt } from '../db/repos/authAttempts.js';
import { unlinkGoogleAccount } from '../db/repos/profiles.js';
import { revokeSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveGoogleCallback } from '../profile/google-link.js';
import { resolveRequestHostPair } from '../production-hosts.js';

/** D-21: 시간당 30회. `auth_attempts`의 시간 윈도는 RATE_LIMIT_WINDOW_MS(1시간)를 그대로 쓴다. */
const GOOGLE_START_RATE_LIMIT_MAX = 30;

function isLocalEnv(env: { ENVIRONMENT: string }): boolean {
  return env.ENVIRONMENT === 'local';
}

export function registerAuthRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/auth/logout', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const now = new Date().toISOString();

    await revokeSession(db, session.id, now);

    // ADR-008: web 채널은 쿠키를 제거한다. toss(Bearer) 채널은 토큰 폐기만으로 충분하다.
    if (session.channel === 'web') {
      c.header('Set-Cookie', clearSessionCookie());
    }

    return c.body(null, 204);
  });

  app.get('/v1/auth/google/start', requireProfile, async (c) => {
    const hostPair = resolveRequestHostPair(c.req.url, c.env);
    const oidc = hostPair === null ? null : selectGoogleOidc({
      ...c.env,
      GOOGLE_REDIRECT_URI: hostPair.googleRedirectUri,
    });
    if (oidc === null) {
      throw new AppError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Google 로그인을 사용할 수 없습니다.',
      });
    }

    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const now = new Date().toISOString();
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

    const attempts = await getAttemptCount(db, 'GOOGLE_START', ip, now);
    if (attempts >= GOOGLE_START_RATE_LIMIT_MAX) {
      throw new AppError({
        code: 'RATE_LIMITED',
        message: 'Google 연결 시도 횟수를 초과했습니다.',
      });
    }
    await recordAttempt(db, 'GOOGLE_START', ip, now);

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
    const now = new Date().toISOString();
    const local = isLocalEnv(c.env);
    const hostPair = resolveRequestHostPair(c.req.url, c.env);
    if (hostPair === null) {
      throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: 'Google 로그인을 사용할 수 없습니다.' });
    }
    const callbackWebOrigin = hostPair.webOrigin;

    function redirectToSettings(query: Record<string, string>, rotatedToken?: string): Response {
      c.header('Set-Cookie', clearOauthCookie(local));
      if (rotatedToken) c.header('Set-Cookie', sessionCookie(rotatedToken), { append: true });
      const url = new URL('/settings', callbackWebOrigin);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
      return c.redirect(url.toString(), 302);
    }

    const session = c.get('session');
    if (!session) return redirectToSettings({ google: 'error', reason: 'state' });
    const db = getDb(c);

    const cookieValue = readOauthCookie(c);
    const decoded = cookieValue !== undefined ? decodeOauthCookieValue(cookieValue) : null;
    const queryState = c.req.query('state');
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

    const oidc = selectGoogleOidc({
      ...c.env,
      GOOGLE_REDIRECT_URI: hostPair.googleRedirectUri,
    });
    if (oidc === null) {
      return redirectToSettings({ google: 'error', reason: 'exchange' });
    }

    let claims: { sub: string; email: string | null; emailVerified: boolean };
    try {
      claims = await oidc.exchangeCode(code, decoded.codeVerifier);
    } catch {
      return redirectToSettings({ google: 'error', reason: 'exchange' });
    }

    const outcome = await resolveGoogleCallback(db, {
      sub: claims.sub,
      email: verifiedGoogleEmail(claims),
      currentProfileId: session.profileId,
      sessionId: session.id,
      now,
    });

    if (outcome.kind === 'linked') {
      const token = await rotateWebSession(db, {
        oldSessionId: session.id,
        profileId: session.profileId,
        now,
      });
      return redirectToSettings({ google: 'linked' }, token);
    }
    const token = await rotateWebSession(db, {
      oldSessionId: session.id,
      profileId: outcome.profileId,
      now,
    });
    return redirectToSettings({ google: 'switched' }, token);
  });

  app.post('/v1/auth/google/unlink', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const now = new Date().toISOString();

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
