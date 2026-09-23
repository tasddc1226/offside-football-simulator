import { test, expect } from '@playwright/test';

const PROFILE_URL = 'http://localhost:8787/v1/profile';

test('계정 영역: 로그아웃 상태(API 스텁)', async ({ page }) => {
  await page.route(PROFILE_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id: 'u1', linked: { google: false }, googleEmailMasked: null, recoveryCodeIssuedAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
      }),
    }),
  );

  await page.goto('/');
  const account = page.locator('#account-slot .account');
  await expect(account).toContainText('구글로 로그인');
  await expect(account.getByRole('link', { name: '구글로 로그인' })).toHaveAttribute(
    'href',
    'http://localhost:8787/v1/auth/google/start',
  );
});

test('/settings?google=linked: 토스트 표시 후 URL 정리', async ({ page }) => {
  await page.route(PROFILE_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'u1',
          linked: { google: true },
          googleEmailMasked: 'te***@gmail.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    }),
  );

  await page.goto('/settings?google=linked');

  await expect(page.locator('#toast')).toContainText('구글 계정을 연결했습니다');
  await expect(page).toHaveURL(/\/$/);

  const account = page.locator('#account-slot .account');
  await expect(account).toContainText('연동 해제');
  await expect(account).toContainText('te***@gmail.com');
});

test('/settings?google=error&reason=state: 실패 토스트가 이유와 함께 표시된다', async ({ page }) => {
  await page.route(PROFILE_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { id: 'u1', linked: { google: false }, googleEmailMasked: null, recoveryCodeIssuedAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
      }),
    }),
  );

  await page.goto('/settings?google=error&reason=state');
  await expect(page.locator('#toast')).toContainText('구글 로그인에 실패했습니다');
  await expect(page.locator('#toast')).toContainText('state');
  await expect(page).toHaveURL(/\/$/);
});
