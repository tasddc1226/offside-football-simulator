import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ok, fail, API } from './helpers.js';

// T-10-011 소식(게시판). API는 route로 흉내 낸다(e2e 기본 API 주소 localhost:8787).
const T = '2026-09-25T03:00:00.000Z';
const NOTICE = {
  id: 'pst_00000000-0000-0000-0000-000000000001',
  board: 'notice',
  title: '서버 점검 안내',
  version: null,
  pinned: true,
  commentCount: 1,
  viewCount: 12,
  likeCount: 3,
  createdAt: T,
  updatedAt: T,
};
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
const COMMENT = {
  id: 'cmt_00000000-0000-0000-0000-000000000009',
  nickname: '운영자',
  body: '곧 끝나요',
  admin: true,
  deletable: false,
  createdAt: T,
};

async function mockBoards(
  page: Page,
  opts: { admin?: boolean; empty?: boolean; google?: boolean; nickname?: string | null } = {},
) {
  const sent: { method: string; url: string; body: unknown }[] = [];
  const views: string[] = [];
  let nickname = opts.nickname ?? null;
  await page.route(`${API}/v1/profile/nickname`, async (route: Route) => {
    const req = route.request();
    const body = req.postDataJSON() as { nickname: string };
    sent.push({ method: req.method(), url: '/v1/profile/nickname', body });
    nickname = body.nickname.trim();
    return route.fulfill(
      ok({
        id: 'prf_e2e',
        linked: { google: true },
        googleEmailMasked: 'f***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: T,
        nickname,
      }),
    );
  });
  await page.route(`${API}/v1/boards/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (url.pathname.endsWith('/views')) {
      views.push(url.pathname);
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.endsWith('/like')) {
      const liked = method === 'PUT';
      return route.fulfill(ok({ liked, likeCount: NOTICE.likeCount + (liked ? 1 : 0) }));
    }
    if (method !== 'GET') sent.push({ method, url: url.pathname, body: req.postDataJSON() });
    if (url.pathname === '/v1/boards/viewer')
      return route.fulfill(
        ok({ admin: !!opts.admin, google: !!opts.google || !!opts.admin, nickname }),
      );
    if (opts.empty && url.pathname.endsWith('/posts') && method === 'GET')
      return route.fulfill(ok({ posts: [], hasMore: false }));
    if (url.pathname === '/v1/boards/notice/posts' && method === 'POST') {
      return route.fulfill(
        ok(
          {
            ...NOTICE,
            id: 'pst_00000000-0000-0000-0000-000000000004',
            pinned: false,
            body: '본문',
          },
          201,
        ),
      );
    }
    if (url.pathname === '/v1/boards/posts/pst_00000000-0000-0000-0000-000000000004') {
      return route.fulfill(
        ok({
          post: {
            ...NOTICE,
            id: 'pst_00000000-0000-0000-0000-000000000004',
            title: '첫 공지',
            pinned: false,
            body: '본문',
          },
          comments: [],
        }),
      );
    }
    if (url.pathname === '/v1/boards/notice/posts' && method === 'GET')
      return route.fulfill(ok({ posts: [NOTICE], hasMore: false }));
    if (url.pathname === '/v1/boards/release/posts' && method === 'GET')
      return route.fulfill(ok({ posts: [RELEASE], hasMore: false }));
    if (url.pathname === `/v1/boards/posts/${NOTICE.id}`) {
      return route.fulfill(
        ok({
          post: { ...NOTICE, body: '## 일정\n- 새벽 2시\n- 30분\n\n<b>그대로</b>' },
          comments: [COMMENT],
        }),
      );
    }
    if (url.pathname === `/v1/boards/posts/${RELEASE.id}`)
      return route.fulfill(ok({ post: { ...RELEASE, body: '본문' }, comments: [] }));
    if (url.pathname === `/v1/boards/posts/${NOTICE.id}/comments`) {
      const b = req.postDataJSON() as { body: string };
      return route.fulfill(
        ok(
          {
            id: 'cmt_00000000-0000-0000-0000-000000000010',
            nickname,
            body: b.body,
            admin: false,
            deletable: true,
            createdAt: T,
          },
          201,
        ),
      );
    }
    if (url.pathname === '/v1/boards/release/posts' && method === 'POST') {
      return route.fulfill(
        ok({ ...RELEASE, id: 'pst_00000000-0000-0000-0000-000000000003', body: '본문' }, 201),
      );
    }
    if (url.pathname === '/v1/boards/posts/pst_00000000-0000-0000-0000-000000000003') {
      return route.fulfill(
        ok({
          post: {
            ...RELEASE,
            id: 'pst_00000000-0000-0000-0000-000000000003',
            title: '새 버전',
            body: '본문',
          },
          comments: [],
        }),
      );
    }
    return route.fulfill(fail(404, 'VALIDATION_FAILED', '없음'));
  });
  return Object.assign(sent, { views });
}

test('소식: 공지사항 전체 보기 → 글 → 댓글, 릴리즈 노트 전체 보기는 릴리즈 노트만', async ({
  page,
}) => {
  const sent = await mockBoards(page, { google: true, nickname: '팬1' });
  await page.goto('/');
  await page.locator('[data-home-news="notice"] [data-act="news-all"]').click();
  await expect(page.locator('[data-board]')).toHaveAttribute('data-board', 'notice');
  await expect(page.locator(`[data-post-row="${RELEASE.id}"]`)).toHaveCount(0);
  await expect(page.locator('[data-act="new-post"]')).toHaveCount(0);

  await page.locator(`[data-post-row="${NOTICE.id}"]`).click();
  const post = page.locator(`[data-post="${NOTICE.id}"]`);
  await expect(post.locator('h2')).toHaveText('서버 점검 안내');
  await expect(post.locator('.board-body h3')).toHaveText('일정');
  await expect(post.locator('.board-body li')).toHaveText(['새벽 2시', '30분']);
  await expect(post.locator('.board-body p')).toHaveText('<b>그대로</b>');
  await expect(page.locator('.board-comment').first().locator('.pill.good')).toHaveText('운영자');

  // 닉네임은 입력하지 않는다 — 로그인한 프로필의 닉네임으로 남는다.
  await expect(page.getByLabel('닉네임')).toHaveCount(0);
  await expect(page.locator('.board-comments form')).toContainText('팬1');
  await page.getByLabel('댓글 내용').fill('수고하세요');
  await page.locator('[data-act="send-comment"]').click();
  await expect(page.locator('.board-comment')).toHaveCount(2);
  await expect(page.locator('.board-comment').last()).toContainText('팬1');
  await expect(page.locator('.board-comment').last()).toContainText('수고하세요');
  expect(sent.at(-1)).toEqual({
    method: 'POST',
    url: `/v1/boards/posts/${NOTICE.id}/comments`,
    body: { body: '수고하세요' },
  });

  await page.locator('[data-act="home"]').click();
  await page.locator('[data-home-news="release"] [data-act="news-all"]').click();
  await expect(page.locator('[data-board]')).toHaveAttribute('data-board', 'release');
  await expect(page.locator(`[data-post-row="${RELEASE.id}"]`)).toContainText('v1.4.0');
  await expect(page.locator(`[data-post-row="${NOTICE.id}"]`)).toHaveCount(0);
});

test('소식: 구글 로그인 전엔 댓글 대신 로그인 안내가 뜬다', async ({ page }) => {
  await mockBoards(page);
  await page.goto('/');
  await page.locator('[data-home-news="notice"] [data-act="news-all"]').click();
  await page.locator(`[data-post-row="${NOTICE.id}"]`).click();
  await expect(page.locator('[data-comment-gate="login"]')).toContainText(
    '구글로 로그인하면 댓글을 쓸 수 있어요',
  );
  await expect(page.locator('[data-act="comment-login"]')).toBeVisible();
  await expect(page.getByLabel('댓글 내용')).toHaveCount(0);
});

test('소식: 닉네임을 정하면 바로 그 이름으로 댓글을 쓴다', async ({ page }) => {
  const sent = await mockBoards(page, { google: true });
  await page.goto('/');
  await page.locator('[data-home-news="notice"] [data-act="news-all"]').click();
  await page.locator(`[data-post-row="${NOTICE.id}"]`).click();
  const gate = page.locator('[data-comment-gate="nickname"]');
  await expect(gate).toBeVisible();
  await expect(page.getByLabel('댓글 내용')).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include('.board-comments').analyze()).violations.map(
      (v) => v.id,
    ),
  ).toEqual([]);
  await gate.getByLabel('댓글 닉네임').fill(' 루키 ');
  await gate.locator('[data-act="save-nickname"]').click();
  expect(sent.at(-1)).toEqual({
    method: 'PUT',
    url: '/v1/profile/nickname',
    body: { nickname: ' 루키 ' },
  });
  await expect(page.locator('.board-comments form')).toContainText('루키');
  await page.getByLabel('댓글 내용').fill('반가워요');
  await page.locator('[data-act="send-comment"]').click();
  await expect(page.locator('.board-comment').last()).toContainText('루키');
});

test('소식: 관리자는 새 글을 쓴다', async ({ page }) => {
  const sent = await mockBoards(page, { admin: true });
  await page.goto('/');
  await page.locator('[data-home-news="release"] [data-act="news-all"]').click();
  await page.locator('[data-act="new-post"]').click();
  await page.locator('#post-title').fill('새 버전');
  await page.locator('#post-version').fill('v1.5.0');
  await page.locator('#post-body').fill('본문');
  await page.locator('[data-act="save-post"]').click();
  await expect(
    page.locator('[data-post="pst_00000000-0000-0000-0000-000000000003"] h2'),
  ).toHaveText('새 버전');
  expect(sent.at(-1)).toMatchObject({
    method: 'POST',
    url: '/v1/boards/release/posts',
    body: { title: '새 버전', version: 'v1.5.0', body: '본문', pinned: false },
  });
  await expect(page.locator('[data-act="edit-post"]')).toBeVisible();
});

test('소식: 글이 하나도 없어도 전체 보기로 들어가 관리자가 첫 글을 쓴다', async ({ page }) => {
  const sent = await mockBoards(page, { admin: true, empty: true });
  await page.goto('/');
  const notice = page.locator('[data-home-news="notice"]');
  await expect(notice).toContainText('아직 올라온 글이 없어요');
  await notice.locator('[data-act="news-all"]').click();
  await expect(page.locator('[data-board]')).toHaveAttribute('data-board', 'notice');
  await page.locator('[data-act="new-post"]').click();
  await page.locator('#post-title').fill('첫 공지');
  await page.locator('#post-body').fill('본문');
  await page.locator('[data-act="save-post"]').click();
  await expect(
    page.locator('[data-post="pst_00000000-0000-0000-0000-000000000004"] h2'),
  ).toHaveText('첫 공지');
  expect(sent.at(-1)).toMatchObject({
    method: 'POST',
    url: '/v1/boards/notice/posts',
    body: { title: '첫 공지', body: '본문', pinned: false },
  });
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
  await expect(page.locator('[data-home-news="notice"]')).toContainText('서버 점검 안내');
  const release = page.locator('[data-home-news="release"]');
  await expect(release).toContainText('v1.4.0');
  await release.locator(`[data-post-row="${RELEASE.id}"]`).click();
  await expect(page.locator('[data-board]')).toHaveAttribute('data-board', 'release');
  await expect(page.locator(`[data-post="${RELEASE.id}"] h2`)).toHaveText('클럽 동기화');
});

test('홈 하단 메뉴: 소식 → 릴리즈 노트로 바꾸기 → 기록실 → 구단주 → 설정 → 홈', async ({
  page,
}) => {
  await mockBoards(page);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '메인 메뉴' });
  await expect(nav.locator('[aria-current="page"]')).toHaveText('홈');

  await nav.getByRole('button', { name: '소식' }).click();
  await expect(page.locator('[data-board]')).toHaveAttribute('data-board', 'notice');
  await expect(nav.locator('[aria-current="page"]')).toHaveText('소식');
  await page.locator('[data-board-tab="release"]').click();
  await expect(page.locator('[data-board]')).toHaveAttribute('data-board', 'release');
  await expect(page.locator('[data-board-tab="release"]')).toHaveAttribute('aria-pressed', 'true');

  await nav.getByRole('button', { name: '기록실' }).click();
  await expect(page.locator('h1')).toHaveText('명예의 전당');
  await nav.getByRole('button', { name: '구단주' }).click();
  await expect(page.locator('h1')).toHaveText('구단주');
  await nav.getByRole('button', { name: '설정' }).click();
  await expect(page.locator('h1')).toHaveText('환경설정');
  await nav.getByRole('button', { name: '홈' }).click();
  await expect(page.locator('[data-act="new"]')).toBeVisible();
});

test('소식: 조회수는 기기마다 한 번, 좋아요를 누르고 거둔다', async ({ page }) => {
  const sent = await mockBoards(page);
  await page.goto('/');
  await page.locator('[data-act="board"]').click();
  await expect(page.locator(`[data-post-row="${NOTICE.id}"]`)).toContainText(
    '조회 12 · 좋아요 3 · 댓글 1',
  );
  await page.locator(`[data-post-row="${NOTICE.id}"]`).click();
  const post = page.locator(`[data-post="${NOTICE.id}"]`);
  await expect(post).toContainText('조회 13');
  expect(sent.views).toEqual([`/v1/boards/posts/${NOTICE.id}/views`]);

  const like = page.locator('[data-act="like"]');
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await expect(like.locator('[data-like-count]')).toHaveText('4');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await expect(like.locator('[data-like-count]')).toHaveText('3');

  // 같은 기기에서 다시 열면 조회수를 보내지 않는다.
  await page.locator('[data-act="back-list"]').click();
  await page.locator(`[data-post-row="${NOTICE.id}"]`).click();
  await expect(post).toBeVisible();
  expect(sent.views).toHaveLength(1);
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
});

test('새 소식 알림: 마지막으로 본 뒤 올라온 글을 화면 위에 알리고, 보면 다시 뜨지 않는다', async ({
  page,
}) => {
  await mockBoards(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('ft_news_seen'))
      localStorage.setItem('ft_news_seen', JSON.stringify('2026-09-24T00:00:00.000Z'));
  });
  await page.goto('/');
  const banner = page.locator('[data-news-banner]');
  await expect(banner).toContainText('새 소식 2개가 올라왔어요');
  await banner.locator('[data-act="news-open"]').click();
  await expect(page.locator('[data-post]')).toBeVisible();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-home-news="notice"]')).toContainText(NOTICE.title);
  await expect(banner).toHaveCount(0);
});

test('새 소식 알림: 처음 온 기기에는 지금까지의 글을 알리지 않고, 닫으면 사라진다', async ({
  page,
}) => {
  await mockBoards(page);
  await page.goto('/');
  await expect(page.locator('[data-home-news="notice"]')).toContainText(NOTICE.title);
  await expect(page.locator('[data-news-banner]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('ft_news_seen'))).toBe(
    JSON.stringify(NOTICE.createdAt),
  );

  await page.evaluate(() =>
    localStorage.setItem('ft_news_seen', JSON.stringify('2026-09-24T00:00:00.000Z')),
  );
  await page.reload();
  const banner = page.locator('[data-news-banner]');
  await expect(banner).toBeVisible();
  await banner.locator('[data-act="news-close"]').click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('ft_news_seen'))).toBe(
    JSON.stringify(NOTICE.createdAt),
  );
});
