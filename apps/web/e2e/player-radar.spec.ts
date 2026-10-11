import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-11-218 능력치 육각형은 선수 탭에, 훈련은 시즌 탭의 버튼 9개로 고른다(T-11-200의 육각형 이동을 되돌림).
test('선수 탭에 육각형이 있고 시즌 탭은 훈련 버튼으로 고른다', async ({ page }) => {
  await startCareer(page);

  await expect(page.locator('[data-prep] svg.radar')).toHaveCount(0);
  await expect(page.locator('[data-prep] .train [data-train]')).toHaveCount(9);
  await page.locator('[data-train="pas"]').click();
  await expect(page.locator('[data-train="pas"]')).toHaveAttribute('aria-pressed', 'true');

  // 자기 투자는 고른 한 줄만 보이고, 그 줄을 누르면 펼쳐져 고르면 다시 접힌다.
  const invest = page.locator('.invest-list button');
  await expect(invest).toHaveCount(1);
  await invest.first().click();
  await expect(invest).toHaveCount(5);
  await page.locator('[data-invest="none"]').click();
  await expect(invest).toHaveCount(1);

  await page.locator('[data-tab="player"]').click();
  const radar = page.locator('svg.radar');
  await expect(radar).toBeVisible();
  await expect(radar.locator('polygon.rd-now')).toHaveCount(1);
});
