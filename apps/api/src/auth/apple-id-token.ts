// ───────── Sign in with Apple 신원 토큰 검증 (T-11-003) ─────────
// 앱이 받은 identityToken(JWT, RS256)을 Apple 공개키(JWKS)로 서명 검증하고 iss·aud·exp·nonce를 본다.
// 구글과 달리 토큰이 앱을 거쳐 오므로(전송 계층이 신뢰 근거가 아니다) 서명을 반드시 검증한다.
import { sha256Hex } from '../db/hash.js';
import type { Bindings } from '../env.js';

export const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const DEFAULT_BUNDLE_ID = 'com.offsidelab.app';
const JWKS_TTL_MS = 60 * 60 * 1000;
const FAKE_PREFIX = 'fake:';

export type AppleJwk = JsonWebKey & { kid: string };
export type AppleClaims = { sub: string; email: string | null };

let jwksCache: { keys: AppleJwk[]; until: number } | null = null;

async function fetchAppleJwks(now: number): Promise<AppleJwk[]> {
  if (jwksCache && now < jwksCache.until) return jwksCache.keys;
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error(`Apple JWKS 응답 ${res.status}`);
  const { keys } = (await res.json()) as { keys: AppleJwk[] };
  jwksCache = { keys, until: now + JWKS_TTL_MS };
  return keys;
}

function b64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64urlJson = (s: string): unknown => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

/**
 * 서명·클레임을 검증하고 sub(Apple 사용자 id)·이메일을 돌려준다. 실패는 던진다.
 * nonce: 앱이 Apple에 SHA-256(nonce)를 넘겼으면 원래 값 — 토큰의 nonce와 해시가 같아야 한다(재전송 방지).
 */
export async function verifyAppleIdToken(
  token: string,
  opts: {
    audience: string;
    now: number;
    nonce?: string | undefined;
    jwks?: (now: number) => Promise<AppleJwk[]>;
  },
): Promise<AppleClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Apple 신원 토큰 형식이 아닙니다.');
  const [h, p, sig] = parts as [string, string, string];
  const header = b64urlJson(h) as { alg?: unknown; kid?: unknown };
  if (header.alg !== 'RS256' || typeof header.kid !== 'string')
    throw new Error('Apple 신원 토큰 헤더가 올바르지 않습니다.');
  const keys = await (opts.jwks ?? fetchAppleJwks)(opts.now);
  const jwk = keys.find((k) => k.kid === header.kid);
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
    b64urlBytes(sig),
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
  if (opts.nonce !== undefined && c.nonce !== (await sha256Hex(opts.nonce)))
    throw new Error('Apple 신원 토큰의 nonce가 맞지 않습니다.');
  return { sub: c.sub, email: typeof c.email === 'string' ? c.email : null };
}

/** 환경에 맞는 검증기. 로컬 APPLE_FAKE=1이면 'fake:<sub>'도 받는다(테스트·로컬 앱 개발) — 진짜 토큰은 그대로 검증한다. */
export function appleVerifier(
  env: Pick<Bindings, 'ENVIRONMENT' | 'APPLE_FAKE' | 'APPLE_BUNDLE_ID'>,
): (token: string, nonce: string | undefined) => Promise<AppleClaims> {
  const audience = env.APPLE_BUNDLE_ID ?? DEFAULT_BUNDLE_ID;
  const fake = env.ENVIRONMENT === 'local' && env.APPLE_FAKE === '1';
  return async (token, nonce) => {
    if (fake && token.startsWith(FAKE_PREFIX) && token.length > FAKE_PREFIX.length)
      return { sub: token.slice(FAKE_PREFIX.length), email: null };
    return verifyAppleIdToken(token, { audience, now: Date.now(), nonce });
  };
}
