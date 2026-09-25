import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// T-10-011 소식(게시판). API는 route로 흉내 낸다(e2e 기본 API 주소 localhost:8787).
const API = 'http://localhost:8787';
const ok = (data: unknown, status = 200) => ({ status, json: { data, meta: { requestId: 'req_e2e' } } });
const T = '2026-09-25T03:00:00.000Z';
const NOTICE = { id: 'pst_00000000-0000-0000-0000-000000000001', board: 'notice', title: '서버 점검 안내', version: null, pinned: true, commentCount: 1, createdAt: T, updatedAt: T };
const RELEASE = { id: 'pst_00000000-0000-0000-0000-000000000002', board: 'release', title: '클럽 동기화', version: 'v1.4.0', pinned: false, commentCount: 0, createdAt: T, updatedAt: T };
const COMMENT = { id: 'cmt_00000000-0000-0000-0000-000000000009', nickname: '운영자', body: '곧 끝나요', admin: true, deletable: false, createdAt: T };

async function mockBoards(page: Page, opts: { admin?: boolean } = {}) {
  const sent: { method: string; url: string; body: unknown }[] = [];
  await page.route(`${API}/v1/boards/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method !== 'GET') sent.push({ method, url: url.pathname, body: req.postDataJSON() });
    if (url.pathname === '/v1/boards/viewer') return route.fulfill(ok({ admin: !!opts.admin }));
    if (url.pathname === '/v1/boards/notice/posts' && method === 'GET') return route.fulfill(ok({ posts: [NOTICE], hasMore: false }));
    if (url.pathname === '/v1/boards/release/posts' && method === 'GET') return route.fulfill(ok({ posts: [RELEASE], hasMore: false }));
    if (url.pathname === `/v1/boards/posts/${NOTICE.id}`) {
      return route.fulfill(ok({ post: { ...NOTICE, body: '## 일정\n- 새벽 2시\n- 30분\n\n<b>그대로</b>' }, comments: [COMMENT] }));
    }
    if (url.pathname === `/v1/boards/posts/${RELEASE.id}`) return route.fulfill(ok({ post: { ...RELEASE, body: '본문' }, comments: [] }));
    if (url.pathname === `/v1/boards/posts/${NOTICE.id}/comments`) {
      const b = req.postDataJSON() as { nickname: string; body: string };
      return route.fulfill(ok({ id: 'cmt_00000000-0000-0000-0000-000000000010', ...b, admin: false, deletable: true, createdAt: T }, 201));
    }
    if (url.pathname === '/v1/boards/release/posts' && method === 'POST') {
      return route.fulfill(ok({ ...RELEASE, id: 'pst_00000000-0000-0000-0000-000000000003', body: '본문' }, 201));
    }
    if (url.pathname === '/v1/boards/posts/pst_00000000-0000-0000-0000-000000000003') {
      return route.fulfill(ok({ post: { ...RELEASE, id: 'pst_00000000-0000-0000-0000-000000000003', title: '새 버전', body: '본문' }, comments: [] }));
    }
    return route.fulfill({ status: 404, json: { error: { code: 'VALIDATION_FAILED', message: '없음', retryable: false } } });
  });
  return sent;
}

test('소식: 공지 목록 → 글 → 댓글 달기, 릴리즈 노트 탭', async ({ page }) => {
  const sent = await mockBoards(page);
  await page.goto('/');
  await page.locator('[data-home-news="notice"] [data-act="news-all"]').click();
  await expect(page.locator('[data-board-tab="notice"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-act="new-post"]')).toHaveCount(0);

  await page.locator(`[data-post-row="${NOTICE.id}"]`).click();
  const post = page.locator(`[data-post="${NOTICE.id}"]`);
  await expect(post.locator('h2')).toHaveText('서버 점검 안내');
  await expect(post.locator('.board-body h3')).toHaveText('일정');
  await expect(post.locator('.board-body li')).toHaveText(['새벽 2시', '30분']);
  await expect(post.locator('.board-body p')).toHaveText('<b>그대로</b>');
  await expect(page.locator('.board-comment').first()).toContainText('운영자');

  await page.getByLabel('닉네임').fill('팬1');
  await page.getByLabel('댓글 내용').fill('수고하세요');
  await page.locator('[data-act="send-comment"]').click();
  await expect(page.locator('.board-comment')).toHaveCount(2);
  await expect(page.locator('.board-comment').last()).toContainText('수고하세요');
  expect(sent.at(-1)).toMatchObject({ method: 'POST', body: { nickname: '팬1', body: '수고하세요' } });

  await page.locator('[data-board-tab="release"]').click();
  await expect(page.locator(`[data-post-row="${RELEASE.id}"]`)).toContainText('v1.4.0');
});

test('소식: 관리자는 새 글을 쓴다', async ({ page }) => {
  const sent = await mockBoards(page, { admin: true });
  await page.goto('/');
  await page.locator('[data-home-news="notice"] [data-act="news-all"]').click();
  await page.locator('[data-board-tab="release"]').click();
  await page.locator('[data-act="new-post"]').click();
  await page.locator('#post-title').fill('새 버전');
  await page.locator('#post-version').fill('v1.5.0');
  await page.locator('#post-body').fill('본문');
  await page.locator('[data-act="save-post"]').click();
  await expect(page.locator('[data-post="pst_00000000-0000-0000-0000-000000000003"] h2')).toHaveText('새 버전');
  expect(sent.at(-1)).toMatchObject({ method: 'POST', url: '/v1/boards/release/posts', body: { title: '새 버전', version: 'v1.5.0', body: '본문', pinned: false } });
  await expect(page.locator('[data-act="edit-post"]')).toBeVisible();
});

test('소식: 목록·글 화면에 접근성 위반이 없다', async ({ page }) => {
  await mockBoards(page, { admin: true });
  await page.goto('/');
  await page.locator('[data-home-news="notice"] [data-act="news-all"]').click();
  await expect(page.locator(`[data-post-row="${NOTICE.id}"]`)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.locator(`[data-post-row="${NOTICE.id}"]`).click();
  await expect(page.locator('.board-comment')).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
});

test('홈: 공지사항·릴리즈 노트 섹션에서 글을 누르면 바로 열린다', async ({ page }) => {
  await mockBoards(page);
  await page.goto('/');
  await expect(page.locator('[data-act="board"]')).toHaveCount(0);
  await expect(page.locator('[data-home-news="notice"]')).toContainText('서버 점검 안내');
  const release = page.locator('[data-home-news="release"]');
  await expect(release).toContainText('v1.4.0');
  await release.locator(`[data-post-row="${RELEASE.id}"]`).click();
  await expect(page.locator('[data-board-tab="release"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`[data-post="${RELEASE.id}"] h2`)).toHaveText('클럽 동기화');
});
