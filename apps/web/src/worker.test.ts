import { describe, expect, it } from 'vitest';
import worker from './worker.js';

function environment(indexingEnabled = false, origin = 'https://example.test') {
  const fetch = async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path === '/seo-policy.json') return Response.json({ indexingEnabled, origin });
    if (path === '/app-shell')
      return new Response('<meta name="robots" content="noindex, nofollow"><p>shell</p>');
    if (['/', '/guide', '/guide/', '/guide/index.html', '/faq', '/faq/'].includes(path))
      return new Response(`<p>${path}</p>`);
    if (path === '/sitemap.xml' && indexingEnabled) return new Response('<?xml version="1.0"?>');
    return new Response('missing', { status: 404 });
  };
  return { ASSETS: { fetch } };
}

describe('public web worker route policy', () => {
  it('keeps public URLs indexable only when the build opted in, including query URLs', async () => {
    const response = await worker.fetch(
      new Request('https://example.test/guide?utm_source=test'),
      environment(true),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('index, follow');
  });
  it('does not index a configured build from an alternate host', async () => {
    const response = await worker.fetch(
      new Request('https://alternate.example/guide'),
      environment(true),
    );
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
  it('serves personal deep links with the noindex app shell', async () => {
    const response = await worker.fetch(
      new Request('https://example.test/career/id-1/chapter?turn=2'),
      environment(true),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await response.text()).not.toContain('canonical');
  });
  it('returns real noindex 404s for disabled sitemap and unknown routes', async () => {
    for (const path of ['/sitemap.xml', '/not-a-route']) {
      const response = await worker.fetch(
        new Request(`https://example.test${path}`),
        environment(),
      );
      expect(response.status).toBe(404);
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    }
  });
  it('이슈 155: 알 수 없는 경로는 404 상태로 앱 셸을 내려 SPA not-found 화면이 그려지게 한다', async () => {
    const response = await worker.fetch(
      new Request('https://example.test/not-a-route'),
      environment(),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('shell');
  });
});
