import { test, expect } from '@playwright/test';
import { openMarket } from './helpers.js';

for (const width of [320, 390]) {
  test(`transfer offers survive dismissal, navigation and reload at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openMarket(page, 24);
    const sheet = page.locator('#sheet');
    const offers = await sheet.locator('[data-opt]').allTextContents();
    const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
    const close = page.locator('[data-market-close]');
    const box = await close.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-act="resume"]')).toContainText('이적할 팀 선택하기');
    await page.locator('[data-tab="player"]').click();
    await expect(page.locator('[data-act="resume"]')).toBeVisible();
    await page.locator('[data-act="resume"]').click();
    expect(await sheet.locator('[data-opt]').allTextContents()).toEqual(offers);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(page.locator('[data-act="resume"]')).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
    await page.reload();
    await page.locator('[data-act="continue"]').click();
    await expect(sheet).toBeVisible();
    expect(await sheet.locator('[data-opt]').allTextContents()).toEqual(offers);
    expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
    await page.locator('#modal').click({ position: { x: 4, y: 4 } });
    await expect(sheet).toBeHidden();
    await page.locator('[data-act="resume"]').click();
    await expect(sheet).toBeVisible();
    await page.locator('[data-opt="0"]').click();
    // Both direct choices and contract choices remain available after reopening.
    await expect(page.locator('[data-market-close]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
