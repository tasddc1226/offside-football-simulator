import type { PublicHofEntry } from '@offside/contracts';
import { resolveApiBaseUrl } from './api/base-url.js';
import { careerShareMeta, injectShareMeta } from './share-meta.js';
import { SHARE_PATH } from './share-path.js';

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}
interface Env {
  ASSETS: AssetFetcher;
}

const PUBLIC_PATHS = new Set([
  '/',
  '/guide',
  '/guide/',
  '/guide/index.html',
  '/faq',
  '/faq/',
  '/faq/index.html',
  '/legal/terms',
  '/legal/terms/',
  '/legal/terms/index.html',
  '/legal/privacy',
  '/legal/privacy/',
  '/legal/privacy/index.html',
]);
// 앱 셸(오프사이드/풀타임 SPA)로 서빙해야 하는 경로. 게임 자체는 `/`에서 로드되고,
// `/settings`는 구글 OAuth 콜백(`?google=linked|switched|error&reason=...`)이
// 돌아오는 목적지라 앱 셸로 떨어져야 한다. `/career/<id>`(T-10-029 공유 링크)는 아래에서 미리보기 메타를 넣어 따로 내린다.
const APP_PATHS = [/^\/settings\/?$/];

function withRobots(response: Response, value: string): Response {
  const result = new Response(response.body, response);
  result.headers.set('X-Robots-Tag', value);
  return result;
}

// T-10-031: 링크 미리보기 봇은 JS를 돌리지 않으므로 공유 링크의 셸 메타를 그 선수 기록으로 바꿔 준다.
// API가 없거나(로컬·미등록 호스트) 늦거나 실패하면 원래 셸을 그대로 내려 보기 전용 화면은 영향이 없다.
async function withShareMeta(shellP: Promise<Response>, id: string, url: URL): Promise<Response> {
  // 셸과 선수 기록을 동시에 받는다.
  const entryP = fetch(`${resolveApiBaseUrl(undefined, url.hostname)}/v1/hof/${id}`, {
    signal: AbortSignal.timeout(2000),
    cf: { cacheTtl: 300, cacheEverything: true },
  } as RequestInit).catch(() => null);
  const [shell, res] = await Promise.all([shellP, entryP]);
  if (!shell.ok || !res?.ok) return shell;
  try {
    const body = (await res.json()) as { data?: { entry?: PublicHofEntry } };
    if (!body.data?.entry) return shell;
    const meta = careerShareMeta(body.data.entry, url.origin); // 셸 본문을 읽기 전에 — 여기서 실패해도 셸은 그대로 쓸 수 있다.
    const html = injectShareMeta(await shell.text(), meta);
    const headers = new Headers(shell.headers);
    headers.delete('Content-Length');
    headers.delete('ETag');
    return new Response(html, { status: shell.status, headers });
  } catch {
    return shell;
  }
}

function withCacheControl(response: Response, value: string): Response {
  const result = withRobots(response, 'noindex, nofollow');
  result.headers.set('Cache-Control', value);
  return result;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const asset = await env.ASSETS.fetch(request);
    const isPublicPage = PUBLIC_PATHS.has(url.pathname);
    const isDiscovery = url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml';
    // T-10-004: Vite 산출물(/assets/*)은 파일명에 내용 해시가 들어가 내용이 바뀌면 URL도 바뀐다 —
    // 재방문 때 재검증 없이 캐시를 그대로 쓰도록 1년 immutable로 내려 준다.
    if (url.pathname.startsWith('/assets/') && asset.status === 200)
      return withCacheControl(asset, 'public, max-age=31536000, immutable');
    // T-10-023: 새 배포 감지용 — 항상 최신 값을 받아야 한다.
    if (url.pathname === '/version.json' && asset.status === 200) return withCacheControl(asset, 'no-store');
    if (!isPublicPage && !isDiscovery && asset.status !== 404)
      return withRobots(asset, 'noindex, nofollow');
    const appShell = () => env.ASSETS.fetch(new Request(new URL('/app-shell', url.origin), request));
    const shareId = asset.status === 404 ? SHARE_PATH.exec(url.pathname)?.[1] : undefined;
    if (shareId) return withRobots(await withShareMeta(appShell(), shareId, url), 'noindex, nofollow');
    let indexingEnabled = false;
    try {
      const policyUrl = new URL('/seo-policy.json', url.origin);
      const policy = await env.ASSETS.fetch(new Request(policyUrl, { method: 'GET' }));
      const value = (await policy.json()) as { indexingEnabled?: boolean; origin?: string };
      indexingEnabled = Boolean(value.indexingEnabled && value.origin === url.origin);
    } catch {
      /* Fail closed: indexing stays disabled. */
    }

    if (url.pathname === '/robots.txt' && !indexingEnabled) {
      return new Response('User-agent: *\nDisallow: /\n', {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }
    if (url.pathname === '/sitemap.xml' && !indexingEnabled) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }
    if (asset.status !== 404) {
      return withRobots(
        asset,
        isPublicPage && indexingEnabled ? 'index, follow' : 'noindex, nofollow',
      );
    }
    const shell = await appShell();
    if (APP_PATHS.some((pattern) => pattern.test(url.pathname))) {
      return withRobots(shell, 'noindex, nofollow');
    }
    // 이슈 155: 알 수 없는 경로도 평문 "Not Found" 대신 앱 셸을 404로 내려 SPA의 not-found 화면
    // (routes/__root.tsx notFoundComponent)이 셸 안에서 그려지게 한다. 상태 코드·noindex는 유지.
    const notFound = new Response(shell.body, { status: 404, headers: shell.headers });
    return withRobots(notFound, 'noindex, nofollow');
  },
};
