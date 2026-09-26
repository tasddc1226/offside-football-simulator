import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-10-021 '홈 화면에 추가' 안내: 모바일 브라우저 홈 화면에서('다시 보지 않기' 전까지), 설정 > 도움말에서 언제든.
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';

test.describe('아이폰 Chrome', () => {
  test.use({ userAgent: IOS_CHROME });

  test("처음 온 방문엔 안 뜨고, 다시 찾아오면 홈에 올 때마다 뜬다. '다시 보지 않기'를 체크하면 그만, 설정 도움말에서는 언제든", async ({ page }) => {
    const sheet = page.locator('#sheet');
    // T-10-037: 세이브가 없는 첫 방문은 첫 화면을 가리지 않는다.
    await page.goto('/');
    await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
    await expect(sheet).toBeHidden();

    await startCareer(page);
    await page.reload();
    await expect(sheet).toContainText('홈 화면에 추가하고 앱처럼 열기');
    await expect(sheet.locator('.notice-steps li')).toHaveCount(4);
    await expect(sheet.locator('.notice-steps li').nth(1)).toContainText('더 보기');
    await sheet.locator('[data-sheet="0"]').click();
    await expect(sheet).toBeHidden();

    // 체크하지 않고 닫으면 다음에 또 뜬다.
    await page.reload();
    await expect(sheet).toContainText('홈 화면에 추가하고 앱처럼 열기');
    await sheet.getByLabel('다시 보지 않기').check();
    await sheet.locator('[data-sheet="0"]').click();

    await page.reload();
    await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
    await expect(sheet).toBeHidden();

    await page.locator('[data-act="settings"]').click();
    await page.locator('[data-act="install-guide"]').click();
    await expect(sheet).toContainText('홈 화면에 추가하고 앱처럼 열기');
    await expect(sheet.getByLabel('다시 보지 않기')).toHaveCount(0);
  });

  test('홈이 아닌 화면(구글 로그인 복귀 → 설정)으로 열리면 띄우지 않는다', async ({ page }) => {
    await page.goto('/settings?google=error&reason=state');
    await expect(page.locator('h1')).toHaveText('환경설정');
    await expect(page.locator('#sheet')).toBeHidden();
  });
});

test('데스크톱 브라우저에서는 첫 방문 안내를 띄우지 않는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
  await expect(page.locator('#sheet')).toBeHidden();
});
