import { test, expect } from '@playwright/test';

test('선수 탭에 레이더 차트가 렌더링된다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h2')).toBeVisible();

  await page.locator('[data-tab="player"]').click();

  const radar = page.locator('svg.radar');
  await expect(radar).toBeVisible();
  const polygons = radar.locator('polygon.rd-now');
  await expect(polygons).toHaveCount(1);
});
