import { generateCookie, getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { AppEnv } from '../env.js';

/** D-21: `state`·PKCE `codeVerifier`를 담는 10분짜리 쿠키. 서버 저장소는 두지 않는다. */
export const OAUTH_COOKIE_NAME = 'offside_oauth';
export const OAUTH_COOKIE_PATH = '/v1/auth/google';
const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;
const DELIMITER = '.';

/** `state`·`codeVerifier`는 둘 다 base64url이라 `.`을 구분자로 써도 안전하다. */
export function encodeOauthCookieValue(state: string, codeVerifier: string): string {
  return `${state}${DELIMITER}${codeVerifier}`;
}

export function decodeOauthCookieValue(value: string): { state: string; codeVerifier: string } | null {
  const index = value.indexOf(DELIMITER);
  if (index <= 0 || index === value.length - 1) return null;
  return { state: value.slice(0, index), codeVerifier: value.slice(index + 1) };
}

/** 로컬(http)에서는 Secure를 뺀다 — 그 외 환경은 항상 Secure다. */
export function oauthCookie(value: string, isLocal: boolean): string {
  return generateCookie(OAUTH_COOKIE_NAME, value, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'Lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearOauthCookie(isLocal: boolean): string {
  return generateCookie(OAUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'Lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: 0,
  });
}

export function readOauthCookie(c: Context<AppEnv>): string | undefined {
  return getCookie(c, OAUTH_COOKIE_NAME);
}

/** `state`·PKCE `codeVerifier` 생성에 쓴다. `auth/session.ts`의 세션 토큰과 같은 32바이트 base64url 방식. */
export function generateOauthToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
