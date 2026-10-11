import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-11-200 능력치 육각형은 시즌 탭 훈련 방향으로 옮겨 갔다(축 이름표가 곧 훈련 버튼). 선수 탭에는 없다.
test('시즌 탭 훈련 육각형에서 축을 눌러 훈련을 고르고 선수 탭에는 육각형이 없다', async ({
  page,
}) => {
  await startCareer(page);

  const radar = page.locator('.train-radar svg.radar');
  await expect(radar).toBeVisible();
  await expect(radar.locator('polygon.rd-now')).toHaveCount(1);
  await expect(page.locator('.train-radar [data-train]')).toHaveCount(6);
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
  await expect(page.locator('svg.radar')).toHaveCount(0);
});
