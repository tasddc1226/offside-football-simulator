import { test, expect } from '@playwright/test';
import { clearPendingEvent, startCareer } from './helpers.js';

// T-10-034: 순위표가 구단 이름을 {#each} 키로 써서, 유저가 두 구단 이름을 같게 바꾸면 each_key_duplicate로 시즌 탭이 깨졌다.
test('구단 이름이 겹쳐도 순위표가 그려진다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      'ft_clubs',
      JSON.stringify({
        clubs: { 'hs-0': { name: '같은 이름 FC' }, 'hs-1': { name: '같은 이름 FC' } },
        updatedAt: null,
        dirty: false,
      }),
    ),
  );
  await startCareer(page);
  const sheet = page.locator('#sheet');
  await page.locator('[data-act="advance"]').click(); // 프리시즌
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  await clearPendingEvent(page);
  await page.locator('[data-act="advance"]').click(); // 전반기 경기
  await page.locator('#an-skip').click();
  await sheet.locator('[data-sheet="0"]').click();
  await expect(sheet).toBeHidden();
  const table = page.locator('[data-league-table]');
  const toggle = table.locator('[data-act="table-toggle"]');
  if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'false')
    await toggle.click();
  await expect(table.locator('tbody tr', { hasText: '같은 이름 FC' })).toHaveCount(2);
  expect(errors).toEqual([]);
});
