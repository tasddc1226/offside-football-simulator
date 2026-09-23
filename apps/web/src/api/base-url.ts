// API base URL 해석. 게임 데이터는 전부 localStorage에 남고, 서버로는 로그인/프로필 관련
// 요청만 나간다 — apps/web(React 시절) src/api/base-url.ts와 같은 패턴을 그대로 재사용한다.
const PRODUCTION_WEB_API_ORIGINS: Readonly<Record<string, string>> = {
  'offside-lab.com': 'https://api.offside-lab.com',
  'offside-web.tasddc1569.workers.dev': 'https://offside-api.tasddc1569.workers.dev',
};

export function resolveApiBaseUrl(configured: string | undefined, hostname: string | undefined): string {
  if (hostname && Object.hasOwn(PRODUCTION_WEB_API_ORIGINS, hostname)) {
    return PRODUCTION_WEB_API_ORIGINS[hostname]!;
  }
  return configured ?? 'http://localhost:8787';
}
