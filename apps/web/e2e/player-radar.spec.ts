import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

test('선수 탭에 레이더 차트가 렌더링된다', async ({ page }) => {
  await startCareer(page);

  await page.locator('[data-tab="player"]').click();

  const radar = page.locator('svg.radar');
  await expect(radar).toBeVisible();
  const polygons = radar.locator('polygon.rd-now');
  await expect(polygons).toHaveCount(1);
});
