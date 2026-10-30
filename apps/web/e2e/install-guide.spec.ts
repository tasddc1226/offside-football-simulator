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
    await expect(card.locator('[data-act="play-store"]')).toHaveCount(0);
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

  test('T-11-506 홈 맨 위 한 줄 띠는 App Store로 보내고 닫으면 카드와 함께 7일 숨긴다', async ({
    page,
  }) => {
    await page.goto('/');
    const strip = page.locator('[data-app-strip="ios"]');
    await expect(strip).toBeVisible();
    await expect(strip.locator('[data-act="app-strip-store"]')).toHaveAttribute(
      'href',
      /apps\.apple\.com/,
    );
    await strip.locator('[data-act="app-strip-close"]').click();
    await expect(strip).toHaveCount(0);
    await expect(page.locator('[data-app-conversion="home"]')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-act="new"]')).toBeVisible();
    await expect(strip).toHaveCount(0);
  });

  test('홈이 아닌 화면(구글 로그인 복귀 → 구단주)으로 열리면 띄우지 않는다', async ({ page }) => {
    await page.goto('/settings?google=error&reason=state');
    await expect(page.locator('h1')).toHaveText('내 구단');
    await expect(page.locator('#sheet')).toBeHidden();
  });
});

test('데스크톱 홈 카드 · 설정에는 App Store와 Google Play를 함께 둔다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('[data-act="app-store"]')).toBeVisible();
  // T-11-449 Android 정식 출시로 테스터 모집 대신 Google Play로 보낸다.
  await expect(page.locator('[data-act="play-store"]')).toHaveAttribute(
    'href',
    /play\.google\.com\/store\/apps\/details\?id=com\.offsidelab\.app/,
  );
  await expect(page.locator('[data-act="home-android-tester"]')).toHaveCount(0);
  // T-11-506 맨 위 한 줄 띠는 휴대폰 웹에서만.
  await expect(page.locator('[data-app-strip]')).toHaveCount(0);
  await page.locator('[data-act="settings"]').click();
  await expect(page.locator('[data-act="app-store-settings-ios"]')).toBeVisible();
  await expect(page.locator('[data-act="app-store-settings-android"]')).toBeVisible();
});

test.describe('안드로이드 Chrome', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  });

  test('안드로이드는 App Store 없이 Google Play로 보내고 설정에 앱 옮기기 카드를 둔다', async ({
    page,
  }) => {
    await page.goto('/?utm_source=meta&utm_medium=paid');
    await expect(page.locator('[data-act="play-store"]')).toBeVisible();
    // T-11-506 광고로 들어온 방문은 먼저 플레이하게 두고 맨 위 띠를 띄우지 않는다.
    await expect(page.locator('[data-app-strip]')).toHaveCount(0);
    await expect(page.locator('[data-act="app-store"]')).toHaveCount(0);
    await page.locator('[data-act="settings"]').click();
    await expect(page.locator('[data-settings="backup"]')).toBeVisible();
    await expect(page.locator('[data-settings="app-move"]')).toContainText('Android 앱으로 옮기기');
    await expect(page.locator('[data-act="app-store-settings-android"]')).toHaveText(
      'Google Play에서 받기',
    );
    await expect(page.locator('[data-act="app-store-settings-ios"]')).toHaveCount(0);
  });
});

test.describe('안드로이드 인스타그램 인앱 브라우저', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 355.0.0.36.104 Android',
  });

  test('T-11-466 Google Play 버튼은 Play 스토어 앱 intent로 지금 창에서 열고 유입 캠페인을 넘긴다', async ({
    page,
  }) => {
    await page.goto('/?utm_source=meta&utm_medium=paid&utm_campaign=global_test');
    const play = page.locator('[data-app-conversion="home"] [data-act="play-store"]');
    await expect(play).toHaveAttribute(
      'href',
      /^intent:\/\/details\?id=com\.offsidelab\.app&referrer=[^#]*utm_source%3Dmeta[^#]*#Intent;scheme=market;package=com\.android\.vending;S\.browser_fallback_url=https%3A%2F%2Fplay\.google\.com%2F/,
    );
    await expect(play).not.toHaveAttribute('target', '_blank');
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
