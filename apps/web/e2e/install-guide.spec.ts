import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-10-021 '홈 화면에 추가' 안내: 모바일 브라우저 홈 화면에서('다시 보지 않기' 전까지), 설정 > 도움말에서 언제든.
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';

test.describe('아이폰 Chrome', () => {
  test.use({ userAgent: IOS_CHROME });

  test('재방문에도 자동 팝업 없이 설치 카드를 하루 한 번 보여주고 설정에서는 직접 안내를 연다', async ({
    page,
  }) => {
    const sheet = page.locator('#sheet');
    await page.goto('/');
    const card = page.locator('[data-app-conversion="home"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-act="app-store"]')).toHaveAttribute(
      'href',
      /apps\.apple\.com/,
    );
    await expect(card.locator('[data-act="android-tester"]')).toHaveCount(0);
    await card.scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('ft_app_conversion_last_seen')))
      .not.toBeNull();
    await startCareer(page);
    await page.reload();
    await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
    await expect(sheet).toBeHidden();
    await expect(card).toHaveCount(0);
    await page.locator('[data-act="settings"]').click();
    await page.locator('[data-act="install-guide"]').click();
    await expect(sheet).toContainText('iPhone 앱으로 이어서 해요');
    await sheet.getByRole('button', { name: '홈 화면에 추가할게요' }).click();
    await expect(sheet).toContainText('홈 화면에 추가하고 앱처럼 열기');
  });

  test('홈이 아닌 화면(구글 로그인 복귀 → 구단주)으로 열리면 띄우지 않는다', async ({ page }) => {
    await page.goto('/settings?google=error&reason=state');
    await expect(page.locator('h1')).toHaveText('내 구단');
    await expect(page.locator('#sheet')).toBeHidden();
  });
});

test('데스크톱 홈 카드에는 iPhone 앱과 Android 비공개 테스트 경로를 둔다', async ({ page }) => {
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
    await page.goto('/?utm_source=meta&utm_medium=paid');
    await expect(page.locator('[data-act="android-tester"]')).toBeVisible();
    await expect(page.locator('[data-act="app-store"]')).toHaveCount(0);
    await page.locator('[data-act="settings"]').click();
    await expect(page.locator('[data-settings="backup"]')).toBeVisible();
    await expect(page.locator('[data-settings="app-move"]')).toHaveCount(0);
  });
});

test('홈 설치 카드를 닫으면 7일간 숨기고 플레이 화면에 반복하지 않는다', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('[data-app-conversion="home"]');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '앱 안내 7일간 닫기' }).click();
  await expect(card).toHaveCount(0);
  expect(
    await page.evaluate(
      () => Number(localStorage.getItem('ft_app_conversion_dismissed_until')) - Date.now(),
    ),
  ).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
  await page.reload();
  await expect(page.locator('[data-act="new"]')).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.locator('[data-act="new"]').click();
  await expect(page.locator('[data-app-conversion]')).toHaveCount(0);
});
