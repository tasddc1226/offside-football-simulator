import { base64UrlToBytes } from '../auth/base64url.js';
import type { Bindings } from '../env.js';

/** Verify Google's signature AND the exact push audience/service-account identity. */
export async function verifyPubsubToken(
  env: Bindings,
  header: string | undefined,
  fetcher = fetch,
  nowS = Math.floor(Date.now() / 1000),
) {
  if (
    !env.GOOGLE_RTDN_AUDIENCE ||
    !env.GOOGLE_RTDN_SERVICE_ACCOUNT ||
    !header?.startsWith('Bearer ')
  )
    return false;
  let h: { alg?: string; kid?: string },
    c: {
      iss?: string;
      aud?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    };
  const parts = header.slice(7).split('.');
  if (parts.length !== 3) return false;
  try {
    h = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0]!)));
    c = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1]!)));
  } catch {
    return false;
  }
  if (
    h.alg !== 'RS256' ||
    !h.kid ||
    !['https://accounts.google.com', 'accounts.google.com'].includes(c.iss ?? '') ||
    c.aud !== env.GOOGLE_RTDN_AUDIENCE ||
    c.email !== env.GOOGLE_RTDN_SERVICE_ACCOUNT ||
    c.email_verified !== true ||
    typeof c.exp !== 'number' ||
    c.exp <= nowS ||
    typeof c.iat !== 'number' ||
    c.iat > nowS + 60 ||
    c.exp - c.iat > 3900
  )
    return false;
  // No purchase data or tokens are sent to the public signing-key endpoint.
  const res = await fetcher('https://www.googleapis.com/oauth2/v3/certs', {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error('PubSub signing keys unavailable');
  const { keys } = (await res.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  const jwk = keys.find((k) => k.kid === h.kid && k.kty === 'RSA');
  if (!jwk) return false;
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(parts[2]!),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}
