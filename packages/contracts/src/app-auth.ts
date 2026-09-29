import { z } from 'zod';

/**
 * T-11-003 네이티브 앱 로그인. 앱은 쿠키 대신 `Authorization: Bearer <token>`으로 세션을 싣는다.
 * 구글은 시스템 브라우저로 로그인한 뒤 `offside://auth?ticket=…`으로 돌아와 티켓을 토큰으로 바꾸고,
 * 애플은 기기에서 받은 identityToken을 바로 보낸다.
 */

/** `POST /v1/app/session` — 새 익명 세션(앱 첫 실행). */
export const AppSessionResponseSchema = z.strictObject({ token: z.string().min(1) });

/** PKCE S256 챌린지(base64url 43자). */
const ChallengeSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** `POST /v1/auth/app/google` — 로그인 시작. 현재 세션(Bearer)에 티켓을 묶는다. */
export const AppGoogleStartBodySchema = z.strictObject({ challenge: ChallengeSchema });
export const AppGoogleStartResponseSchema = z.strictObject({ url: z.url() });

/** `POST /v1/auth/app/exchange` — 브라우저에서 돌아온 티켓을 새 토큰으로 바꾼다. */
export const AppAuthExchangeBodySchema = z.strictObject({
  ticket: z.string().min(1).max(128),
  verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
});

/** `POST /v1/auth/apple` — 기기의 Sign in with Apple 결과. nonce는 원문(서버가 sha256해 토큰과 비교 — 재전송 방지). */
export const AppleSignInBodySchema = z.strictObject({
  identityToken: z.string().min(1).max(4096),
  nonce: z.string().min(16).max(128),
});

/** 로그인 결과. linked = 지금 프로필에 계정을 붙였다, switched = 이미 연결된 다른 프로필로 옮겼다. */
export const AppAuthResultSchema = z.strictObject({
  token: z.string().min(1),
  result: z.enum(['linked', 'switched']),
});

export type AppSessionResponse = z.infer<typeof AppSessionResponseSchema>;
export type AppGoogleStartBody = z.infer<typeof AppGoogleStartBodySchema>;
export type AppGoogleStartResponse = z.infer<typeof AppGoogleStartResponseSchema>;
export type AppAuthExchangeBody = z.infer<typeof AppAuthExchangeBodySchema>;
export type AppleSignInBody = z.infer<typeof AppleSignInBodySchema>;
export type AppAuthResult = z.infer<typeof AppAuthResultSchema>;

/** 구글 로그인이 끝나면 API가 이 주소로 돌려보낸다(`?google=linked|switched|error&ticket=…&reason=…`). */
export const APP_AUTH_REDIRECT_URL = 'offside://auth';
