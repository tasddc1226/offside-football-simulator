import { AUTHORIZATION_HEADER } from '@offside/contracts';
import { eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Context } from 'hono';
import { generateCookie, getCookie } from 'hono/cookie';
import type { Db } from '../db/client.js';
import { sha256Hex } from '../db/hash.js';
import { newId } from '../db/ids.js';
import { runBatch } from '../db/repos/batch.js';
import { createSession, type SessionChannel, type SessionRecord } from '../db/repos/sessions.js';
import { sessions } from '../db/schema.js';
import type { AppEnv } from '../env.js';

export const SESSION_COOKIE_NAME = 'offside_session';

/** 설계 결정 1: 만료는 발급 시각 + 365일 고정. */
const SESSION_MAX_AGE_SECONDS = 31536000;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function issueSession(
  db: Db,
  input: { profileId: string; channel: SessionChannel; now: string },
): Promise<{ token: string; session: SessionRecord }> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(
    new Date(input.now).getTime() + SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();
  const session = await createSession(db, {
    profileId: input.profileId,
    channel: input.channel,
    tokenHash,
    expiresAt,
  });
  return { token, session };
}

/** 인증 경계에서 기존 토큰 폐기와 새 web 세션 발급을 한 D1 batch로 묶는다. */
export async function prepareWebSessionRotation(
  db: Db,
  input: { oldSessionId: string; profileId: string; now: string },
): Promise<{ token: string; statements: [BatchItem<'sqlite'>, BatchItem<'sqlite'>] }> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(
    new Date(input.now).getTime() + SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();
  return {
    token,
    statements: [
      db.insert(sessions).values({
        id: newId('ses'),
        profileId: input.profileId,
        channel: 'web',
        tokenHash,
        createdAt: input.now,
        expiresAt,
        lastSeenAt: input.now,
      }),
      db.update(sessions).set({ revokedAt: input.now }).where(eq(sessions.id, input.oldSessionId)),
    ],
  };
}

export async function rotateWebSession(
  db: Db,
  input: { oldSessionId: string; profileId: string; now: string },
): Promise<string> {
  const prepared = await prepareWebSessionRotation(db, input);
  await runBatch(db, prepared.statements);
  return prepared.token;
}

/** 설계 결정 1의 쿠키 속성을 그대로 문자열로 만든다. */
export function sessionCookie(token: string): string {
  return generateCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** API-AUTH-004: `Max-Age=0`으로 브라우저가 즉시 쿠키를 지우게 한다. */
export function clearSessionCookie(): string {
  return generateCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  });
}

/** 설계 결정 3: Authorization 헤더가 있으면 쿠키를 보지 않는다. */
export function readSessionToken(c: Context<AppEnv>): string | undefined {
  const authHeader = c.req.header(AUTHORIZATION_HEADER);
  if (authHeader) {
    return /^Bearer\s+(.+)$/.exec(authHeader)?.[1];
  }
  return getCookie(c, SESSION_COOKIE_NAME);
}
