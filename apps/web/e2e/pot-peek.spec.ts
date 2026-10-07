import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
    'utf8',
  ),
);

test('T-11-133 웹은 자금을 내고 이번 시즌 스카우트 평가를 연다', async ({ page }) => {
  await resumeWithSave(page, { ...fixture, pending: null });
  await page.locator('[data-tab="player"]').click();
  await expect(page.locator('[data-pot]')).toHaveText('잠재력 평가는 은퇴할 때 공개돼요.');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).money);
  await page.locator('[data-act="pot-peek"]').click();
  await expect(page.locator('[data-pot]')).toHaveText(/등급 · 2034 시즌 스카우트 평가/);
  await expect(page.locator('[data-pot-peek]')).toHaveCount(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).money);
  expect(before - after).toBe(57150);
});

test('T-11-133 자금이 모자라면 버튼 없이 필요한 금액만 알린다', async ({ page }) => {
  await resumeWithSave(page, { ...fixture, pending: null, money: 100 });
  await page.locator('[data-tab="player"]').click();
  await expect(page.locator('[data-pot-peek="short"]')).toContainText('자금이 모자라요');
  await expect(page.locator('[data-act="pot-peek"]')).toHaveCount(0);
});
