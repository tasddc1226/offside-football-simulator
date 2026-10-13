import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok, resumeWithSave } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

for (const size of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`preseason covers viewport, moves and shoots, then restores gameplay (${size.width})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await resumeWithSave(page, { pending: null, phase: 0, injury: 0, serving: false });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('[data-act="advance"]').click();
    const scene = page.locator('[data-progress-scene]');
    await expect(scene).toBeVisible();
    const screen = page.locator('#sheet.progress-screen');
    expect(await screen.boundingBox()).toMatchObject({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    });
    await expect(page.locator('#app')).toHaveAttribute('inert', '');
    await expect(page.locator('.sheet-handle')).toHaveCount(0);
    await page.clock.runFor(350);
    await expect(scene.locator('.avatar-stage')).toHaveAttribute('data-motion', 'run');
    await page.clock.runFor(550);
    await expect(scene.locator('.avatar-stage')).toHaveAttribute('data-motion', 'shoot');
    // Rotation adapts immediately; the player must not fly in from old viewport coordinates.
    await page.setViewportSize({ width: size.height, height: size.width });
    await page.clock.runFor(100);
    const field = (await scene.locator('.avatar-stage').boundingBox())!;
    const player = (await scene.locator('.avatar-walker').boundingBox())!;
    expect(player.x).toBeGreaterThanOrEqual(field.x);
    expect(player.x + player.width).toBeLessThanOrEqual(field.x + field.width + 1);
    await page.setViewportSize(size);
    await page.clock.runFor(100);
    if (process.env.CAPTURE_PROGRESS_DIR)
      await page.screenshot({
        path: `${process.env.CAPTURE_PROGRESS_DIR}/progress-verified-${size.width}.png`,
        animations: 'disabled',
      });

    await page.clock.runFor(10000);
    await expect(screen).toBeHidden();
    await expect(page.locator('#app')).not.toHaveAttribute('inert', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase)).toBe(1);
  });
}

test('season records/skip/confirmation remain functional; motion stops on completion', async ({
  page,
}) => {
  await page.route(`${API}/v1/careers/**`, (r) => r.fulfill(ok({})));
  await resumeWithSave(page, { pending: null, phase: 1, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  const scene = page.locator('[data-progress-scene]');
  await expect(scene).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.clock.runFor(600);
  await expect(page.locator('#an-skip')).toBeInViewport();
  await page.locator('#an-skip').click();
  await expect(page.locator('#sheet [data-sheet="0"]')).toBeInViewport();
  await expect(scene.locator('.avatar-stage')).toHaveAttribute('data-motion', 'idle');
  await expect(scene.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('[data-block-wdl]')).not.toBeEmpty();
  await page.clock.resume();
  const issues = await new AxeBuilder({ page }).include('#sheet').analyze();
  expect(issues.violations.map((v) => v.id)).toEqual([]);
  await page.locator('#sheet [data-sheet="0"]').click();
  await page.clock.runFor(500);
  await expect(scene).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
});

test('reduced motion keeps a safe static player; progress still completes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(
    /(?:avatar-mini-motion\/[^/?]+|assets\/(?:short|fringe|long|mohawk|slick|buzz|afro|bun|spiky)-[^/]+\.js)(?:\?|$)/,
    (r) => r.abort(),
  );
  await resumeWithSave(page, { pending: null, phase: 0 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('[data-progress-scene]')).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.locator('.avatar-stage')).toHaveAttribute('data-motion', 'idle');
  await page.clock.runFor(10000);
  await expect(page.locator('.progress-screen')).toBeHidden();
});

test('pose loading failure does not block progress or erase the player', async ({ page }) => {
  let failed = 0;
  await page.route(
    /(?:avatar-mini-motion\/[^/?]+|assets\/(?:short|fringe|long|mohawk|slick|buzz|afro|bun|spiky)-[^/]+\.js)(?:\?|$)/,
    (r) => {
      failed++;
      return r.abort();
    },
  );
  await resumeWithSave(page, { pending: null, phase: 0, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('[data-progress-scene]')).toBeVisible();
  await expect.poll(() => failed).toBeGreaterThan(0);
  await expect(page.locator('.avatar-walker svg rect').first()).toBeVisible();
  await page.clock.runFor(10000);
  await expect(page.locator('.progress-screen')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase)).toBe(1);
});

test('season finishes naturally and waits for confirmation without changing saved results', async ({
  page,
}) => {
  await resumeWithSave(page, { pending: null, phase: 1, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('[data-progress-scene]')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.clock.runFor(20000);
  await expect(page.locator('#sheet [data-sheet="0"]')).toBeInViewport();
  await expect(page.locator('.avatar-stage')).toHaveAttribute('data-motion', 'idle');
  await expect(page.locator('[data-progress-scene] [role="progressbar"]')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(page.locator('[data-progress-scene]')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
});
