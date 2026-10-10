// base64url(패딩 없음) — 세션 토큰·OAuth state·PKCE·확인 토큰·JWT가 함께 쓴다.

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(encoded: string): Uint8Array<ArrayBuffer> {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 32바이트 난수(base64url 43자) — 세션 토큰, OAuth state·verifier, 앱 로그인 티켓. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

/** PKCE S256 챌린지: base64url(SHA-256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

/** JSON 값 → base64url — JWT 머리 · 본문(Apple client_secret · Google 서비스 계정 JWT). */
export const json64 = (v: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(v)));

/** PEM(PKCS#8) → 키 바이트. 본문은 표준 base64지만 base64UrlToBytes가 함께 읽는다. */
export const pemToPkcs8 = (pem: string) =>
  base64UrlToBytes(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
