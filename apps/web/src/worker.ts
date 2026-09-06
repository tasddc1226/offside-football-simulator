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
]);
const APP_PATHS = [
  /^\/onboarding\/?$/,
  /^\/settings\/?$/,
  /^\/legal\/(terms|privacy)\/?$/,
  /^\/career\/[^/]+(?:\/.*)?$/,
];

function withRobots(response: Response, value: string): Response {
  const result = new Response(response.body, response);
  result.headers.set('X-Robots-Tag', value);
  return result;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const asset = await env.ASSETS.fetch(request);
    const isPublicPage = PUBLIC_PATHS.has(url.pathname);
    const isDiscovery = url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml';
    if (!isPublicPage && !isDiscovery && asset.status !== 404)
      return withRobots(asset, 'noindex, nofollow');
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
    if (APP_PATHS.some((pattern) => pattern.test(url.pathname))) {
      const shell = await env.ASSETS.fetch(new Request(new URL('/app-shell', url.origin), request));
      return withRobots(shell, 'noindex, nofollow');
    }
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  },
};
