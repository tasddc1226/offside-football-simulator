import { test, expect } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { API, ok, fail } from './helpers.js';

// Render the real Worker through Vite's TS loader; only its API and ASSETS bindings are fixtures.
// The browser exercises its HTML without app hydration, then returns to the existing game board.
test.describe.configure({ mode: 'serial' });
const id = 'pst_release_20261011';
const post = {
  id,
  board: 'release',
  title: '공개 소식 테스트',
  body: '## 업데이트 내용\n- 읽을 수 있는 본문\n<script>window.newsXss=1</script>',
  version: null,
  pinned: false,
  commentCount: 0,
  viewCount: 0,
  likeCount: 0,
  createdAt: '2026-10-11T00:00:00.000Z',
  updatedAt: '2026-10-11T00:00:00.000Z',
};
let vite: ViteDevServer;
let worker: typeof import('../src/worker.js').default;
let template: string;
const originalFetch = globalThis.fetch;
let missing = false;
test.beforeAll(async () => {
  template = await readFile('dist/news-shell.html', 'utf8');
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  worker = (await vite.ssrLoadModule('/src/worker.ts')).default;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/v1/public-news/')) {
      if (url.includes('/posts/'))
        return missing ? new Response('', { status: 404 }) : Response.json({ data: { post } });
      return Response.json({ data: { posts: url.endsWith('/release') ? [post] : [] } });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
});
test.afterAll(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});
test.beforeEach(async ({ page }) => {
  missing = false;
  await page.addInitScript(() => localStorage.setItem('ft_install_dismissed', '1'));
  await page.route(`${API}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/v1/boards/posts/${id}`)
      return route.fulfill(ok({ post, comments: [], liked: false, blocks: [] }));
    if (path === '/v1/boards/viewer')
      return route.fulfill(ok({ admin: false, google: false, nickname: null }));
    if (/\/v1\/boards\/(notice|release)\/posts$/.test(path))
      return route.fulfill(ok({ posts: path.includes('/release/') ? [post] : [], hasMore: false }));
    return route.fulfill(fail(404, 'NOT_FOUND', 'Not found'));
  });
  await page.route('**/news/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await worker.fetch(
      new Request(url),
      {
        ASSETS: {
          fetch: async (request) => {
            const path = new URL(request.url).pathname;
            if (path === '/news-shell') return new Response(template);
            if (path === '/seo-policy.json')
              return Response.json({ indexingEnabled: true, origin: url.origin });
            return new Response('', { status: 404 });
          },
        },
      },
      { waitUntil: () => {} },
    );
    return route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
});
test('direct entry, refresh, plain text safety, canonical, back and mobile layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto('/news/');
  await page.getByRole('link', { name: /공개 소식 테스트/ }).click();
  await expect(page).toHaveURL(new RegExp(`/news/${id}/$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
  await expect(page.locator('article')).toContainText('<script>window.newsXss=1</script>');
  expect(
    await page.evaluate(() => (window as Window & { newsXss?: number }).newsXss),
  ).toBeUndefined();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new RegExp(`/news/${id}/$`),
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /읽을 수 있는 본문/,
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/offside-public-news-mobile.png', fullPage: true });
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('공지와 업데이트');
});
test('home links preserve game board double-click/back and public discussion deep link', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.site-foot a[href="/guide/"]')).toBeVisible();
  await expect(page.locator('.site-foot a[href="/faq/"]')).toBeVisible();
  await expect(page.locator('.site-foot a[href="/fairness/"]')).toBeVisible();
  const link = page.locator(`[data-post-row="${id}"]`);
  await expect(link).toHaveAttribute('href', `/news/${id}/`);
  await link.dblclick();
  await expect(page.locator(`[data-post="${id}"]`)).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-home-news="release"]')).toBeVisible();
  await page.goto(`/news/${id}/`);
  await page.getByRole('link', { name: '게임에서 글과 댓글 보기' }).click();
  await expect(page.locator(`[data-post="${id}"]`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`news=${id}`));
  await page.reload();
  await expect(page.locator(`[data-post="${id}"]`)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
});
test('deleted or unavailable article returns an actual 404 with noindex', async ({ page }) => {
  missing = true;
  const response = await page.goto(`/news/${id}/`);
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('article')).toHaveCount(0);
});
