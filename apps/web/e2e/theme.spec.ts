import { test, expect } from '@playwright/test';

// T-10-021: 설정의 다크 모드 스위치. 고른 적이 없으면 시스템 설정을 따르고, 고르면 새로 고쳐도 첫 화면부터 유지된다.
test('다크 모드: 시스템이 라이트여도 켜면 어둡게, 새로 고쳐도 유지, 끄면 라이트', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  const toggle = page.locator('[data-setting="dark"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"][data-scheme="dark"]')).toHaveAttribute(
    'media',
    'all',
  );
  await expect(page.locator('meta[name="theme-color"][data-scheme="light"]')).toHaveAttribute(
    'media',
    'not all',
  );

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('[data-act="settings"]').click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('다크 모드: 고른 적이 없으면 시스템 다크를 따른다', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await page.locator('[data-act="settings"]').click();
  await expect(page.locator('[data-setting="dark"]')).toHaveAttribute('aria-checked', 'true');
});
