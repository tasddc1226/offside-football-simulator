import { ArcticFetchError, decodeIdToken, Google, OAuth2RequestError } from 'arctic';
import type { Bindings } from '../env.js';

/**
 * D-21 포트. `createArcticGoogleOidc`는 실제 Google과, `createFakeGoogleOidc`는 로컬 전용 가짜와
 * 통신한다. 라우트는 이 인터페이스만 안다.
 */
export interface GoogleOidc {
  createAuthorizationUrl(state: string, codeVerifier: string): URL;
  exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<{ sub: string; email: string | null; emailVerified: boolean }>;
}

export function verifiedGoogleEmail(claims: {
  email: string | null;
  emailVerified: boolean;
}): string | null {
  return claims.emailVerified ? claims.email : null;
}

const GOOGLE_SCOPES = ['openid', 'email'];
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

type IdTokenClaims = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
};

/**
 * arctic은 토큰 엔드포인트와 직접 TLS로 통신해 ID 토큰을 받는다(전송 계층이 신뢰 근거다) — 그래서
 * 서명 검증 없이 `iss`·`aud`·`exp`만 검사한다(OIDC Core 1.0 §3.1.3.7 비고).
 */
export function verifyGoogleIdTokenClaims(
  idToken: string,
  clientId: string,
  now: number,
): { sub: string; email: string | null; emailVerified: boolean } {
  const claims = decodeIdToken(idToken) as IdTokenClaims;

  if (typeof claims.iss !== 'string' || !GOOGLE_ISSUERS.has(claims.iss)) {
    throw new Error('Google ID 토큰의 iss가 올바르지 않습니다.');
  }
  if (claims.aud !== clientId) {
    throw new Error('Google ID 토큰의 aud가 올바르지 않습니다.');
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) {
    throw new Error('Google ID 토큰이 만료되었습니다.');
  }
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new Error('Google ID 토큰에 sub가 없습니다.');
  }

  const email = typeof claims.email === 'string' ? claims.email : null;
  const emailVerified = claims.email_verified === true;
  return { sub: claims.sub, email, emailVerified };
}

export function createArcticGoogleOidc(
  env: Pick<Bindings, 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'GOOGLE_REDIRECT_URI'>,
): GoogleOidc {
  const clientId = env.GOOGLE_CLIENT_ID ?? '';
  const google = new Google(clientId, env.GOOGLE_CLIENT_SECRET ?? '', env.GOOGLE_REDIRECT_URI);

  return {
    createAuthorizationUrl(state, codeVerifier) {
      return google.createAuthorizationURL(state, codeVerifier, GOOGLE_SCOPES);
    },
    async exchangeCode(code, codeVerifier) {
      let tokens;
      try {
        tokens = await google.validateAuthorizationCode(code, codeVerifier);
      } catch (err) {
        if (err instanceof OAuth2RequestError || err instanceof ArcticFetchError) {
          throw new Error(`Google 토큰 교환에 실패했습니다: ${err.message}`, { cause: err });
        }
        throw err;
      }
      return verifyGoogleIdTokenClaims(tokens.idToken(), clientId, Date.now());
    },
  };
}

const FAKE_CODE_PREFIX = 'fake:';
/** 브라우저가 실제로 `/v1/auth/google/start`를 타고 도는 E2E 경로는 항상 이 sub를 쓴다(D-21). */
const FAKE_DEFAULT_SUB = 'fake-google-sub-e2e';
/** 로컬 전용이라 wrangler dev 기본 포트로 고정한다. */
const FAKE_CALLBACK_ORIGIN = 'http://localhost:8787';
const FAKE_CALLBACK_PATH = '/v1/auth/google/callback';

function fakeEmailForSub(sub: string): string {
  return `${sub}@example.com`;
}

/**
 * D-21: 로컬(`ENVIRONMENT=local`, `GOOGLE_FAKE=1`)에서 실제 Google 없이 전 흐름을 검사한다.
 * `createAuthorizationUrl`이 돌려주는 URL은 Google이 아니라 우리 콜백으로 바로 향한다 — 코드는
 * `fake:<sub>` 형식이고, `exchangeCode`는 그 sub·codeVerifier 없이(가짜라 PKCE 검증이 없다) 그대로
 * 해석한다. api 테스트는 `/callback`에 임의의 `fake:<sub>` 코드를 직접 보내 여러 sub 시나리오를
 * 검사한다.
 */
export function createFakeGoogleOidc(): GoogleOidc {
  return {
    createAuthorizationUrl(state, _codeVerifier) {
      const url = new URL(`${FAKE_CALLBACK_ORIGIN}${FAKE_CALLBACK_PATH}`);
      url.searchParams.set('code', `${FAKE_CODE_PREFIX}${FAKE_DEFAULT_SUB}`);
      url.searchParams.set('state', state);
      return url;
    },
    async exchangeCode(code, _codeVerifier) {
      if (!code.startsWith(FAKE_CODE_PREFIX)) {
        throw new Error(`가짜 OIDC 코드 형식이 아닙니다: ${code}`);
      }
      const sub = code.slice(FAKE_CODE_PREFIX.length);
      if (sub.length === 0) {
        throw new Error('가짜 OIDC 코드에 sub가 없습니다.');
      }
      return { sub, email: fakeEmailForSub(sub), emailVerified: true };
    },
  };
}

export function isLocalFakeMode(env: Pick<Bindings, 'ENVIRONMENT' | 'GOOGLE_FAKE'>): boolean {
  return env.ENVIRONMENT === 'local' && env.GOOGLE_FAKE === '1';
}

/**
 * D-21 선택 규칙. `null`이면 라우트가 503 `SERVICE_UNAVAILABLE`을 낸다(클라이언트 ID 없이도 앱은
 * U-003 전에 뜬다).
 */
export function selectGoogleOidc(
  env: Pick<
    Bindings,
    | 'ENVIRONMENT'
    | 'GOOGLE_FAKE'
    | 'GOOGLE_CLIENT_ID'
    | 'GOOGLE_CLIENT_SECRET'
    | 'GOOGLE_REDIRECT_URI'
  >,
): GoogleOidc | null {
  if (isLocalFakeMode(env)) return createFakeGoogleOidc();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return createArcticGoogleOidc(env);
}
