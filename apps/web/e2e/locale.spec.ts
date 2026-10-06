import { test, expect } from '@playwright/test';

// T-11-102 화면 문구 언어: 설정에서 English를 고르면 새로고침 뒤 영어로 그리고, 새로 열어도 유지된다.
// 한국어로 되돌리면 원래 문구다. 고른 적이 없으면 브라우저가 영어여도(자동 감지는 2단계 전까지 꺼짐) 한국어다.
test.use({ locale: 'en-US' });

test('언어: 설정에서 영어를 고르면 유지되고, 한국어로 되돌린다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.locator('[data-act="settings"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('환경설정');

  const lang = page.locator('[data-setting="lang"]');
  await expect(lang).toHaveValue('ko');
  await Promise.all([page.waitForEvent('load'), lang.selectOption('en')]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.locator('[data-act="settings"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page.locator('[data-setting="lang"]')).toHaveValue('en');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('[data-act="settings"]').click();
  await Promise.all([
    page.waitForEvent('load'),
    page.locator('[data-setting="lang"]').selectOption('ko'),
  ]);
  await page.locator('[data-act="settings"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('환경설정');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
});
