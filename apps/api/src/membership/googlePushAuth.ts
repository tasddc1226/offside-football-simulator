import { base64UrlToBytes } from '../auth/base64url.js';
type Jwk = JsonWebKey & { kid: string };
let cache: { keys: Promise<Jwk[]>; until: number; fetchedAt: number } | undefined;
async function googleKeys(now: number, refresh = false) {
  if (cache && now < cache.until && (!refresh || now - cache.fetchedAt < 60_000)) return cache.keys;
  const keys = fetch('https://www.googleapis.com/oauth2/v3/certs', {
    signal: AbortSignal.timeout(5000),
  }).then(async (r) => {
    if (!r.ok) throw new Error('PUSH_KEYS_UNAVAILABLE');
    return ((await r.json()) as { keys: Jwk[] }).keys;
  });
  const entry = { keys, until: now + 3600_000, fetchedAt: now };
  cache = entry;
  void keys.catch(() => {
    if (cache === entry) cache = undefined;
  });
  return keys;
}
const decode = (s: string) =>
  JSON.parse(new TextDecoder().decode(base64UrlToBytes(s))) as Record<string, unknown>;
/** Authenticate the Pub/Sub delivery identity, independently of the game account/session. */
export async function verifyGooglePush(
  token: string,
  options: {
    audience: string;
    email: string;
    now: number;
    keys?: (now: number, refresh?: boolean) => Promise<Jwk[]>;
  },
) {
  const invalid = () => new Error('INVALID_PUSH_IDENTITY');
  if (!options.audience || !options.email || token.length > 16_384) throw invalid();
  const parts = token.split('.');
  if (parts.length !== 3) throw invalid();
  const [h, p, s] = parts as [string, string, string];
  const header = decode(h);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw invalid();
  const keys = options.keys ?? googleKeys;
  const find = (list: Jwk[]) => list.find((k) => k.kid === header.kid && k.kty === 'RSA');
  const jwk = find(await keys(options.now)) ?? find(await keys(options.now, true));
  if (!jwk) throw invalid();
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  if (
    !(await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    ))
  )
    throw invalid();
  const c = decode(p);
  const now = options.now / 1000;
  if (
    !['accounts.google.com', 'https://accounts.google.com'].includes(String(c.iss)) ||
    c.aud !== options.audience ||
    c.email !== options.email ||
    c.email_verified !== true ||
    typeof c.sub !== 'string' ||
    !c.sub ||
    typeof c.exp !== 'number' ||
    !Number.isFinite(c.exp) ||
    c.exp <= now ||
    typeof c.iat !== 'number' ||
    !Number.isFinite(c.iat) ||
    c.iat > now + 30 ||
    c.exp - c.iat > 3600 + 60
  )
    throw invalid();
}
