import { test, expect } from '@playwright/test';

// T-10-021 '홈 화면에 추가' 안내: 모바일 브라우저 첫 방문에 한 번, 설정 > 도움말에서 언제든.
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';

test.describe('아이폰 Chrome', () => {
  test.use({ userAgent: IOS_CHROME });

  test('첫 방문에 한 번만 뜨고, 설정 도움말에서 다시 연다', async ({ page }) => {
    await page.goto('/');
    const sheet = page.locator('#sheet');
    await expect(sheet).toContainText('홈 화면에 추가하고 앱처럼 열기');
    await expect(sheet.locator('.notice-steps li')).toHaveCount(4);
    await expect(sheet.locator('.notice-steps li').nth(1)).toContainText('더 보기');
    await sheet.locator('[data-sheet="0"]').click();
    await expect(sheet).toBeHidden();

    await page.reload();
    await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
    await expect(page.locator('#sheet')).toBeHidden();

    await page.locator('[data-act="settings"]').click();
    await page.locator('[data-act="install-guide"]').click();
    await expect(sheet).toContainText('홈 화면에 추가하고 앱처럼 열기');
  });
});

test('데스크톱 브라우저에서는 첫 방문 안내를 띄우지 않는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
  await expect(page.locator('#sheet')).toBeHidden();
});
