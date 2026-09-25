import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startCareer } from './helpers.js';

// T-10-016 진행 중인 커리어가 있으면 홈 첫 카드가 '이번 커리어는 ○○ 입니다'로 바뀌고 이어하기가 맨 앞에 온다.
test('홈: 진행 중인 커리어가 있으면 첫 카드에서 바로 이어 한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-current]')).toHaveCount(0);
  await expect(page.locator('.hero-home [data-act="new"]')).toHaveText(/새 커리어 킥오프/);

  await startCareer(page);
  const name = (await page.locator('.player h1').innerText()).trim();
  await page.locator('[data-act="home"]').click();

  const hero = page.locator('[data-home-current]');
  await expect(hero.locator('strong')).toHaveText(name);
  await expect(hero.locator('[data-act="continue"]')).toContainText(/(으)?로 계속/);
  await expect(page.locator('[data-act="continue"]')).toHaveCount(1); // 아래쪽 이어하기 타일은 없다.
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  await hero.locator('[data-act="continue"]').click();
  await expect(page.locator('.player h1')).toHaveText(name);
});
