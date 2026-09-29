import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// T-10-116: 진행 중 커리어를 백업 코드로 내보내고, 저장소를 비운 뒤(다른 기기·브라우저처럼) 다시 불러온다.
test('백업 코드를 복사해 두고 저장소를 비운 뒤 불러오면 커리어가 되살아난다', async ({ page }) => {
  await startCareer(page);
  const name = await page.evaluate(
    () => JSON.parse(localStorage.getItem('ft_save')!).name as string,
  );
  await page.goto('/');
  // 클립보드 권한 없이도 돌도록 복사 호출을 가로챈다.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (t: string) => ((window as unknown as { __code: string }).__code = t),
      },
      configurable: true,
    });
  });
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-act="backup-copy"]').click();
  const code = await page.evaluate(() => (window as unknown as { __code: string }).__code);
  expect(code.length).toBeGreaterThan(100);

  // 잘못된 코드는 거절하고 저장은 그대로다.
  await page.locator('#backup-paste').fill('이건 백업이 아니에요');
  await page.locator('[data-act="backup-import"]').click();
  await expect(page.locator('#toast')).toContainText('올바르지 않아요');
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).not.toBeNull();

  // 다른 기기처럼: 저장소를 비우고 다시 연다.
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('[data-act="continue"]')).toHaveCount(0);
  await page.locator('[data-act="settings"]').click();
  await expect(page.locator('[data-act="backup-copy"]')).toHaveCount(0); // 세이브가 없으면 내보내기 숨김
  await page.locator('#backup-paste').fill(code);
  await page.locator('[data-act="backup-import"]').click();
  await expect(page.locator('#toast')).toContainText('백업을 불러왔어요');
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('.player h1')).toContainText(name);
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ft_'))),
  ).toContain('ft_save');
});
