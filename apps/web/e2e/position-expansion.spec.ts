import { test, expect } from '@playwright/test';

for (const locale of ['ko-KR', 'en-US', 'ja-JP']) {
  test(`17 positions and saved identity at 320px (${locale})`, async ({ browser }) => {
    const context = await browser.newContext({ locale, viewport: { width: 320, height: 852 } });
    const page = await context.newPage();
    try {
      await page.clock.setFixedTime(new Date('2026-10-11T00:00:00+09:00'));
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', locale.slice(0, 2));
      await expect(page.locator('.main-nav [data-act="settings"]')).toHaveText(
        locale === 'en-US' ? 'Settings' : locale === 'ja-JP' ? '設定' : '설정',
      );
      await page.locator('[data-act="new"]').click();
      const positions = {
        FW: ['ST', 'CF', 'SS', 'LW', 'RW'],
        MF: ['DM', 'CM', 'AM', 'LM', 'RM'],
        DF: ['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW'],
      };
      for (const [group, codes] of Object.entries(positions)) {
        await page.locator(`[data-set="pos"][data-val="${group}"]`).click();
        await expect(page.locator('[data-set="dpos"]')).toHaveCount(codes.length);
        for (const code of codes) {
          const button = page.locator(`[data-set="dpos"][data-val="${code}"]`);
          await button.click();
          await expect(button).toHaveAttribute('aria-pressed', 'true');
          expect(await button.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
          const box = await button.boundingBox();
          expect(box!.width).toBeGreaterThan(100);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      const selected = page.locator('[data-set="dpos"][data-val="SW"]');
      await selected.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/pr639-positions-${locale}.png` });
      await page.locator('[data-act="next-candidates"]').click();
      await page.locator('[data-cand="0"]').click();
      await page.locator('[data-act="start"]').click();
      await expect
        .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ft_save') ?? '{}').dpos))
        .toBe('SW');
      await page.reload();
      await page.locator('[data-act="continue"]').click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).dpos)).toBe(
        'SW',
      );
    } finally {
      await context.close();
    }
  });
}
