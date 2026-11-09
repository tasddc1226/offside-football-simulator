import { test, expect, type Page, type Route } from '@playwright/test';
import { ok, API } from './helpers.js';

// audit F1: 새 소식 배너가 선수 만들기의 제목 · 단계 버튼을 덮지 않는다. 만들기에서는 숨기기만 하고(본 것으로 치지 않는다)
// 홈 · 다른 화면으로 돌아오면 같은 알림이 다시 보인다. 소식 화면에서 띄우지 않는 기존 규칙과 닫기 · 보기도 그대로다.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const T = '2026-09-25T03:00:00.000Z';
const SEEN = '2026-09-24T00:00:00.000Z';
const RELEASE = {
  id: 'pst_00000000-0000-0000-0000-000000000002',
  board: 'release',
  title: '클럽 동기화',
  version: 'v1.4.0',
  pinned: false,
  commentCount: 0,
  viewCount: 0,
  likeCount: 0,
  createdAt: T,
  updatedAt: T,
};

async function mockNews(page: Page, seen: string | null) {
  await page.route(`${API}/v1/boards/**`, (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/v1/boards/viewer')
      return route.fulfill(ok({ admin: false, google: false, nickname: null }));
    if (url.pathname === '/v1/boards/release/posts')
      return route.fulfill(ok({ posts: [RELEASE], hasMore: false }));
    if (url.pathname.endsWith('/posts')) return route.fulfill(ok({ posts: [], hasMore: false }));
    if (url.pathname === `/v1/boards/posts/${RELEASE.id}`)
      return route.fulfill(ok({ post: { ...RELEASE, body: '본문' }, comments: [] }));
    if (url.pathname.endsWith('/views')) return route.fulfill({ status: 204 });
    return route.fulfill(ok({}));
  });
  if (seen)
    await page.addInitScript((s) => {
      if (!localStorage.getItem('ft_news_seen'))
        localStorage.setItem('ft_news_seen', JSON.stringify(s));
    }, seen);
}

const seenValue = (page: Page) => page.evaluate(() => localStorage.getItem('ft_news_seen'));

/** 제목과 단계 버튼 가운데를 실제로 누르면 그 요소(또는 그 안)가 맞는다 — 위에 덮인 것이 없다. */
async function expectNotCovered(page: Page) {
  const covered = await page.evaluate(() => {
    const els = [
      document.querySelector('.create-wizard h1'),
      ...document.querySelectorAll('.cw-steps [data-step-go]'),
    ].filter((e): e is Element => !!e);
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !hit || !(el === hit || el.contains(hit));
      })
      .map((el) => el.outerHTML.slice(0, 60));
  });
  expect(covered).toEqual([]);
}

test('새 소식 배너: 선수 만들기에서는 숨겨 단계를 고를 수 있고, 홈 · 다른 화면에서 다시 보인다', async ({
  page,
}) => {
  await mockNews(page, SEEN);
  await page.goto('/');
  const banner = page.locator('[data-news-banner]');
  await expect(banner).toContainText('새 릴리즈 노트가 올라왔어요');

  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await expect(page.locator('.create-wizard h1')).toBeVisible();
  await expect(banner).toHaveCount(0);
  await expectNotCovered(page);
  // 단계 버튼을 실제로 눌러 오간다.
  for (const step of ['focus', 'trait', 'info', 'pos'] as const) {
    await page.locator(`.cw-steps [data-step-go="${step}"]`).click();
    await expect(page.locator(`.cw-steps [data-step-go="${step}"]`)).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(banner).toHaveCount(0);
  }
  // 숨김은 본 것으로 치지 않는다.
  expect(await seenValue(page)).toBe(JSON.stringify(SEEN));

  // 취소로 홈에 돌아오면 같은 알림이 다시 뜬다.
  await page.locator('[data-act="home"]').click();
  await expect(banner).toContainText(RELEASE.title);

  // 다른 허용 화면(설정 · 구단주)에서도 남아 있다.
  await page.locator('.main-nav [data-act="settings"]').click();
  await expect(banner).toBeVisible();
  await page.locator('.main-nav [data-act="owner"]').click();
  await expect(banner).toBeVisible();

  // 소식 화면에서는 기존처럼 띄우지 않고, 홈으로 오면 다시 보인다.
  await page.locator('.main-nav [data-act="board"]').click();
  await expect(page.locator('[data-board]')).toBeVisible();
  await expect(banner).toHaveCount(0);
  await page.locator('.main-nav [data-act="home"]').click();
  await expect(banner).toBeVisible();

  // 만들기를 한 번 더 들렀다 와도 같고, 이번엔 '보기'로 글을 열면 본 것으로 기록돼 다시 뜨지 않는다.
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await expect(banner).toHaveCount(0);
  await page.locator('[data-act="home"]').click();
  await banner.locator('[data-act="news-open"]').click();
  await expect(page.locator(`[data-post="${RELEASE.id}"]`)).toBeVisible();
  expect(await seenValue(page)).toBe(JSON.stringify(T));
  await page.locator('.main-nav [data-act="home"]').click();
  await expect(page.locator('[data-home-news]')).toContainText(RELEASE.title);
  await expect(banner).toHaveCount(0);
});

test('새 소식 배너: 닫은 뒤에는 만들기에서 돌아와도 다시 뜨지 않는다', async ({ page }) => {
  await mockNews(page, SEEN);
  await page.goto('/');
  const banner = page.locator('[data-news-banner]');
  await expect(banner).toBeVisible();
  await banner.locator('[data-act="news-close"]').click();
  await expect(banner).toHaveCount(0);
  expect(await seenValue(page)).toBe(JSON.stringify(T));
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await expect(page.locator('.create-wizard h1')).toBeVisible();
  await page.locator('[data-act="home"]').click();
  await expect(page.locator('[data-home-news]')).toContainText(RELEASE.title);
  await expect(banner).toHaveCount(0);
});

test('새 소식 배너: 새 글이 없으면(처음 온 기기) 홈 · 만들기 어디에도 없다', async ({ page }) => {
  await mockNews(page, null);
  await page.goto('/');
  await expect(page.locator('[data-home-news]')).toContainText(RELEASE.title);
  const banner = page.locator('[data-news-banner]');
  await expect(banner).toHaveCount(0);
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await expect(page.locator('.create-wizard h1')).toBeVisible();
  await expectNotCovered(page);
  await expect(banner).toHaveCount(0);
});
