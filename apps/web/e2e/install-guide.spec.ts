import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-10-021 '홈 화면에 추가' 안내: 모바일 브라우저 홈 화면에서('다시 보지 않기' 전까지), 설정 > 도움말에서 언제든.
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';

test.describe('아이폰 Chrome', () => {
  test.use({ userAgent: IOS_CHROME });

  test("처음 온 방문엔 안 뜨고, 다시 찾아오면 홈에 올 때마다 뜬다. '다시 보지 않기'를 체크하면 그만, 설정 도움말에서는 언제든", async ({
    page,
  }) => {
    const sheet = page.locator('#sheet');
    // T-10-037: 세이브가 없는 첫 방문은 첫 화면을 가리지 않는다.
    await page.goto('/');
    await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
    await expect(sheet).toBeHidden();

    await startCareer(page);
    await page.reload();
    // T-11-092 아이폰은 App Store 앱을 먼저 권하고, 원하면 홈 화면 추가 단계로 넘어간다.
    await expect(sheet).toContainText('iPhone 앱으로 이어서 해요');
    await sheet.getByRole('button', { name: '홈 화면에 추가할게요' }).click();
    await expect(sheet).toContainText('홈 화면에 추가하고 앱처럼 열기');
    await expect(sheet.locator('.notice-steps li')).toHaveCount(4);
    await expect(sheet.locator('.notice-steps li').nth(1)).toContainText('더 보기');
    await sheet.locator('[data-sheet="0"]').click();
    await expect(sheet).toBeHidden();

    // 체크하지 않고 닫으면 다음에 또 뜬다.
    await page.reload();
    await expect(sheet).toContainText('iPhone 앱으로 이어서 해요');
    await sheet.getByLabel('다시 보지 않기').check();
    await sheet.getByRole('button', { name: '닫기' }).click();

    await page.reload();
    await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
    await expect(sheet).toBeHidden();

    // 홈 타일은 App Store만(안드로이드 테스터 모집은 아이폰에 보이지 않는다).
    await expect(page.locator('[data-act="app-store"]')).toHaveAttribute(
      'href',
      /apps\.apple\.com\/kr\/app\/id6817463687/,
    );
    await expect(page.locator('[data-act="android-tester"]')).toHaveCount(0);

    await page.locator('[data-act="settings"]').click();
    await expect(page.locator('[data-settings="app-move"]')).toContainText('iPhone 앱으로 옮기기');
    await page.locator('[data-act="install-guide"]').click();
    await expect(sheet).toContainText('iPhone 앱으로 이어서 해요');
    await expect(sheet.getByLabel('다시 보지 않기')).toHaveCount(0);
    // App Store 받기는 새 창으로 연다(실제 창 대신 주소만 기록한다).
    await page.evaluate(() => {
      (window as unknown as { opened: string[] }).opened = [];
      window.open = (url) => {
        (window as unknown as { opened: string[] }).opened.push(String(url));
        return null;
      };
    });
    await sheet.getByRole('button', { name: 'App Store에서 받기' }).click();
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual([
      'https://apps.apple.com/kr/app/id6817463687',
    ]);
  });

  test('홈이 아닌 화면(구글 로그인 복귀 → 구단주)으로 열리면 띄우지 않는다', async ({ page }) => {
    await page.goto('/settings?google=error&reason=state');
    await expect(page.locator('h1')).toHaveText('구단주');
    await expect(page.locator('#sheet')).toBeHidden();
  });
});

test('데스크톱 브라우저에서는 첫 방문 안내를 띄우지 않고, 홈에 iPhone 앱 · 안드로이드 테스터 타일을 둘 다 둔다', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('[data-act="app-store"]')).toBeVisible();
  await expect(page.locator('[data-act="android-tester"]')).toBeVisible();
});

test.describe('안드로이드 Chrome', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  });

  test('안드로이드는 비공개 테스트라 App Store 타일 · 앱 옮기기 카드 없이 테스터 모집만 둔다', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-act="android-tester"]')).toBeVisible();
    await expect(page.locator('[data-act="app-store"]')).toHaveCount(0);
    await page.locator('[data-act="settings"]').click();
    await expect(page.locator('[data-settings="backup"]')).toBeVisible();
    await expect(page.locator('[data-settings="app-move"]')).toHaveCount(0);
  });
});
