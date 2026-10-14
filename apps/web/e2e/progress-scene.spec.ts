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
  test(`runner approaches the goal and scores above the readable popup on rotated screens (${size.width})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await resumeWithSave(page, {
      pending: null,
      phase: 1,
      injury: 0,
      serving: false,
      rng: { seed: 5 },
    });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('[data-act="advance"]').click();
    const runner = page.locator('[data-progress-runner]');
    await expect(runner).toBeVisible();
    await expect(page.locator('[data-progress-cover]')).toHaveCount(0);
    await expect(page.locator('#modal')).not.toHaveAttribute('inert', '');
    await expect(runner).toHaveAttribute('aria-hidden', 'true');
    expect(await runner.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await expect(runner.getByRole('button')).toHaveCount(0);
    await expect(page.locator('#sheet')).toContainText('전반기 진행 중');
    await expect(runner.locator('.avatar-stage')).toHaveAttribute('data-ready', 'true');
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
    await expect(runner.locator('[data-runner-goal]')).toBeVisible();
    const start = (await runner.locator('.runner-player').boundingBox())!;
    await page.clock.runFor(250);
    const moved = (await runner.locator('.runner-player').boundingBox())!;
    expect(moved.x - start.x).toBeGreaterThan(15);
    if (process.env.CAPTURE_PROGRESS_DIR)
      await page.screenshot({
        path: `${process.env.CAPTURE_PROGRESS_DIR}/goal-run-${size.width}.png`,
      });
    for (let i = 0; i < 24; i++) {
      const avatar = runner.locator('.avatar-stage');
      if (
        (await avatar.getAttribute('data-motion')) === 'shoot' &&
        ['2', '3', '4'].includes((await avatar.getAttribute('data-frame'))!)
      )
        break;
      await page.clock.runFor(80);
    }
    await expect(runner.locator('.avatar-stage')).toHaveAttribute('data-frame', /[234]/);
    if (process.env.CAPTURE_PROGRESS_DIR)
      await page.screenshot({
        path: `${process.env.CAPTURE_PROGRESS_DIR}/goal-kick-${size.width}.png`,
      });
    // Advance the real shared clock until the ball enters the net, without changing styles or frames.
    for (let i = 0; i < 12 && (await runner.getAttribute('data-phase')) !== 'goal'; i++)
      await page.clock.runFor(180);
    await expect(runner).toHaveAttribute('data-phase', 'goal');
    await expect(runner.locator('.avatar-stage')).toHaveAttribute('data-motion', 'shoot');
    const goal = (await runner.locator('[data-runner-goal]').boundingBox())!;
    const ball = (await runner.locator('[data-runner-ball]').boundingBox())!;
    expect(ball.x).toBeGreaterThan(goal.x);
    expect(ball.x + ball.width).toBeLessThan(goal.x + goal.width);
    expect(ball.y).toBeGreaterThan(goal.y);
    expect(ball.y + ball.height).toBeLessThan(goal.y + goal.height);
    if (process.env.CAPTURE_PROGRESS_DIR)
      await page.screenshot({
        path: `${process.env.CAPTURE_PROGRESS_DIR}/goal-score-${size.width}.png`,
      });
    const shooter = (await runner.locator('.runner-player').boundingBox())!;
    expect(shooter.x + shooter.width).toBeLessThan(goal.x);
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
    await page.locator('#an-skip').click();
    await expect(runner).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase)).toBe(2);
  });
}

test('season skip is directly clickable while the runner is visible; results remain unchanged', async ({
  page,
}) => {
  await page.route(`${API}/v1/careers/**`, (r) => r.fulfill(ok({})));
  await resumeWithSave(page, {
    pending: null,
    phase: 1,
    injury: 0,
    serving: false,
    rng: { seed: 5 },
  });
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
    /(?:avatar-images\/(?:short|fringe|long|mohawk|slick|buzz|afro|bun|spiky)-A\.png|assets\/(?:short|fringe|long|mohawk|slick|buzz|afro|bun|spiky)-A-[^/]+\.png)(?:\?|$)/,
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
  await expect(runner.locator('.avatar-walker > svg')).toBeVisible();
  await expect(runner.locator('.image-avatar > g')).toBeVisible();
  expect(await runner.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.clock.runFor(10000);
  await expect(runner).toBeHidden();
});

test('natural season completion removes the runner and keeps confirmation available', async ({
  page,
}) => {
  await resumeWithSave(page, {
    pending: null,
    phase: 1,
    injury: 0,
    serving: false,
    rng: { seed: 5 },
  });
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
  await resumeWithSave(page, {
    pending: null,
    phase: 1,
    injury: 0,
    serving: false,
    rng: { seed: 5 },
  });
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

test('goal scene restarts from the left without changing saved season results', async ({
  page,
}) => {
  await resumeWithSave(page, {
    pending: null,
    phase: 1,
    injury: 0,
    serving: false,
    rng: { seed: 5 },
  });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  const runner = page.locator('[data-progress-runner]');
  await expect(runner).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.clock.runFor(400);
  for (let i = 0; i < 32 && (await runner.getAttribute('data-phase')) !== 'reset'; i++)
    await page.clock.runFor(100);
  await expect(runner).toHaveAttribute('data-phase', 'reset');
  const lastX = (await runner.locator('.runner-player').boundingBox())!.x;
  await page.clock.runFor(260);
  await expect(runner).toHaveAttribute('data-phase', 'run');
  expect((await runner.locator('.runner-player').boundingBox())!.x).toBeLessThan(lastX - 80);
  await expect(page.locator('#sheet')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(saved);
});

test('short preseason keeps its original timing and removes all decoration on completion', async ({
  page,
}) => {
  await resumeWithSave(page, { pending: null, phase: 0, injury: 0, serving: false });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.locator('[data-act="advance"]').click();
  await expect(page.locator('[data-progress-runner]')).toBeVisible();
  await expect(page.locator('#sheet')).toContainText('프리시즌 진행 중');
  await page.clock.runFor(10000);
  await expect(page.locator('[data-progress-runner]')).toBeHidden();
  await expect(page.locator('[data-runner-goal], [data-runner-ball]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase)).toBe(1);
});
