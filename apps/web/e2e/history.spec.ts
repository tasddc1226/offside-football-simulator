import { test, expect } from '@playwright/test';

// T-10-114 모바일 뒤로 가기(iOS 가장자리 밀기·Android 뒤로)가 앱 안의 이전 화면으로 간다. 시작한 커리어의 생성
// 화면으로는 돌아가지 않는다(같은 후보로 다시 시작하는 일을 막는다).
test('뒤로 가기: 생성 2단계 → 1단계 → 홈, 게임에서는 홈으로 나가고 생성 화면으로는 돌아가지 않는다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  const next = page.locator('[data-act="next-candidates"]');
  await next.click();
  await page.locator('[data-scout-scan]').click();
  await expect(page.locator('[data-cand="0"]')).toBeVisible();

  await page.goBack();
  await expect(next).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-cand="0"]')).toBeVisible();

  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();

  await page.goBack();
  await expect(page.locator('[data-act="continue"]')).toBeVisible();
  await expect(page.locator('[data-cand="0"]')).toHaveCount(0);
  // T-11-213 돌아갈 수 없는 생성 기록은 홈 기록까지 접혀서, 앞으로 가기로 다시 열리지 않는다.
  await page.goForward();
  await expect(page.locator('[data-act="continue"]')).toBeVisible();
});

// T-11-213 하단 탭끼리는 기록을 쌓지 않고, 탭 안에서 들어간 화면만 쌓인다.
test('뒤로 가기: 하단 탭끼리는 넘어가지 않고, 탭 안에서 들어간 화면만 되돌린다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const nav = page.locator('nav.main-nav');
  await nav.locator('[data-act="settings"]').click();
  await expect(nav.locator('[data-act="settings"]')).toHaveAttribute('aria-current', 'page');
  await nav.locator('[data-act="hof"]').click();
  await expect(nav.locator('[data-act="hof"]')).toHaveAttribute('aria-current', 'page');
  // 탭 안의 화면(홈 → 확률 도감)은 쌓인다.
  await nav.locator('[data-act="home"]').click();
  await page.locator('[data-act="dex"]').click();
  await expect(page.locator('[data-dex]').first()).toBeVisible();
  await page.goBack();
  await expect(nav.locator('[data-act="home"]')).toHaveAttribute('aria-current', 'page');
  // 홈은 하단 탭이라 그 아래 기록(기록실 · 설정)으로 넘어가지 않는다.
  const before = page.url();
  expect(await page.evaluate(() => history.state?.i)).toBe(0);
  expect(page.url()).toBe(before);
});
