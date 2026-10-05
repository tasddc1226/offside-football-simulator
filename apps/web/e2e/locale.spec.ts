import { test, expect } from '@playwright/test';

// T-11-102·106 화면 문구 언어: 고른 적이 없으면 브라우저 언어를 따른다(영어 브라우저면 영어). 설정에서 고르면
// 새로고침 뒤 그 언어로 그리고, 새로 열어도 유지된다.
test.use({ locale: 'en-US' });

test('언어: 영어 브라우저는 영어로 시작하고, 설정에서 한국어를 고르면 유지된다', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.main-nav [data-act="settings"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');

  const lang = page.locator('[data-setting="lang"]');
  await expect(lang).toHaveValue('en');
  await Promise.all([page.waitForEvent('load'), lang.selectOption('ko')]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');

  await page.reload();
  await page.locator('.main-nav [data-act="settings"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('환경설정');
  await expect(page.locator('[data-setting="lang"]')).toHaveValue('ko');

  await Promise.all([
    page.waitForEvent('load'),
    page.locator('[data-setting="lang"]').selectOption('en'),
  ]);
  await page.locator('.main-nav [data-act="settings"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
});

test('언어: 영어로 커리어를 시작하면 게임 기록도 영어다', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="new"]').click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
  const log = await page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('ft_save')!) as { log: { text: string }[] }).log[0]!.text,
  );
  expect(log).toMatch(/starts a football career/);
  expect(log).not.toMatch(/[가-힣]/);
});
