import { test, expect } from '@playwright/test';

test.describe('앱 로드', () => {
  test('홈 화면이 뜬다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand b')).toHaveText('오프사이드');
    await expect(page.locator('.brand small')).toHaveText('풀타임: 휘슬이 울릴 때까지');
    await expect(page.getByRole('button', { name: /새 커리어 킥오프/ })).toBeVisible();
  });

  test('페이지 타이틀이 올바르다', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('오프사이드 — 풀타임 축구 커리어');
  });
});
