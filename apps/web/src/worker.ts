import { withCampaignBanner } from './app-banner.js';
import { storeRedirect } from './store-redirect.js';
import { serveNews, newsSitemap } from './public-news.js';
import {
  LEGENDS_TTL,
  legendsSitemapPaths,
  readLegendsIndex,
  serveLegends,
} from './public-legends.js';
import { NEWS_ID } from './news-id.js';
import { resolveApiBaseUrl } from './api/base-url.js';
import { fetchHofEntry } from './hof-entry.js';
import { careerShareMeta, injectShareMeta } from './share-meta.js';
import { OG_CARD_PATH, SHARE_PATH } from './share-path.js';

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
interface Env {
  ASSETS: Fetcher;
  APPLE_PROVIDER_TOKEN?: string;
  /** T-10-068 공유 미리보기 카드 워커(서비스 바인딩). 로컬 개발에선 없다. */
  OG?: Fetcher;
}
interface Ctx {
  waitUntil(p: Promise<unknown>): void;
}

const PUBLIC_PATHS = new Set([
  '/',
  '/app',
  '/app/',
  '/app/index.html',
  '/guide',
  '/guide/',
  '/guide/index.html',
  '/faq',
  '/faq/',
  '/faq/index.html',
  '/fairness',
  '/fairness/',
  '/fairness/index.html',
  '/about',
  '/about/',
  '/about/index.html',
  '/legal/terms',
  '/legal/terms/',
  '/legal/terms/index.html',
  '/legal/privacy',
  '/legal/privacy/',
  '/legal/privacy/index.html',
]);
// T-11-452 가이드 아래 공략 글(/guide/<slug>/). 빌드가 만든 정적 파일이 있을 때만 공개 페이지로 본다.
const GUIDE_ARTICLE = /^\/guide\/[a-z0-9-]+(\/|\/index\.html)?$/;
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
// T-10-068 선수별 공유 미리보기 카드(PNG)는 따로 둔 워커(offside-og, og-worker.ts)가 굽는다 — 2MB대 wasm이
// 모든 페이지를 내리는 이 워커의 시작 시간을 늘리지 않게. URL에 내용 꼬리표(?v=)가 붙어 내용이 바뀌면 주소도
// 바뀌므로 여기(커스텀 도메인)의 엣지 캐시에 오래 둔다.
async function careerCard(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  // 캐시는 GET만 받는다 — HEAD(링크 확인 봇)도 같은 GET 키로 찾고 넣는다. 카드 워커의 302(지금 주소·대체 카드)는
  // 따라가지 않고 그대로 돌려준다 — 따라가면 대체 카드가 선수 카드 주소에 200으로 일주일 캐시된다.
  const key = new Request(request.url, { redirect: 'manual' });
  const hit = await cache?.match(key);
  if (hit) return hit;
  if (!env.OG) return new Response('Not Found', { status: 404 }); // 로컬: og 워커를 같이 띄우지 않았다
  const res = await env.OG.fetch(key);
  // 대체 카드로 돌려보내는 302도 짧게(og-worker의 Cache-Control) 둔다 — 굽기가 계속 실패할 때 봇마다 다시 굽지 않게.
  if ((res.status === 200 || res.status === 302) && cache)
    ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// API가 없거나(로컬·미등록 호스트) 늦거나 실패하면 원래 셸을 그대로 내려 보기 전용 화면은 영향이 없다.
async function withShareMeta(shellP: Promise<Response>, id: string, url: URL): Promise<Response> {
  // 셸과 선수 기록을 동시에 받는다.
  const [shell, entry] = await Promise.all([shellP, fetchHofEntry(id, url.hostname)]);
  if (!shell.ok || !entry) return shell;
  try {
    const meta = careerShareMeta(entry, url.origin); // 셸 본문을 읽기 전에 — 여기서 실패해도 셸은 그대로 쓸 수 있다.
    const html = injectShareMeta(await shell.text(), meta);
    const headers = new Headers(shell.headers);
    headers.delete('Content-Length');
    headers.delete('ETag');
    return new Response(html, { status: shell.status, headers });
  } catch {
    return shell;
  }
}

// T-10-037: 연결 미리 열기를 HTML이 아니라 응답 헤더로 알린다 — Cloudflare가 HTML의 fonts preconnect 태그를
// 지워 내보내고(존 설정), 헤더는 그대로 둔다. 폰트 파일(gstatic)은 폰트 CSS를 읽은 뒤에야 요청되고, API는
// 번들이 돈 뒤에 부르므로 둘 다 미리 열어 두면 그만큼 기다리지 않는다. API는 쿠키를 싣는 요청이라 crossorigin 없이.
function withPreconnect(response: Response, url: URL): Response {
  if (!response.headers.get('Content-Type')?.startsWith('text/html')) return response;
  const result = new Response(response.body, response);
  result.headers.append(
    'Link',
    `<https://fonts.gstatic.com>; rel=preconnect; crossorigin, <https://cdn.jsdelivr.net>; rel=preconnect; crossorigin, <${resolveApiBaseUrl(undefined, url.hostname)}>; rel=preconnect`,
  );
  return result;
}

function withCacheControl(response: Response, value: string): Response {
  const result = withRobots(response, 'noindex, nofollow');
  result.headers.set('Cache-Control', value);
  return result;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    if (OG_CARD_PATH.test(url.pathname)) return careerCard(request, env, ctx);
    return withPreconnect(
      await withCampaignBanner(await route(request, env, url, ctx), url, env.APPLE_PROVIDER_TOKEN),
      url,
    );
  },
};

// T-11-531 크리에이터 프로필 소개(틱톡 160자)에 넣을 짧은 주소. 추적 링크(T-11-515)로 넘긴다.
const SHORT_LINKS: Record<string, string> = {
  '/ethio':
    '/?utm_source=tiktok&utm_medium=partner&utm_campaign=creator_test&utm_content=ethio_tiktok',
  '/ethio-yt':
    '/?utm_source=youtube&utm_medium=partner&utm_campaign=creator_test&utm_content=ethio_short',
};

async function route(request: Request, env: Env, url: URL, ctx: Ctx): Promise<Response> {
  if (url.pathname === '/get' || url.pathname === '/get/')
    return new Response(null, {
      status: 302,
      headers: {
        Location: storeRedirect(
          url,
          request.headers.get('User-Agent') ?? '',
          env.APPLE_PROVIDER_TOKEN,
        ),
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  const short = SHORT_LINKS[url.pathname.toLowerCase()];
  if (short)
    return new Response(null, {
      status: 302,
      headers: { Location: short, 'Cache-Control': 'no-store' },
    });
  if (url.pathname === '/' && url.searchParams.has('news')) {
    // 공개 소식의 "게임에서 보기" 링크. 형식이 틀린 글 ID는 게임 게시판에 넘기지 않고 홈으로 보낸다.
    if (!NEWS_ID.test(url.searchParams.get('news') ?? ''))
      return new Response(null, {
        status: 302,
        headers: { Location: '/', 'Cache-Control': 'no-store' },
      });
    return withRobots(
      await env.ASSETS.fetch(new Request(new URL('/app-shell', url.origin))),
      'noindex, nofollow',
    );
  }
  const isNews = url.pathname === '/news' || url.pathname.startsWith('/news/');
  const isLegends = /^\/legends(\/|$)/i.test(url.pathname);
  const asset = await env.ASSETS.fetch(request);
  const isPublicPage =
    PUBLIC_PATHS.has(url.pathname) || (asset.status === 200 && GUIDE_ARTICLE.test(url.pathname));
  const isDiscovery = url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml';
  // T-11-585 랜딩 스크린샷 · QR은 이미지 검색에 잡히게 둔다(나머지 정적 파일은 noindex 그대로).
  // 빌드가 만드는 _headers의 /* 규칙이 정적 파일 응답에 noindex를 미리 붙여 오므로 여기서 지운다.
  if (url.pathname.startsWith('/landing/') && asset.status === 200) {
    const result = new Response(asset.body, asset);
    result.headers.delete('X-Robots-Tag');
    return result;
  }
  // T-10-004: Vite 산출물(/assets/*)은 파일명에 내용 해시가 들어가 내용이 바뀌면 URL도 바뀐다 —
  // 재방문 때 재검증 없이 캐시를 그대로 쓰도록 1년 immutable로 내려 준다.
  if (url.pathname.startsWith('/assets/') && asset.status === 200)
    return withCacheControl(asset, 'public, max-age=31536000, immutable');
  // T-10-023: 새 배포 감지용 — 항상 최신 값을 받아야 한다.
  if (url.pathname === '/version.json' && asset.status === 200)
    return withCacheControl(asset, 'no-store');
  if (!isNews && !isLegends && !isPublicPage && !isDiscovery && asset.status !== 404)
    return withRobots(asset, 'noindex, nofollow');
  const appShell = () => env.ASSETS.fetch(new Request(new URL('/app-shell', url.origin), request));
  const shareId = asset.status === 404 ? SHARE_PATH.exec(url.pathname)?.[1] : undefined;
  if (shareId)
    return withRobots(await withShareMeta(appShell(), shareId, url), 'noindex, nofollow');
  let indexingEnabled = false;
  try {
    const policyUrl = new URL('/seo-policy.json', url.origin);
    const policy = await env.ASSETS.fetch(new Request(policyUrl, { method: 'GET' }));
    const value = (await policy.json()) as { indexingEnabled?: boolean; origin?: string };
    indexingEnabled = Boolean(value.indexingEnabled && value.origin === url.origin);
  } catch {
    /* Fail closed: indexing stays disabled. */
  }

  if (isNews) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    const template = await env.ASSETS.fetch(new Request(new URL('/news-shell', url.origin)));
    if (!template.ok)
      return new Response('Service Unavailable', {
        status: 503,
        headers: { 'X-Robots-Tag': 'noindex, nofollow' },
      });
    return serveNews(request, await template.text(), indexingEnabled);
  }
  if (isLegends) return legends(request, env, url, ctx, indexingEnabled);
  if (url.pathname === '/sitemap.xml' && indexingEnabled && asset.ok) {
    const ids = await legendsIndex(url, ctx).catch(() => [] as string[]);
    return newsSitemap(asset, url, legendsSitemapPaths(ids));
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
}

const edgeCache = () => (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;

// T-11-231 색인 대상 선수 ID(레전드 점수 상위 · 포지션별 상위). 목록 API 14번이라 데이터센터마다 하루 한 번만 읽는다.
async function legendsIndex(url: URL, ctx: Ctx): Promise<string[]> {
  const cache = edgeCache();
  const key = new Request(`${url.origin}/__legends-index.json`);
  const hit = await cache?.match(key);
  if (hit) return (await hit.json()) as string[];
  const ids = await readLegendsIndex(url.hostname);
  if (cache)
    ctx.waitUntil(
      cache.put(
        key,
        Response.json(ids, {
          headers: { 'Cache-Control': `public, max-age=${LEGENDS_TTL.index}` },
        }),
      ),
    );
  return ids;
}

// T-11-231 명예의 전당 공개 페이지. 그린 HTML을 엣지에 두어(목록 1시간 · 선수 하루) 크롤러가 많이 돌아도
// 같은 페이지는 API를 다시 부르지 않는다. 캐시는 GET 키 하나로 HEAD도 같이 받는다.
async function legends(
  request: Request,
  env: Env,
  url: URL,
  ctx: Ctx,
  indexing: boolean,
): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
  const cache = edgeCache();
  const key = new Request(url.toString());
  const strip = (res: Response) => (request.method === 'HEAD' ? new Response(null, res) : res);
  const hit = await cache?.match(key);
  if (hit) return strip(hit);
  const template = await env.ASSETS.fetch(new Request(new URL('/news-shell', url.origin)));
  if (!template.ok)
    return new Response('Service Unavailable', {
      status: 503,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    });
  const res = await serveLegends(key, await template.text(), indexing, () =>
    legendsIndex(url, ctx),
  );
  if (res.status === 200 && cache) ctx.waitUntil(cache.put(key, res.clone()));
  return strip(res);
}
