import { test, expect } from '@playwright/test';

// T-10-114 모바일 뒤로 가기(iOS 가장자리 밀기·Android 뒤로)가 앱 안의 이전 화면으로 간다. 시작한 커리어의 생성
// 화면으로는 돌아가지 않는다(같은 후보로 다시 시작하는 일을 막는다).
test('뒤로 가기: 생성 2단계 → 1단계 → 홈, 게임에서는 홈으로 나가고 생성 화면으로는 돌아가지 않는다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  const next = page.locator('[data-act="next-candidates"]');
  await next.click();
  await page.locator('[data-scout-scan]').click();
  await expect(page.locator('[data-cand="0"]')).toBeVisible();

  await page.goBack();
  await expect(next).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-cand="0"]')).toBeVisible();

  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();

  await page.goBack();
  await expect(page.locator('[data-act="continue"]')).toBeVisible();
  await expect(page.locator('[data-cand="0"]')).toHaveCount(0);
  await page.goForward();
  await expect(page.locator('.player h1')).toBeVisible();
});
