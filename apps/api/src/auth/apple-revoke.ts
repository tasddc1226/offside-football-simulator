// ───────── Sign in with Apple 토큰 해지 (T-11-167, 앱스토어 가이드라인 5.1.1(v)) ─────────
// 계정을 지울 때 앱이 Apple에 다시 확인받아 받은 authorizationCode를 토큰으로 바꾼 뒤 그 토큰을 해지한다.
// 서버는 Apple 토큰을 저장하지 않는다. client_secret은 Sign in with Apple 키(.p8, ES256)로 서명한 JWT다.
import type { Bindings } from '../env.js';
import { bytesToBase64Url, json64, pemToPkcs8 } from './base64url.js';
import { APPLE_ISSUER, DEFAULT_BUNDLE_ID } from './apple-id-token.js';

const SECRET_TTL_S = 5 * 60;

type AppleRevokeKeys = { teamId: string; keyId: string; privateKey: string };

/** 세 비밀값이 다 있어야 해지할 수 있다. 하나라도 없으면 null(해지를 건너뛴다). */
function appleRevokeKeys(env: Bindings): AppleRevokeKeys | null {
  const { APPLE_TEAM_ID: teamId, APPLE_SIGNIN_KEY_ID: keyId, APPLE_SIGNIN_PRIVATE_KEY: pem } = env;
  return teamId && keyId && pem ? { teamId, keyId, privateKey: pem } : null;
}

/** Apple 토큰 엔드포인트용 client_secret(JWT, ES256). WebCrypto의 ECDSA 서명은 JWT가 쓰는 r||s 형식이다. */
async function appleClientSecret(
  keys: AppleRevokeKeys,
  clientId: string,
  nowS: number,
): Promise<string> {
  const head = json64({ alg: 'ES256', kid: keys.keyId });
  const claims = json64({
    iss: keys.teamId,
    iat: nowS,
    exp: nowS + SECRET_TTL_S,
    aud: APPLE_ISSUER,
    sub: clientId,
  });
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(keys.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(`${head}.${claims}`),
  );
  return `${head}.${claims}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

const form = (fields: Record<string, string>) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

/**
 * authorizationCode → 토큰 → 해지. 성공하면 'revoked', 키가 없으면 'skipped'. 실패는 던진다(호출하는 쪽이
 * 계정 삭제를 막지 않고 기록만 한다).
 */
export async function revokeAppleAuthorization(
  env: Bindings,
  authorizationCode: string,
  opts: { nowS: number; fetcher?: typeof fetch },
): Promise<'revoked' | 'skipped'> {
  const keys = appleRevokeKeys(env);
  if (!keys) return 'skipped';
  const doFetch = opts.fetcher ?? fetch;
  const clientId = env.APPLE_BUNDLE_ID ?? DEFAULT_BUNDLE_ID;
  const secret = await appleClientSecret(keys, clientId, opts.nowS);
  const base = { client_id: clientId, client_secret: secret };
  const tokenRes = await doFetch(
    `${APPLE_ISSUER}/auth/token`,
    form({ ...base, grant_type: 'authorization_code', code: authorizationCode }),
  );
  if (!tokenRes.ok) throw new Error(`Apple token exchange ${tokenRes.status}`);
  const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
  const [token, hint] = tokens.refresh_token
    ? [tokens.refresh_token, 'refresh_token']
    : [tokens.access_token, 'access_token'];
  if (!token) throw new Error('Apple token exchange returned no token');
  const revokeRes = await doFetch(
    `${APPLE_ISSUER}/auth/revoke`,
    form({ ...base, token, token_type_hint: hint }),
  );
  if (!revokeRes.ok) throw new Error(`Apple token revoke ${revokeRes.status}`);
  return 'revoked';
}
