import { test, expect } from '@playwright/test';

test('OVR guidance follows selected role and remains visible when comparing candidates', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-06T01:00:00Z'));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.locator('[data-act="new"]').click();
  const guide = page.getByTestId('ovr-guide');
  await expect(guide).toContainText('수비(헤딩)');
  await expect(guide).toContainText('헤딩 정확도만');
  await page.locator('[data-set="dpos"][data-val="W"]').click();
  await expect(guide).not.toContainText('수비(헤딩)');
  await expect(guide).toContainText('크로스');
  await page.locator('[data-set="dpos"][data-val="ST"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await expect(guide).toContainText('수비(헤딩)');
  await page.locator('[data-cand="0"]').click();
  await expect(page.locator('[data-cand="0"] .ovr-core')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.locator('[data-act="start"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).dpos)).toBe('ST');
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).dpos)).toBe('ST');
});
