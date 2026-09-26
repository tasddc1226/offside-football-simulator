import { test, expect } from '@playwright/test';

// T-10-023: 열어 둔 탭이 새 배포(version.json의 버전이 다름)를 알아채면 새로고침 배너를 띄운다.
test('배포 버전이 같으면 배너가 없고, 달라지면 탭으로 돌아왔을 때 새로고침 배너가 뜬다', async ({
  page,
}) => {
  let version: string | null = null;
  await page.route('**/version.json', async (route) => {
    if (version === null) return route.continue();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version }) });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /새 커리어 킥오프/ })).toBeVisible();
  await expect(page.locator('.update-banner')).toHaveCount(0);

  version = 'new-build';
  // 최소 간격(60초)을 건너뛰도록 시계를 앞당긴 뒤 탭 복귀를 흉내 낸다.
  await page.evaluate(() => {
    const now = Date.now();
    Date.now = () => now + 120_000;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const banner = page.getByRole('complementary', { name: '업데이트 알림' });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('새 버전이 나왔어요');
  await banner.getByRole('button', { name: '새로고침' }).click();
  await page.waitForLoadState('load');
  await expect(page.getByRole('button', { name: /새 커리어 킥오프/ })).toBeVisible();
});
