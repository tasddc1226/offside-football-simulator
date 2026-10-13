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
  test(`runner travels above the readable popup and stays within rotated screens (${size.width})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await resumeWithSave(page, { pending: null, phase: 0, injury: 0, serving: false });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('[data-act="advance"]').click();
    const runner = page.locator('[data-progress-runner]');
    await expect(runner).toBeVisible();
    await expect(page.locator('[data-progress-cover]')).toHaveCount(0);
    await expect(page.locator('#modal')).not.toHaveAttribute('inert', '');
    await expect(runner).toHaveAttribute('aria-hidden', 'true');
    expect(await runner.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    expect(await runner.innerText()).toBe('');
    await expect(page.locator('#sheet')).toContainText('프리시즌 진행 중');
    await page.clock.runFor(400);
    await expect(runner.locator('.avatar-stage')).toHaveAttribute('data-motion', 'run');

    const expectOnEdge = async (viewport: { width: number; height: number }) => {
      const track = (await runner.boundingBox())!;
      const sheet = (await page.locator('#sheet').boundingBox())!;
      expect(track.y).toBeGreaterThanOrEqual(0);
      expect(track.y + track.height).toBeCloseTo(sheet.y + 3, 0);
      expect(track.x).toBeGreaterThanOrEqual(sheet.x);
      expect(track.x + track.width).toBeLessThanOrEqual(sheet.x + sheet.width);
      expect(track.x + track.width).toBeLessThanOrEqual(viewport.width);
      expect(sheet.y + sheet.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    };
    await expectOnEdge(size);
    const at = async (fraction: number) => {
      await runner.evaluate((el, f) => {
        for (const animation of el.getAnimations({ subtree: true })) {
          animation.pause();
          animation.currentTime = Number(animation.effect!.getTiming().duration) * f;
        }
      }, fraction);
      return (await runner.locator('.runner-player').boundingBox())!;
    };
    const start = await at(0);
    const middle = await at(0.25);
    expect(middle.x - start.x).toBeGreaterThan(80);
    const end = await at(0.5);
    expect(end.x + end.width).toBeCloseTo(
      (await runner.boundingBox())!.x + (await runner.boundingBox())!.width,
      0,
    );
    expect(
      await runner.locator('.runner-facing').evaluate((el) => getComputedStyle(el).transform),
    ).toContain('-1');
    await at(0);
    const rotated = { width: size.height, height: size.width };
    await page.setViewportSize(rotated);
    await page.clock.runFor(100);
    await expectOnEdge(rotated);
    await page.setViewportSize(size);
    await page.clock.runFor(100);
    await expectOnEdge(size);
    if (process.env.CAPTURE_PROGRESS_DIR)
      await page.screenshot({
        path: `${process.env.CAPTURE_PROGRESS_DIR}/popup-runner-${size.width}.png`,
      });
    await page.clock.runFor(10000);
    await expect(runner).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase)).toBe(1);
  });
}

test('season skip is directly clickable while the runner is visible; results remain unchanged', async ({
  page,
}) => {
  await page.route(`${API}/v1/careers/**`, (r) => r.fulfill(ok({})));
  await resumeWithSave(page, { pending: null, phase: 1, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  const runner = page.locator('[data-progress-runner]');
  await expect(runner).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.clock.runFor(600);
  await expect(page.locator('#an-skip')).toBeInViewport();
  await page.locator('#an-skip').click();
  await expect(runner).toBeHidden();
  await expect(page.locator('#sheet [data-sheet="0"]')).toBeInViewport();
  await expect(page.locator('[data-block-wdl]')).not.toBeEmpty();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
  await page.clock.resume();
  await page.locator('#modal').evaluate(async (el) => {
    await Promise.all(
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  const issues = await new AxeBuilder({ page }).include('#sheet').analyze();
  expect(issues.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(page.locator('#sheet')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
});

test('reduced motion stops both travel and running poses without delaying progress', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, { pending: null, phase: 0 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  const runner = page.locator('[data-progress-runner]');
  await expect(runner).toBeVisible();
  await expect(runner.locator('.avatar-stage')).toHaveAttribute('data-motion', 'idle');
  expect(await runner.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.clock.runFor(10000);
  await expect(runner).toBeHidden();
});

test('pose loading failure keeps a still player and does not block progress', async ({ page }) => {
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
  const runner = page.locator('[data-progress-runner]');
  await expect(runner).toBeVisible();
  await expect.poll(() => failed).toBeGreaterThan(0);
  await expect(runner.locator('.avatar-stage')).toHaveAttribute('data-motion', 'idle');
  await expect(runner.locator('svg rect').first()).toBeVisible();
  expect(await runner.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.clock.runFor(10000);
  await expect(runner).toBeHidden();
});

test('natural season completion removes the runner and keeps confirmation available', async ({
  page,
}) => {
  await resumeWithSave(page, { pending: null, phase: 1, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('[data-progress-runner]')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.clock.runFor(20000);
  await expect(page.locator('#sheet [data-sheet="0"]')).toBeInViewport();
  await expect(page.locator('[data-progress-runner]')).toBeHidden();
  await page.locator('#sheet [data-sheet="0"]').click();
  await expect(page.locator('#sheet')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
});

test('decoration does not steal keyboard focus or dismiss the busy progress modal', async ({
  page,
}) => {
  await resumeWithSave(page, { pending: null, phase: 1, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  const runner = page.locator('[data-progress-runner]');
  await expect(runner).toBeVisible();
  await expect(runner.locator('button, [tabindex]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(runner).toBeVisible();
  await page.locator('#an-skip').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sheet [data-sheet="0"]')).toBeInViewport();
});
