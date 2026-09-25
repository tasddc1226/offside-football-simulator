import { test, expect } from '@playwright/test';

// 클릭 효과음: 버튼을 누르면 Web Audio 오실레이터 하나로 '톡' 소리를 낸다. 설정에서 끄면 나지 않는다.
test('클릭 효과음: 버튼에서만 나고, 설정에서 끌 수 있다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __osc: number };
    w.__osc = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      w.__osc++;
      return create.call(this);
    };
  });
  const clicks = () => page.evaluate(() => (window as unknown as { __osc: number }).__osc);
  await page.goto('/');
  await page.locator('[data-hof-tab="mine"]').click();
  expect(await clicks()).toBe(1);
  await page.locator('.hero-home h1').click();
  expect(await clicks()).toBe(1);

  await page.locator('[data-act="settings"]').click();
  const toggle = page.locator('[data-setting="sfx"]');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  const after = await clicks();
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-hof-tab="mine"]').click();
  expect(await clicks()).toBe(after);
  expect(await page.evaluate(() => localStorage.getItem('ft_sfx'))).toBe('false');
});
