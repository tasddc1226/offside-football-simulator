import { base64UrlToBytes } from './base64url.js';

const ISSUER = 'https://token.actions.githubusercontent.com';
export const RELEASE_AUDIENCE = 'https://api.offside-lab.com/v1/internal/release-notes';
const REPO = 'tasddc1226/offside-football-simulator';
const REPO_ID = '1353771130';
const OWNER_ID = '55699007';
const WORKFLOW = `${REPO}/.github/workflows/deploy-production.yml@refs/heads/main`;
type Jwk = JsonWebKey & { kid: string };
let cache: { keys: Promise<Jwk[]>; until: number; fetchedAt: number } | undefined;

/** 한 시간 캐시. 모르는 kid로 공개키를 매 요청 다시 받지 않는다. */
function githubKeys(now: number, refresh = false): Promise<Jwk[]> {
  if (cache && now < cache.until && (!refresh || now - cache.fetchedAt < 60_000)) return cache.keys;
  const keys = fetch(`${ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(5000) }).then(
    async (r) => {
      if (!r.ok) throw new Error('GitHub 공개키를 읽지 못했어요.');
      return ((await r.json()) as { keys: Jwk[] }).keys;
    },
  );
  const entry = { keys, until: now + 3600_000, fetchedAt: now };
  cache = entry;
  void keys.catch(() => {
    if (cache === entry) cache = undefined;
  });
  return keys;
}

const decode = (s: string): Record<string, unknown> =>
  JSON.parse(new TextDecoder().decode(base64UrlToBytes(s))) as Record<string, unknown>;

/** Production Release/main/production 환경의 서명된 짧은 수명 토큰만 받는다. 관리자 세션과 무관하다. */
export async function verifyGithubRelease(
  token: string,
  sha: string,
  options: { now?: number; keys?: (now: number, refresh?: boolean) => Promise<Jwk[]> } = {},
): Promise<void> {
  const now = options.now ?? Date.now();
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 16_384) throw new Error('Invalid release token');
  const [headerPart, payloadPart, signature] = parts as [string, string, string];
  const h = decode(headerPart);
  if (h.alg !== 'RS256' || typeof h.kid !== 'string') throw new Error('Invalid release header');
  const keys = options.keys ?? githubKeys;
  const find = (list: Jwk[]) => list.find((k) => k.kid === h.kid && k.kty === 'RSA');
  const jwk = find(await keys(now)) ?? find(await keys(now, true));
  if (!jwk) throw new Error('Unknown release signing key');
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
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    ))
  )
    throw new Error('Invalid release signature');
  const p = decode(payloadPart);
  const subjects = [
    `repo:${REPO}:environment:production`,
    `repo:tasddc1226@${OWNER_ID}/offside-football-simulator@${REPO_ID}:environment:production`,
  ];
  const seconds = now / 1000;
  if (
    p.iss !== ISSUER ||
    p.aud !== RELEASE_AUDIENCE ||
    !subjects.includes(String(p.sub)) ||
    p.repository !== REPO ||
    p.repository_id !== REPO_ID ||
    p.repository_owner_id !== OWNER_ID ||
    p.workflow_ref !== WORKFLOW ||
    p.workflow_sha !== sha ||
    p.sha !== sha ||
    p.ref !== 'refs/heads/main' ||
    p.event_name !== 'workflow_dispatch' ||
    p.runner_environment !== 'github-hosted' ||
    typeof p.exp !== 'number' ||
    p.exp <= seconds ||
    typeof p.nbf !== 'number' ||
    p.nbf > seconds + 30 ||
    typeof p.iat !== 'number' ||
    p.iat > seconds + 30 ||
    seconds - p.iat > 600 ||
    p.exp - p.iat > 600
  )
    throw new Error('Release identity did not match');
}
