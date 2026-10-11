// ───────── Sign in with Apple 신원 토큰 검증 (T-11-003) ─────────
// 앱이 받은 identityToken(JWT, RS256)을 Apple 공개키(JWKS)로 서명 검증하고 iss·aud·exp·nonce를 본다.
// 구글과 달리 토큰이 앱을 거쳐 오므로(전송 계층이 신뢰 근거가 아니다) 서명을 반드시 검증한다.
import { sha256Hex } from '../db/hash.js';
import type { Bindings } from '../env.js';
import { base64UrlToBytes } from './base64url.js';

export const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
export const DEFAULT_BUNDLE_ID = 'com.offsidelab.app';
const JWKS_TTL_MS = 60 * 60 * 1000;
const FAKE_PREFIX = 'fake:';

export type AppleJwk = JsonWebKey & { kid: string };
export type AppleClaims = { sub: string; email: string | null };

let jwksCache: { keys: Promise<AppleJwk[]>; until: number } | null = null;

/** Apple 공개키 목록(1시간 캐시, 동시 요청은 한 번만 받는다). `refresh`면 캐시를 버린다 — Apple이 키를 바꿨을 때. */
function fetchAppleJwks(now: number, refresh = false): Promise<AppleJwk[]> {
  if (!refresh && jwksCache && now < jwksCache.until) return jwksCache.keys;
  const keys = fetch(APPLE_JWKS_URL).then(async (res) => {
    if (!res.ok) throw new Error(`Apple JWKS 응답 ${res.status}`);
    return ((await res.json()) as { keys: AppleJwk[] }).keys;
  });
  const entry = { keys, until: now + JWKS_TTL_MS };
  jwksCache = entry;
  keys.catch(() => {
    if (jwksCache === entry) jwksCache = null;
  });
  return keys;
}

const b64urlJson = (s: string): unknown =>
  JSON.parse(new TextDecoder().decode(base64UrlToBytes(s)));

/**
 * 서명·클레임을 검증하고 sub(Apple 사용자 id)·이메일을 돌려준다. 실패는 던진다.
 * nonce: 앱이 Apple에 SHA-256(nonce)로 넘긴 원래 값 — 토큰의 nonce와 해시가 같아야 한다(재전송 방지).
 */
export async function verifyAppleIdToken(
  token: string,
  opts: {
    audience: string;
    now: number;
    nonce: string;
    jwks?: (now: number, refresh?: boolean) => Promise<AppleJwk[]>;
  },
): Promise<AppleClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Apple 신원 토큰 형식이 아닙니다.');
  const [h, p, sig] = parts as [string, string, string];
  const header = b64urlJson(h) as { alg?: unknown; kid?: unknown };
  if (header.alg !== 'RS256' || typeof header.kid !== 'string')
    throw new Error('Apple 신원 토큰 헤더가 올바르지 않습니다.');
  const jwks = opts.jwks ?? fetchAppleJwks;
  const byKid = (keys: AppleJwk[]) => keys.find((k) => k.kid === header.kid);
  const jwk = byKid(await jwks(opts.now)) ?? byKid(await jwks(opts.now, true));
  if (!jwk) throw new Error('Apple 공개키를 찾지 못했습니다.');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(sig),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new Error('Apple 신원 토큰 서명이 올바르지 않습니다.');

  const c = b64urlJson(p) as {
    iss?: unknown;
    aud?: unknown;
    exp?: unknown;
    sub?: unknown;
    email?: unknown;
    nonce?: unknown;
  };
  if (c.iss !== APPLE_ISSUER) throw new Error('Apple 신원 토큰의 iss가 올바르지 않습니다.');
  if (c.aud !== opts.audience) throw new Error('Apple 신원 토큰의 aud가 올바르지 않습니다.');
  if (typeof c.exp !== 'number' || c.exp * 1000 <= opts.now)
    throw new Error('Apple 신원 토큰이 만료되었습니다.');
  if (typeof c.sub !== 'string' || !c.sub) throw new Error('Apple 신원 토큰에 sub가 없습니다.');
  if (c.nonce !== (await sha256Hex(opts.nonce)))
    throw new Error('Apple 신원 토큰의 nonce가 맞지 않습니다.');
  return { sub: c.sub, email: typeof c.email === 'string' ? c.email : null };
}

/**
 * 환경에 맞게 검증한다. 로컬 APPLE_FAKE=1이면 'fake:<sub>'도 받는다(테스트·로컬 앱 개발) — 진짜 토큰은 그대로 검증한다.
 * audience: 앱은 번들 id(기본), 웹(T-11-202)은 Services ID(APPLE_WEB_CLIENT_ID).
 */
export async function verifyApple(
  env: Pick<Bindings, 'ENVIRONMENT' | 'APPLE_FAKE' | 'APPLE_BUNDLE_ID'>,
  token: string,
  nonce: string,
  audience: string = env.APPLE_BUNDLE_ID ?? DEFAULT_BUNDLE_ID,
): Promise<AppleClaims> {
  const fake = env.ENVIRONMENT === 'local' && env.APPLE_FAKE === '1';
  if (fake && token.startsWith(FAKE_PREFIX) && token.length > FAKE_PREFIX.length)
    return { sub: token.slice(FAKE_PREFIX.length), email: null };
  return verifyAppleIdToken(token, {
    audience,
    now: Date.now(),
    nonce,
  });
}
