import { expect, test } from '@playwright/test';

// T-11-355 처음 안내 카드. 기본 설정(playwright.config storageState)은 카드를 닫은 채로 시작하므로 여기서만 연다.
test('처음 안내 카드는 첫 화면에 바로 뜨고, 닫으면 다시 열어도 뜨지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__fg_seeded')) return;
    sessionStorage.setItem('__fg_seeded', '1');
    localStorage.removeItem('ft_first_guide');
  });
  await page.goto('/');
  const card = page.locator('[data-first-guide]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('리롤권 · 스카우트권 · 강화권');
  await page.locator('[data-act="first-guide-close"]').click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-act="home-market"]')).toBeVisible();
  await expect(card).toHaveCount(0);
});
