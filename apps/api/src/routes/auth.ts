import { APP_AUTH_REDIRECT_URL } from '@offside/contracts';
import type { Hono } from 'hono';
import { nowIso } from './shared.js';
import {
  clearOauthCookie,
  decodeOauthCookieValue,
  encodeOauthCookieValue,
  generateOauthToken,
  oauthCookie,
  readOauthCookie,
} from '../auth/oauth-cookie.js';
import { selectGoogleOidc, verifiedGoogleEmail } from '../auth/google-oidc.js';
import { clearSessionCookie, rotateSession, sessionCookie } from '../auth/session.js';
import type { Db } from '../db/client.js';
import { findLiveTicket, setTicketOutcome } from '../db/repos/appAuthTickets.js';
import { insertAuditLog } from '../db/repos/auditLog.js';
import { getAttemptCount, recordAttempt } from '../db/repos/authAttempts.js';
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
const GOOGLE_START_RATE_LIMIT_MAX = 30;

function isLocalEnv(env: { ENVIRONMENT: string }): boolean {
  return env.ENVIRONMENT === 'local';
}

/** T-11-003 앱 로그인 결과는 앱 스킴으로 돌려보낸다. */
function appAuthUrl(query: Record<string, string>): string {
  return `${APP_AUTH_REDIRECT_URL}?${new URLSearchParams(query).toString()}`;
}

/** 앱 로그인 티켓이 가리키는 세션 — 결과가 아직 없는(콜백 전) 살아 있는 티켓만. */
async function ticketSession(
  db: Db,
  ticket: string,
  now: string,
): Promise<{ id: string; profileId: string } | undefined> {
  const row = await findLiveTicket(db, ticket, now, true);
  return row && { id: row.sessionId, profileId: row.profileId };
}

/** 구글 로그인은 주소창으로 오가므로 결과·오류를 JSON 대신 웹 설정 화면의 쿼리로 돌려준다. */
function settingsUrl(webOrigin: string, query: Record<string, string>): string {
  const url = new URL('/settings', webOrigin);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
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
        message: 'Google 로그인을 사용할 수 없습니다.',
      });
    }
    // T-11-003 앱은 시스템 브라우저로 이 주소를 열고(`?ticket=`), 세션은 쿠키 대신 티켓이 가리킨다.
    const ticket = c.req.query('ticket');
    // 주소창으로 여는 경로라 실패는 JSON 대신 설정 화면(앱이면 앱)으로 돌려보낸다. 세션이 없으면(로그아웃 직후의 옛
    // 화면 등) 설정 화면이 GET /v1/profile로 새 익명 세션을 받으므로 다시 누르면 시작된다.
    const fail = (reason: string) =>
      c.redirect(
        ticket !== undefined
          ? appAuthUrl({ google: 'error', reason })
          : settingsUrl(hostPair.webOrigin, { google: 'error', reason }),
        302,
      );
    const db = getDb(c);
    const now = nowIso();
    const session =
      ticket !== undefined ? await ticketSession(db, ticket, now) : await resolveSession(c);
    if (!session) return fail('session');
    const oidc = selectGoogleOidc({ ...c.env, GOOGLE_REDIRECT_URI: hostPair.googleRedirectUri });
    if (oidc === null) return fail('unavailable');

    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

    const attempts = await getAttemptCount(db, 'GOOGLE_START', ip, now);
    if (attempts >= GOOGLE_START_RATE_LIMIT_MAX) return fail('rate_limited');
    await recordAttempt(db, 'GOOGLE_START', ip, now);

    const state = generateOauthToken();
    const codeVerifier = generateOauthToken();
    const authUrl = oidc.createAuthorizationUrl(state, codeVerifier);

    c.header(
      'Set-Cookie',
      oauthCookie(
        encodeOauthCookieValue(state, codeVerifier, session.id, ticket),
        isLocalEnv(c.env),
      ),
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
        message: 'Google 로그인을 사용할 수 없습니다.',
      });
    }
    const callbackWebOrigin = hostPair.webOrigin;
    const db = getDb(c);

    const cookieValue = readOauthCookie(c);
    const decoded = cookieValue !== undefined ? decodeOauthCookieValue(cookieValue) : null;
    const ticket = decoded?.ticket;

    function finish(query: Record<string, string>, rotatedToken?: string): Response {
      c.header('Set-Cookie', clearOauthCookie(local));
      // 앱 로그인은 세션을 여기서 돌리지 않는다 — 앱이 티켓을 교환할 때 새 토큰을 받는다.
      if (ticket !== undefined) return c.redirect(appAuthUrl({ ...query, ticket }), 302);
      if (rotatedToken) c.header('Set-Cookie', sessionCookie(rotatedToken), { append: true });
      return c.redirect(settingsUrl(callbackWebOrigin, query), 302);
    }

    const session =
      ticket !== undefined ? await ticketSession(db, ticket, now) : await resolveSession(c);
    if (!session) return finish({ google: 'error', reason: 'state' });

    const queryState = c.req.query('state');
    const code = c.req.query('code');

    if (
      decoded === null ||
      queryState === undefined ||
      decoded.state !== queryState ||
      decoded.sessionId !== session.id
    ) {
      return finish({ google: 'error', reason: 'state' });
    }
    if (c.req.query('error') === 'access_denied') {
      return finish({ google: 'error', reason: 'cancelled' });
    }
    if (code === undefined) {
      return finish({ google: 'error', reason: 'exchange' });
    }

    const oidc = selectGoogleOidc({
      ...c.env,
      GOOGLE_REDIRECT_URI: hostPair.googleRedirectUri,
    });
    if (oidc === null) {
      return finish({ google: 'error', reason: 'exchange' });
    }

    let claims: { sub: string; email: string | null; emailVerified: boolean };
    try {
      claims = await oidc.exchangeCode(code, decoded.codeVerifier);
    } catch {
      return finish({ google: 'error', reason: 'exchange' });
    }

    const outcome = await resolveGoogleCallback(db, {
      sub: claims.sub,
      email: verifiedGoogleEmail(claims),
      currentProfileId: session.profileId,
      sessionId: session.id,
      now,
    });
    const profileId = outcome.kind === 'linked' ? session.profileId : outcome.profileId;

    if (ticket !== undefined) {
      await setTicketOutcome(db, ticket, { kind: outcome.kind, profileId });
      return finish({ google: outcome.kind });
    }
    const token = await rotateSession(db, { oldSessionId: session.id, profileId, now });
    return finish({ google: outcome.kind }, token);
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
