import { expect, type Page } from '@playwright/test';

/** 홈 화면에서 새 커리어를 킥오프하고 선수 화면이 뜰 때까지 기다린다. */
export async function startCareer(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h2')).toBeVisible();
}
