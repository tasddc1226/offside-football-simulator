import { sha256Hex } from '../db/hash.js';

/**
 * T-1-004 API-PRO-005 2단계 삭제 확인 토큰. 별도 저장 없이 세션의 `tokenHash`를 서명 키로 쓴다
 * (세션 토큰을 아는 사람만 유효한 서명을 만들 수 있으므로 "세션 id에 묶인 서명 토큰"을 만족한다).
 * `|`는 sessionId·ISO 시각·hex 서명 어디에도 나오지 않으므로 구분자로 안전하다.
 */
const DELIMITER = '|';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(sessionTokenHash: string, sessionId: string, expiresAt: string): Promise<string> {
  return sha256Hex(`${sessionTokenHash}${DELIMITER}${sessionId}${DELIMITER}${expiresAt}`);
}

export async function signConfirmToken(input: {
  sessionId: string;
  sessionTokenHash: string;
  expiresAt: string;
}): Promise<string> {
  const signature = await sign(input.sessionTokenHash, input.sessionId, input.expiresAt);
  return toBase64Url([input.sessionId, input.expiresAt, signature].join(DELIMITER));
}

export type VerifyConfirmTokenResult = { ok: true } | { ok: false };

/** sessionId 불일치(타 세션·재사용된 옛 세션 토큰)·서명 불일치·만료를 모두 같은 실패로 취급한다. */
export async function verifyConfirmToken(
  token: string,
  input: { sessionId: string; sessionTokenHash: string; now: string },
): Promise<VerifyConfirmTokenResult> {
  let decoded: string;
  try {
    decoded = fromBase64Url(token);
  } catch {
    return { ok: false };
  }
  const parts = decoded.split(DELIMITER);
  if (parts.length !== 3) return { ok: false };
  const [sessionId, expiresAt, signature] = parts as [string, string, string];
  if (sessionId !== input.sessionId) return { ok: false };
  if (input.now >= expiresAt) return { ok: false };
  const expected = await sign(input.sessionTokenHash, sessionId, expiresAt);
  if (expected !== signature) return { ok: false };
  return { ok: true };
}
