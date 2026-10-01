import { test, expect } from '@playwright/test';

// T-11-022: PC 웹 업무 모드. 넓은 마우스 화면에서만 설정에 보이고, 켜면 스프레드시트 틀·탭 제목으로 바뀌며
// 새로 고쳐도 첫 화면부터 유지된다. 숫자 1 왼쪽 키(`)로 바로 끈다. 좁은 화면에서는 켜 둬도 원래 화면이다.
test('업무 모드: 설정에서 켜면 시트 화면, 새로 고쳐도 유지, 단축키로 끄고, 좁은 화면에선 풀린다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  const toggle = page.locator('[data-setting="sheet-skin"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'sheet');
  await expect(page).toHaveTitle(/스프레드시트/);
  await expect(page.locator('.sx-chrome')).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'sheet');
  await expect(page.locator('.sx-chrome')).toBeVisible();

  await page.keyboard.press('Backquote');
  await expect(page.locator('html')).not.toHaveAttribute('data-skin', /.+/);
  await expect(page.locator('.sx-chrome')).toHaveCount(0);
  await expect(page).not.toHaveTitle(/스프레드시트/);

  await page.keyboard.press('Backquote');
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'sheet');
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.locator('html')).not.toHaveAttribute('data-skin', /.+/);
  await expect(page.locator('.sx-chrome')).toHaveCount(0);
});

test('업무 모드: 좁은 화면 설정에는 스위치가 없다', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await expect(page.locator('[data-setting="dark"]')).toBeVisible();
  await expect(page.locator('[data-setting="sheet-skin"]')).toHaveCount(0);
});
