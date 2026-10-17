// Google 서비스 계정 접근 토큰(JWT bearer). GA4 읽기(T-11-299) · Google Play 리뷰(T-11-328)가 같이 쓴다.
// 비공개 키는 PKCS#8 PEM(Worker 비밀값). 키 쌍은 로컬에서 만들고 공개 인증서만 Google에 올렸다.
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type ServiceAccount = { email: string; key: string; keyId?: string | undefined };

export const b64u = (b: ArrayBuffer | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const pemDer = (pem: string) =>
  Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));

const cache = new Map<string, { token: string; until: number }>();

/** 한 시간짜리 토큰을 받아 격리 안에서 (계정 · 범위)별로 다시 쓴다. */
export async function serviceAccountToken(
  sa: ServiceAccount,
  scope: string,
  fetcher: typeof fetch = fetch,
  label = 'Google',
): Promise<string> {
  const k = `${sa.email} ${scope}`;
  const hit = cache.get(k);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemDer(sa.key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', ...(sa.keyId ? { kid: sa.keyId } : {}) }),
  );
  const body = b64u(
    JSON.stringify({ iss: sa.email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const sig = b64u(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`)),
  );
  const r = (await (
    await fetcher(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${head}.${body}.${sig}`,
      }),
    })
  ).json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!r.access_token) throw new Error(`${label} 토큰을 받지 못했어요(${r.error ?? 'unknown'})`);
  cache.set(k, { token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 });
  return r.access_token;
}
