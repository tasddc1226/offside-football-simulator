import { expect, test } from '@playwright/test';
import { createStep, startCareer } from './helpers.js';

// T-11-732 용어 사전과 "?" 설명 창. 화면 표시만 하므로 세이브(난수 포함)를 바꾸지 않아야 한다.
test('설정의 용어 사전은 확률 도감에서 펼친 채로 열린다', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="glossary"]').click();
  const glossary = page.locator('[data-glossary]');
  await expect(glossary).toHaveAttribute('open', '');
  await expect(glossary.locator('[data-term="ovr"]')).toHaveText('OVR');
  await expect(glossary.locator('[data-term="offside"]')).toHaveText('오프사이드');
  await expect(glossary.locator('[data-glossary-group]')).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('선수 만들기의 "?"는 설명만 띄우고 화면을 떠나지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await createStep(page, 'pos');
  await page.locator('[data-term-help="createPos"]').click();
  const sheet = page.getByRole('dialog', { name: '용어 설명' });
  await expect(sheet.locator('[data-term-sheet="createPos"]')).toContainText('공격수');
  await expect(sheet.locator('[data-act="glossary-all"]')).toHaveCount(0);
  await sheet.locator('[data-act="term-close"]').click();
  await expect(sheet).toHaveCount(0);
  // 설명 창을 닫아도 고르던 포지션 단계 그대로다.
  await expect(page.locator('[data-coach="pos"]')).toBeVisible();
});

test('시즌 탭의 "?"에서 용어 사전으로 가도 세이브는 그대로다', async ({ page }) => {
  await startCareer(page);
  const before = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.locator('[data-term-help="seasonPrep"]').click();
  const sheet = page.getByRole('dialog', { name: '용어 설명' });
  await expect(sheet).toContainText('컨디션');
  await expect(sheet).toContainText('사기');
  await sheet.locator('[data-act="glossary-all"]').click();
  await expect(page.locator('[data-glossary]')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(before);
});
