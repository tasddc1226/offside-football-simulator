import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import { newsHtml } from './public-news.js';
const id = 'pst_release_20261011';
const post = {
  id,
  board: 'release',
  title: 'A "title" <script>',
  body: '## Heading\n- Safe\n<script>alert(1)</script> $&',
  createdAt: '2026-10-11T00:00:00Z',
  updatedAt: '2026-10-11T00:00:00Z',
};
const template =
  '<html><head><title>old</title><!-- offside-seo:start --><meta name="robots" content="noindex"><!-- offside-seo:end --></head><body><!-- public-news-body --></body></html>';
function assets(enabled = true) {
  return {
    fetch: async (req: Request) => {
      const path = new URL(req.url).pathname;
      if (path === '/seo-policy.json')
        return Response.json({ indexingEnabled: enabled, origin: 'https://offside-lab.com' });
      if (path === '/news-shell') return new Response(template);
      if (path === '/sitemap.xml')
        return new Response('<urlset><url><loc>https://offside-lab.com/</loc></url></urlset>');
      if (path === '/app-shell') return new Response('game');
      return new Response('', { status: 404 });
    },
  };
}
const get = (path: string, enabled = true, host = 'offside-lab.com', method = 'GET') =>
  worker.fetch(
    new Request(`https://${host}${path}`, { method }),
    { ASSETS: assets(enabled) },
    { waitUntil: () => {} },
  );
const mock = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json({
        data: url.includes('/posts/')
          ? { post }
          : { posts: url.endsWith('/release') ? [post] : [] },
      }),
    ),
  );
afterEach(() => vi.unstubAllGlobals());
describe('public news responses', () => {
  it('renders readable escaped article and metadata with canonical URL and no comments', async () => {
    mock();
    const r = await get(`/news/${id}/`);
    const html = await r.text();
    expect(r.status).toBe(200);
    expect(r.headers.get('X-Robots-Tag')).toBe('index, follow');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(html).toContain('<h2>Heading</h2><ul><li>Safe</li></ul>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; $&');
    expect(html).not.toContain('<script>');
    expect(html).toContain(`href="https://offside-lab.com/news/${id}/"`);
    expect(html).toContain(`/?news=${id}&amp;board=release`);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    // 소제목·목록 글머리 없이 본문 글만
    expect(html).toContain(
      'name="description" content="Safe &lt;script&gt;alert(1)&lt;/script&gt; $&amp;"',
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/public-news/posts/'),
      expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
    );
  });
  it('links both boards from HTML and sitemap with two bounded index reads, no N+1', async () => {
    mock();
    expect(await (await get('/news/')).text()).toContain(`href="/news/${id}/"`);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await (await get('/sitemap.xml')).text()).toContain(
      `<loc>https://offside-lab.com/news/${id}/</loc>`,
    );
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it('normalizes all duplicate news URLs before reading data', async () => {
    mock();
    for (const path of [
      '/news',
      '/news/index.html',
      '/news/?lang=en',
      `/news/${id}`,
      `/news/${id}/index.html`,
      `/news/${id}/?x=1`,
    ]) {
      const r = await get(path);
      expect(r.status, path).toBe(308);
      expect(r.headers.get('Location')).toBe(path.includes(id) ? `/news/${id}/` : '/news/');
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects unknown IDs and private namespaces without an upstream request', async () => {
    mock();
    for (const path of [
      '/news/draft/',
      '/news/lounge/a/',
      '/news/cmt_00000000-0000-0000-0000-000000000000/',
    ])
      expect((await get(path)).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('returns real 404 for missing/deleted posts and never caches it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    const r = await get(`/news/${id}/`);
    expect(r.status).toBe(404);
    expect(r.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });
  it('fails closed on upstream errors, private boards and mismatched IDs', async () => {
    for (const bad of [
      { ...post, board: 'lounge' },
      { ...post, id: 'pst_release_20260101' },
    ]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ data: { post: bad } })),
      );
      const r = await get(`/news/${id}/`);
      expect(r.status).toBe(503);
      expect(r.headers.get('X-Robots-Tag')).toContain('noindex');
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('timeout');
      }),
    );
    expect((await get('/news/')).status).toBe(503);
    expect((await get('/sitemap.xml')).status).toBe(503);
  });
  it('preserves preview/staging and game noindex, handles HEAD without a body', async () => {
    mock();
    for (const [enabled, host] of [
      [false, 'offside-lab.com'],
      [true, 'preview.example'],
    ] as const) {
      const r = await get(`/news/${id}/`, enabled, host);
      expect(r.headers.get('X-Robots-Tag')).toContain('noindex');
      expect(await r.text()).toContain('content="noindex, nofollow"');
    }
    expect((await get(`/?news=${id}&board=release`)).headers.get('X-Robots-Tag')).toContain(
      'noindex',
    );
    expect(await (await get(`/news/${id}/`, true, 'offside-lab.com', 'HEAD')).text()).toBe('');
    expect((await get('/news/', true, 'offside-lab.com', 'POST')).status).toBe(405);
  });
  it('uses replacement callbacks so dollar sequences cannot inject template content', () => {
    const html = newsHtml(
      template,
      'https://offside-lab.com',
      '/news/',
      true,
      "$' $& <x>",
      "$' $&",
      '<h1>Safe</h1>',
    );
    expect(html).toContain('<title>$&#39; $&amp; &lt;x&gt;</title>');
    expect(html.match(/<html>/g)).toHaveLength(1);
  });
});
