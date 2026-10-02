import { test, expect } from '@playwright/test';
import { API, fail, ok } from './helpers.js';

const PROFILE_URL = `${API}/v1/profile`;

test('계정 영역: 홈이 아니라 설정 화면에 있다 — 로그아웃 상태(API 스텁)', async ({ page }) => {
  await page.route(PROFILE_URL, (route) =>
    route.fulfill(
      ok({
        id: 'u1',
        linked: { google: false },
        googleEmailMasked: null,
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );

  await page.goto('/');
  await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
  await expect(page.locator('#account-slot')).toHaveCount(0);
  await page.locator('[data-act="owner"]').click();
  const account = page.locator('#account-slot');
  // T-10-102 비로그인 카드는 안내만, 로그인 버튼은 카드 밖에 하나.
  await expect(account).toContainText('로그인하지 않았어요');
  await expect(account.getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '구글로 로그인' })).toHaveAttribute(
    'href',
    `${API}/v1/auth/google/start`,
  );
});

test('/settings?google=linked: 토스트 표시 후 URL 정리', async ({ page }) => {
  await page.route(PROFILE_URL, (route) =>
    route.fulfill(
      ok({
        id: 'u1',
        linked: { google: true },
        googleEmailMasked: 'te***@gmail.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );

  await page.goto('/settings?google=linked');

  await expect(page.locator('#toast')).toContainText('구글 계정을 연결했어요');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('h1')).toHaveText('구단주');

  const account = page.locator('#account-slot');
  await expect(account).toContainText('연동 해제');
  await expect(account).toContainText('te***@gmail.com');
});

test('/settings?google=error&reason=state: 실패 토스트가 이유와 함께 표시된다', async ({
  page,
}) => {
  await page.route(PROFILE_URL, (route) =>
    route.fulfill(
      ok({
        id: 'u1',
        linked: { google: false },
        googleEmailMasked: null,
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );

  await page.goto('/settings?google=error&reason=state');
  await expect(page.locator('#toast')).toContainText('구글 로그인에 실패했어요');
  await expect(page.locator('#toast')).toContainText('state');
  await expect(page).toHaveURL(/\/$/);
});

test('로그아웃은 확인 창에서 한 번 더 확인한다', async ({ page }) => {
  await page.route(PROFILE_URL, (route) =>
    route.fulfill(
      ok({
        id: 'u1',
        linked: { google: true },
        googleEmailMasked: 'te***@gmail.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );
  let logouts = 0;
  await page.route(`${API}/v1/auth/logout`, (route) => {
    logouts++;
    return route.fulfill({ status: 204 });
  });

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  const account = page.locator('#account-slot');
  await account.locator('[data-act="logout"]').click();
  await expect(page.locator('#sheet')).toContainText('로그아웃할까요?');
  await page.locator('#sheet [data-sheet="1"]').click();
  await expect(account).toContainText('te***@gmail.com');
  expect(logouts).toBe(0);

  await account.locator('[data-act="logout"]').click();
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(account).toContainText('로그인하지 않았어요');
  await expect(page.locator('[data-act="google-login"]')).toBeVisible();
  expect(logouts).toBe(1);
});

test('로그아웃 직후 다시 구글로 로그인하면 새 세션부터 받고 시작한다', async ({ page }) => {
  // 로그아웃이 세션 쿠키를 지우므로, 로그인 시작 전에 GET /v1/profile(익명 세션 발급)을 거쳐야 한다.
  let loggedOut = false;
  const calls: string[] = [];
  await page.route(PROFILE_URL, (route) => {
    calls.push('profile');
    return route.fulfill(
      ok({
        id: 'u1',
        linked: { google: !loggedOut },
        googleEmailMasked: 'te***@gmail.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    );
  });
  await page.route(`${API}/v1/auth/logout`, (route) => {
    loggedOut = true;
    return route.fulfill({ status: 204 });
  });
  await page.route(`${API}/v1/auth/google/start`, (route) => {
    calls.push('start');
    return route.fulfill({
      status: 302,
      headers: { Location: `${new URL(page.url()).origin}/settings?google=linked` },
    });
  });

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  const account = page.locator('#account-slot');
  await account.locator('[data-act="logout"]').click();
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(account).toContainText('로그인하지 않았어요');
  calls.length = 0;
  await page.locator('[data-act="google-login"]').click();
  await expect(page.locator('#toast')).toContainText('구글 계정을 연결했어요');
  expect(calls.slice(0, 2)).toEqual(['profile', 'start']);
});

test('세션 없이 로그인 시작에서 돌아오면 다시 누르라고 알린다', async ({ page }) => {
  await page.goto('/settings?google=error&reason=session');
  await expect(page.locator('#toast')).toContainText('한 번 더 눌러 주세요');
});

test('계정 카드에서 댓글 닉네임을 정하고 바꾼다 (T-10-028)', async ({ page }) => {
  let nickname: string | null = null;
  const profile = () => ({
    id: 'u1',
    linked: { google: true },
    googleEmailMasked: 'te***@gmail.com',
    recoveryCodeIssuedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    nickname,
  });
  await page.route(PROFILE_URL, (route) => route.fulfill(ok(profile())));
  const puts: unknown[] = [];
  await page.route(`${PROFILE_URL}/nickname`, (route) => {
    const body = route.request().postDataJSON() as { nickname: string };
    puts.push(body);
    if (body.nickname === '중복') {
      return route.fulfill(fail(409, 'VALIDATION_FAILED', '이미 쓰고 있는 닉네임이에요.'));
    }
    nickname = body.nickname;
    return route.fulfill(ok(profile()));
  });

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  const account = page.locator('#account-slot');
  await expect(account).toContainText('정하면 소식 게시판에 댓글을 쓸 수 있어요');
  const input = account.getByLabel('댓글 닉네임');
  await input.fill('중복');
  await account.locator('[data-act="save-nickname"]').click();
  await expect(page.locator('#toast')).toContainText('이미 쓰고 있는 닉네임이에요');

  await input.fill('루키');
  await account.locator('[data-act="save-nickname"]').click();
  await expect(page.locator('#toast')).toContainText('닉네임을 정했어요');
  await expect(account.getByLabel('댓글 닉네임')).toHaveValue('루키');
  await expect(account.locator('[data-act="save-nickname"]')).toHaveText('바꾸기');
  await expect(account.locator('[data-act="save-nickname"]')).toBeDisabled();
  expect(puts).toEqual([{ nickname: '중복' }, { nickname: '루키' }]);
});

test('소식에서 댓글을 쓰려고 로그인하면, 돌아와서 보던 글을 연다 (T-10-028)', async ({ page }) => {
  const POST = 'pst_00000000-0000-0000-0000-000000000001';
  const T = '2026-09-25T03:00:00.000Z';
  const summary = {
    id: POST,
    board: 'release',
    title: '260926 릴리즈 노트',
    version: null,
    pinned: false,
    commentCount: 0,
    viewCount: 0,
    likeCount: 0,
    createdAt: T,
    updatedAt: T,
  };
  await page.route(PROFILE_URL, (route) =>
    route.fulfill(
      ok({
        id: 'u1',
        linked: { google: true },
        googleEmailMasked: 'te***@gmail.com',
        recoveryCodeIssuedAt: null,
        createdAt: T,
        nickname: null,
      }),
    ),
  );
  await page.route(`${API}/v1/boards/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/v1/boards/viewer')
      return route.fulfill(ok({ admin: false, google: false, nickname: null }));
    if (path === `/v1/boards/posts/${POST}`)
      return route.fulfill(ok({ post: { ...summary, body: '본문' }, comments: [] }));
    return route.fulfill(ok({ posts: [summary], hasMore: false }));
  });
  // 구글 로그인 시작은 콜백 결과로 곧장 돌려보낸다(실제로는 구글을 거친다).
  await page.route(`${API}/v1/auth/google/start`, (route) =>
    route.fulfill({
      status: 302,
      headers: { Location: `${new URL(page.url()).origin}/settings?google=linked` },
    }),
  );

  await page.goto('/');
  await page.locator(`[data-home-news="release"] [data-post-row="${POST}"]`).click();
  await page.locator('[data-act="comment-login"]').click();
  await expect(page.locator('#toast')).toContainText('구글 계정을 연결했어요');
  await expect(page.locator('[data-board]')).toHaveAttribute('data-board', 'release');
  await expect(page.locator(`[data-post="${POST}"] h2`)).toHaveText('260926 릴리즈 노트');
});

test("운영자 계정은 댓글 닉네임이 '운영자'로 고정돼 바꾸는 칸이 없다 (T-10-028)", async ({
  page,
}) => {
  await page.route(PROFILE_URL, (route) =>
    route.fulfill(
      ok({
        id: 'u1',
        linked: { google: true },
        googleEmailMasked: 'ad***@gmail.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        nickname: '운영자',
      }),
    ),
  );
  await page.route(`${API}/v1/boards/**`, (route) =>
    route.fulfill(ok({ admin: true, google: true, nickname: '운영자' })),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  const account = page.locator('#account-slot');
  await expect(account).toContainText('운영자 · 운영자 계정은 고정이에요');
  await expect(account.getByLabel('댓글 닉네임')).toHaveCount(0);
});
