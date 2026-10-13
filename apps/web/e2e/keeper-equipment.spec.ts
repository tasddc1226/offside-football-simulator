import { test, expect } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

for (const width of [320, 390, 1280]) {
  test(`keeper equipment previews, persists and can be removed (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await resumeWithSave(page, {
      pending: null,
      phase: 1,
      age: 26,
      injury: 0,
      serving: false,
      rng: { seed: 5 },
      look: {
        owned: ['style', 'hair', 'gloves', 'keeperKit', 'kneePads'],
        pick: { style: 11, hair: 0 },
      },
    });
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
    await page.locator('[data-act="avatar-look"]').click();
    const dialog = page.getByRole('dialog', { name: '선수 꾸미기' });
    const plain = await dialog.locator('svg.avatar').innerHTML();
    for (const [item, name, value] of [
      ['gloves', '키퍼 장갑', 1],
      ['keeperKit', '키퍼 유니폼', 2],
      ['kneePads', '무릎 보호대', 1],
    ] as const) {
      const row = dialog.locator(`[data-look-item="${item}"]`);
      await expect(row.getByRole('group', { name })).toBeVisible();
      await row.locator(`[data-look-opt="${value}"]`).click();
      await expect(row.locator(`[data-look-opt="${value}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    expect(await dialog.locator('svg.avatar').innerHTML()).not.toBe(plain);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (process.env.CAPTURE_KEEPER_DIR) {
      await page.screenshot({ path: `${process.env.CAPTURE_KEEPER_DIR}/controls-${width}.png` });
      await dialog.evaluate((el) => (el.scrollTop = 0));
      await page.screenshot({ path: `${process.env.CAPTURE_KEEPER_DIR}/look-${width}.png` });
    }
    await page.keyboard.press('Escape');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
    expect(after.look.pick).toMatchObject({ gloves: 1, keeperKit: 2, kneePads: 1 });
    expect({ ...after, look: null }).toEqual({ ...before, look: null });
    await page.reload();
    await page.locator('[data-act="continue"]').click();
    await page.locator('[data-act="avatar-look"]').click();
    expect(await dialog.locator('svg.avatar').innerHTML()).not.toBe(plain);
    for (const item of ['gloves', 'keeperKit', 'kneePads'])
      await dialog.locator(`[data-look-item="${item}"] [data-look-opt="0"]`).click();
    expect(await dialog.locator('svg.avatar').innerHTML()).toBe(plain);
  });
}

test('keeper gloves purchase requires funds and occurs once', async ({ page }) => {
  await resumeWithSave(page, { pending: null, phase: 1, age: 26, money: 1000000, look: undefined });
  await page.locator('[data-act="avatar-look"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 꾸미기' });
  const row = dialog.locator('[data-look-item="gloves"]');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  await row.locator('[data-look-opt="1"]').click();
  // A preview has not charged the player or written a choice.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).money)).toBe(
    before.money,
  );
  await row.locator('[data-act="look-buy"]').click();
  const bought = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
  expect(bought.money).toBeLessThan(before.money);
  await row.locator('[data-look-opt="4"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).money)).toBe(
    bought.money,
  );
  await expect(row.locator('[data-act="look-buy"]')).toHaveCount(0);
});
