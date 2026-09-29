// ───────── 네이티브 앱 로그인 (T-11-003) ─────────
// 앱은 쿠키 대신 Bearer 토큰(channel 'app')을 쓴다. 첫 실행에 익명 세션을 받고(POST /v1/app/session),
// 구글은 시스템 브라우저로 로그인한 뒤 티켓을 교환하고, 애플은 기기의 identityToken을 바로 보낸다.
// 두 로그인 모두 끝나면 세션을 돌려(옛 토큰 폐기) 새 토큰을 준다 — 웹의 쿠키 회전과 같다.
import {
  AppAuthExchangeBodySchema,
  AppAuthResultSchema,
  AppGoogleStartBodySchema,
  AppGoogleStartResponseSchema,
  AppleSignInBodySchema,
  AppSessionResponseSchema,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { appleVerifier } from '../auth/apple-id-token.js';
import { selectGoogleOidc } from '../auth/google-oidc.js';
import { generateOauthToken } from '../auth/oauth-cookie.js';
import { issueSession, rotateSession } from '../auth/session.js';
import { consumeTicket, createAppAuthTicket, findLiveTicket } from '../db/repos/appAuthTickets.js';
import { getAttemptCount, recordAttempt, type AuthAttemptKind } from '../db/repos/authAttempts.js';
import { createProfile } from '../db/repos/profiles.js';
import { getDb, type AppEnv, type SessionContext } from '../env.js';
import { AppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveAppleSignIn } from '../profile/apple-link.js';
import { resolveRequestHostPair } from '../production-hosts.js';
import { nowIso, ok, readBody } from './shared.js';

/** IP당 시간당 — 앱 설치·재설치 한 번에 한 세션이면 넉넉하다. */
const APP_SESSION_RATE_LIMIT_MAX = 20;
const APPLE_SIGNIN_RATE_LIMIT_MAX = 30;

async function limitByIp(c: Context<AppEnv>, kind: AuthAttemptKind, max: number, now: string) {
  const db = getDb(c);
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  if ((await getAttemptCount(db, kind, ip, now)) >= max) {
    throw new AppError({ code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요.' });
  }
  await recordAttempt(db, kind, ip, now);
}

const loginFailed = (reason: string) =>
  new AppError({
    code: 'VALIDATION_FAILED',
    message: '로그인을 마치지 못했어요.',
    details: { reason },
  });

/** 앱(Bearer) 세션만 — 웹 세션은 쿠키로 도는 웹 로그인을 쓴다. */
function appSession(c: Context<AppEnv>): SessionContext {
  const session = getSessionOrThrow(c);
  if (session.channel !== 'app') {
    throw new AppError({ code: 'FORBIDDEN', message: '앱에서만 쓸 수 있어요.' });
  }
  return session;
}

/** PKCE S256: base64url(SHA-256(verifier)). */
async function s256(verifier: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  );
  let binary = '';
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function registerAppAuthRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/app/session', async (c) => {
    const now = nowIso();
    await limitByIp(c, 'APP_SESSION', APP_SESSION_RATE_LIMIT_MAX, now);
    const db = getDb(c);
    const profile = await createProfile(db);
    const { token } = await issueSession(db, { profileId: profile.id, channel: 'app', now });
    return ok(c, AppSessionResponseSchema, { token });
  });

  app.post('/v1/auth/app/google', requireProfile, async (c) => {
    const session = appSession(c);
    const { challenge } = readBody(c, AppGoogleStartBodySchema);
    const hostPair = resolveRequestHostPair(c.req.url, c.env);
    const oidc =
      hostPair && selectGoogleOidc({ ...c.env, GOOGLE_REDIRECT_URI: hostPair.googleRedirectUri });
    if (!oidc) {
      throw new AppError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Google 로그인을 사용할 수 없습니다.',
      });
    }
    const ticket = generateOauthToken();
    await createAppAuthTicket(getDb(c), {
      id: ticket,
      sessionId: session.id,
      challenge,
      now: nowIso(),
    });
    const url = new URL('/v1/auth/google/start', c.req.url);
    url.searchParams.set('ticket', ticket);
    return ok(c, AppGoogleStartResponseSchema, { url: url.toString() });
  });

  app.post('/v1/auth/app/exchange', requireProfile, async (c) => {
    const session = appSession(c);
    const body = readBody(c, AppAuthExchangeBodySchema);
    const db = getDb(c);
    const now = nowIso();
    const ticket = await findLiveTicket(db, body.ticket, now, false);
    // 티켓을 만든 세션만, 그 세션이 가진 verifier로만 바꿀 수 있다 — 스킴 주소를 가로채도 쓸 수 없다.
    if (
      !ticket ||
      ticket.sessionId !== session.id ||
      ticket.challenge !== (await s256(body.verifier))
    ) {
      throw loginFailed('ticket');
    }
    if (ticket.outcome === null || ticket.outcome === 'error' || ticket.outcomeProfileId === null) {
      throw loginFailed(ticket.reason ?? 'error');
    }
    if (!(await consumeTicket(db, ticket.id, now))) throw loginFailed('ticket');
    const token = await rotateSession(db, {
      oldSessionId: session.id,
      profileId: ticket.outcomeProfileId,
      now,
      channel: 'app',
    });
    return ok(c, AppAuthResultSchema, { token, result: ticket.outcome });
  });

  app.post('/v1/auth/apple', requireProfile, async (c) => {
    const session = appSession(c);
    const body = readBody(c, AppleSignInBodySchema);
    const now = nowIso();
    await limitByIp(c, 'APPLE_SIGNIN', APPLE_SIGNIN_RATE_LIMIT_MAX, now);
    let claims;
    try {
      claims = await appleVerifier(c.env)(body.identityToken, body.nonce);
    } catch {
      throw loginFailed('apple_token');
    }
    const db = getDb(c);
    const outcome = await resolveAppleSignIn(db, {
      sub: claims.sub,
      currentProfileId: session.profileId,
      now,
    });
    const token = await rotateSession(db, {
      oldSessionId: session.id,
      profileId: outcome.kind === 'linked' ? session.profileId : outcome.profileId,
      now,
      channel: 'app',
    });
    return ok(c, AppAuthResultSchema, { token, result: outcome.kind });
  });
}
