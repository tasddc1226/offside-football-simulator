// ADR-015 3단계 GitHub App(offside-dev-agent) 토큰. 앱 권한은 이 저장소의 contents · pull_requests · actions 쓰기와 checks 읽기뿐이고
// workflows 권한이 없어 .github/workflows를 바꿀 수 없다. main은 저장소 규칙으로 PR 없이 바뀌지 않는다.

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const enc = new TextEncoder();

/** PKCS#8 PEM(`BEGIN PRIVATE KEY`)으로 RS256 앱 JWT를 만든다. GitHub가 준 PKCS#1 키는 넣기 전에 pkcs8로 바꾼다. */
export async function appJwt(appId: string, pem: string, now = Date.now()): Promise<string> {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const iat = Math.floor(now / 1000) - 30;
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ iat, exp: iat + 540, iss: appId })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

export type GitHubApp = { appId: string; privateKey: string; installationId: string };

let cached: { token: string; until: number } | undefined;

/** 설치 토큰(1시간). 만료 5분 전까지는 같은 isolate 안에서 다시 쓴다. */
export async function installationToken(app: GitHubApp, fetcher: typeof fetch = fetch) {
  if (cached && cached.until > Date.now()) return cached.token;
  const r = await fetcher(
    `https://api.github.com/app/installations/${app.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${await appJwt(app.appId, app.privateKey)}`,
        'User-Agent': 'offside-agents',
      },
    },
  );
  if (!r.ok) throw new Error(`GitHub app token ${r.status}`);
  const data = (await r.json()) as { token: string; expires_at: string };
  cached = { token: data.token, until: Date.parse(data.expires_at) - 5 * 60_000 };
  return data.token;
}

export type Gh = <T = Record<string, unknown>>(
  path: string,
  init?: { method?: string; body?: unknown },
) => Promise<{ status: number; data: T }>;

/** 저장소 API(`/repos/<repo>` 뒤 경로). 실패 상태도 그대로 돌려준다(부르는 쪽이 판단). */
export const ghClient =
  (repo: string, token: string, fetcher: typeof fetch = fetch): Gh =>
  async (path, init) => {
    const r = await fetcher(`https://api.github.com/repos/${repo}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'offside-agents',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    });
    const text = await r.text();
    return { status: r.status, data: (text ? JSON.parse(text) : {}) as never };
  };
