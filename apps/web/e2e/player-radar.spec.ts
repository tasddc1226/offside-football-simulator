import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-11-218 능력치 육각형은 선수 탭에, 훈련은 시즌 탭의 버튼 9개로 고른다(T-11-200의 육각형 이동을 되돌림).
// T-11-219 시즌 탭은 아이콘으로 버튼 보기·육각형 보기를 바꿔 본다(기본은 버튼).
test('선수 탭에 육각형이 있고 시즌 탭은 훈련 버튼으로 고른다', async ({ page }) => {
  await startCareer(page);

  await expect(page.locator('[data-prep] svg.radar')).toHaveCount(0);
  await expect(page.locator('[data-prep] .train [data-train]')).toHaveCount(9);
  await page.locator('[data-train="pas"]').click();
  await expect(page.locator('[data-train="pas"]')).toHaveAttribute('aria-pressed', 'true');

  // T-11-219 자기 투자는 칸을 늘 보여 주고 한 번 눌러 고른다. 고른 투자의 설명은 아래 칸에.
  // T-11-221 '투자 안 함' 칸은 없애고, 고른 뒤에 설명 칸의 '선택 해제'로 되돌린다.
  const invest = page.locator('.invest-grid button');
  await expect(invest).toHaveCount(4);
  await page.locator('[data-invest="mental"]').click();
  await expect(page.locator('[data-invest="mental"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-invest-help]')).toContainText('멘탈 코칭');
  await page.locator('[data-invest="none"]').click();
  await expect(page.locator('[data-invest-help]')).toContainText('자금을 쓰지 않아요');

  // T-11-219 시즌 탭 훈련 방향은 아이콘으로 육각형 보기로 바꿀 수 있다. 축이 능력치 훈련, 아래 3개가 나머지 훈련이다.
  await page.locator('[data-train-view="radar"]').click();
  await expect(page.locator('[data-prep] svg.radar')).toHaveCount(1);
  await expect(page.locator('[data-prep] .tr-axis')).toHaveCount(6);
  await expect(page.locator('[data-prep] .train [data-train]')).toHaveCount(3);
  await page.locator('.tr-axis[data-train="sho"]').click();
  await expect(page.locator('.tr-axis[data-train="sho"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-train-view="buttons"]').click();
  await expect(page.locator('[data-prep] svg.radar')).toHaveCount(0);
  await expect(page.locator('[data-train="sho"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-tab="player"]').click();
  const radar = page.locator('svg.radar');
  await expect(radar).toBeVisible();
  await expect(radar.locator('polygon.rd-now')).toHaveCount(1);
});
