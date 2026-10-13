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
  test(`separate character cover preserves the original modal through motion and rotation (${size.width})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await resumeWithSave(page, { pending: null, phase: 0, injury: 0, serving: false });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('[data-act="advance"]').click();
    const scene = page.locator('[data-progress-cover]');
    await expect(scene).toBeVisible();
    const screen = scene;
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter),
    ).toBe('auto');
    expect(await screen.boundingBox()).toMatchObject({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    });
    await expect(page.locator('#app')).toHaveAttribute('inert', '');
    await expect(page.locator('.sheet-handle')).toHaveCount(1);
    await expect(page.locator('#modal')).toHaveAttribute('inert', '');
    expect(
      await page.evaluate(() =>
        document.getElementById('modal')!.contains(document.querySelector('[data-progress-cover]')),
      ),
    ).toBe(false);
    expect(await scene.innerText()).toBe('');
    await expect(scene.locator('h2, .prog, .ticker, .steps')).toHaveCount(0);
    await expect(page.locator('#sheet .avatar-stage')).toHaveCount(0);
    expect((await page.locator('#sheet').boundingBox())!.height).toBeLessThan(size.height);
    expect((await page.locator('#sheet').boundingBox())!.width).toBeLessThanOrEqual(460);
    await page.clock.runFor(350);
    await expect(scene.locator('.avatar-stage')).toHaveAttribute('data-motion', 'run');
    await page.clock.runFor(550);
    await expect(scene.locator('.avatar-stage')).toHaveAttribute('data-motion', 'shoot');
    const expectCentered = async (viewport: { width: number; height: number }) => {
      const player = (await scene.locator('.avatar-walker').boundingBox())!;
      expect(player.x + player.width / 2).toBeCloseTo(viewport.width / 2, 0);
      expect(player.y + player.height / 2).toBeCloseTo(viewport.height / 2, 0);
    };
    await expectCentered(size);
    await expect(scene.locator('.field-lines')).toHaveCount(0);
    expect(
      await scene.locator('.avatar-stage').evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe('rgba(0, 0, 0, 0)');
    // Rotation keeps the character in the viewport center, without a travel transition.
    const rotated = { width: size.height, height: size.width };
    await page.setViewportSize(rotated);
    await page.clock.runFor(100);
    await expectCentered(rotated);
    await page.setViewportSize(size);
    await page.clock.runFor(100);
    await expectCentered(size);
    if (process.env.CAPTURE_PROGRESS_DIR)
      await page.screenshot({
        path: `${process.env.CAPTURE_PROGRESS_DIR}/progress-cover-${size.width}.png`,
        animations: 'disabled',
      });

    await page.clock.runFor(10000);
    await expect(screen).toBeHidden();
    await expect(page.locator('#app')).not.toHaveAttribute('inert', '');
    await expect(page.locator('#modal')).not.toHaveAttribute('inert', '');
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
  const scene = page.locator('[data-progress-cover]');
  await expect(scene).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.clock.runFor(600);
  if (process.env.CAPTURE_PROGRESS_DIR)
    await page.screenshot({
      path: `${process.env.CAPTURE_PROGRESS_DIR}/progress-cover-season.png`,
      animations: 'disabled',
    });
  // Revealing the original modal must not finish the simulation or alter saved results.
  await scene.getByRole('button', { name: '진행 내용 보기' }).click();
  await expect(scene).toBeHidden();
  await expect(page.locator('#modal')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#an-skip')).toBeInViewport();
  await expect(page.locator('#sheet [data-sheet="0"]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
  if (process.env.CAPTURE_PROGRESS_DIR)
    await page.screenshot({
      path: `${process.env.CAPTURE_PROGRESS_DIR}/progress-modal-season.png`,
      animations: 'disabled',
    });
  await page.locator('#an-skip').click();
  await expect(page.locator('#sheet [data-sheet="0"]')).toBeInViewport();
  await expect(page.locator('#sheet .avatar-stage')).toHaveCount(0);
  await expect(page.locator('[data-block-wdl]')).not.toBeEmpty();
  if (process.env.CAPTURE_PROGRESS_DIR)
    await page.screenshot({
      path: `${process.env.CAPTURE_PROGRESS_DIR}/progress-modal-result.png`,
      animations: 'disabled',
    });
  await page.clock.resume();
  // Audit the readable modal after its reveal/bump animations settle, not an in-between frame.
  await page.locator('#modal').evaluate(async (el) => {
    await Promise.all(
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  const issues = await new AxeBuilder({ page }).include('#sheet').analyze();
  expect(
    issues.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.locator('#sheet [data-sheet="0"]').click();
  await page.clock.runFor(500);
  await expect(page.locator('#sheet')).toBeHidden();
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
  await expect(page.locator('[data-progress-cover]')).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.locator('.avatar-stage')).toHaveAttribute('data-motion', 'idle');
  await page.clock.runFor(10000);
  await expect(page.locator('[data-progress-cover]')).toBeHidden();
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
  await expect(page.locator('[data-progress-cover]')).toBeVisible();
  await expect.poll(() => failed).toBeGreaterThan(0);
  await expect(page.locator('.avatar-walker svg rect').first()).toBeVisible();
  await page.clock.runFor(10000);
  await expect(page.locator('[data-progress-cover]')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase)).toBe(1);
});

test('season finishes naturally and waits for confirmation without changing saved results', async ({
  page,
}) => {
  await resumeWithSave(page, { pending: null, phase: 1, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('[data-progress-cover]')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.clock.runFor(20000);
  await expect(page.locator('#sheet [data-sheet="0"]')).toBeInViewport();
  await expect(page.locator('[data-progress-cover]')).toBeHidden();
  await expect(page.locator('#sheet .avatar-stage')).toHaveCount(0);
  await expect(page.locator('#modal')).not.toHaveAttribute('inert', '');
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(page.locator('#sheet')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
});

test('Escape only removes the cover; the original progress modal and keyboard control stay available', async ({
  page,
}) => {
  await resumeWithSave(page, { pending: null, phase: 0, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  const cover = page.locator('[data-progress-cover]');
  await expect(cover).toBeVisible();
  await expect(cover.getByRole('button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cover.getByRole('button')).toBeFocused();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.keyboard.press('Escape');
  await expect(cover).toBeHidden();
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('#sheet')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
  await page.clock.runFor(10000);
  await expect(page.locator('#sheet')).toBeHidden();
});
