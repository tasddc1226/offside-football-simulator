import { test, expect } from '@playwright/test';
import { API, ok, resumeWithSave } from './helpers.js';

const styles = ['완전 민머리', '삭발', '드레드', '스파이크 모히칸', '포니테일', '투톤 꽁지머리'];

for (const width of [320, 390, 1280]) {
  test(`six hairstyles persist (${width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 844 });
    await resumeWithSave(page, {
      pending: null,
      phase: 1,
      age: 26,
      injury: 0,
      serving: false,
      rng: { seed: 5 },
      look: { owned: ['style', 'hair'], pick: { style: 0, hair: 2 } },
    });
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
    const renders: string[] = [];
    for (let i = 0; i < styles.length; i++) {
      await page.locator('[data-act="avatar-look"]').click();
      const dialog = page.getByRole('dialog', { name: '선수 꾸미기' });
      const option = dialog.locator(`[data-look-item="style"] [data-look-opt="${i + 9}"]`);
      await expect(option).toHaveText(styles[i]!);
      await option.click();
      await expect(option).toHaveAttribute('aria-pressed', 'true');
      renders.push(await dialog.locator('svg.avatar').innerHTML());
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (process.env.CAPTURE_HAIR_DIR)
        await page.screenshot({
          path: `${process.env.CAPTURE_HAIR_DIR}/look-${width}-${i + 9}.png`,
        });
      await page.keyboard.press('Escape');
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!));
      expect(after.look.pick.style).toBe(i + 9);
      expect({ ...after, look: null }).toEqual({ ...before, look: null });
      await page.reload();
      await page.locator('[data-act="continue"]').click();
    }
    expect(new Set(renders).size).toBe(styles.length);
  });

  test(`all six player card portraits render in the market (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route(`${API}/v1/profile`, (r) =>
      r.fulfill(
        ok({
          id: 'qa',
          linked: { google: true, toss: false },
          nickname: 'QA',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ),
    );
    await page.route(`${API}/v1/market/me**`, (r) =>
      r.fulfill(
        ok({
          season: 1,
          balance: 100000,
          clubValue: 100000,
          listings: [],
          trades: [],
          spends: [],
          buysLeft: 10,
          rules: {
            releaseRate: 1,
            feeRate: 0.05,
            priceMin: 0.5,
            priceMax: 3,
            listLimit: 20,
            dailyBuys: 10,
          },
        }),
      ),
    );
    await page.route(
      (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
      (r) =>
        r.fulfill(
          ok({
            season: 1,
            hasMore: false,
            recent: [],
            items: styles.map((name, i) => ({
              id: `lst_qa_${i}`,
              price: 100000,
              createdAt: '2026-10-13T00:00:00Z',
              card: {
                careerId: `hair-qa-${i}`,
                pos: 'FW',
                dpos: 'ST',
                peak: 88,
                look: `s1h2d0y${i + 9}`,
                number: 9,
                publicName: name,
                legendScore: 500,
                cardValue: 100000,
                transfers: 0,
                season: 1,
                nation: 'KR',
                attrs: null,
              },
            })),
          }),
        ),
    );
    await page.goto('/');
    await page.getByRole('button', { name: /Transfer market/i }).click();
    const portraits = page.locator('[data-listing] svg.avatar');
    await expect(portraits).toHaveCount(6);
    const renders = await portraits.evaluateAll((els) => els.map((e) => e.innerHTML));
    expect(new Set(renders).size).toBe(6);
    for (const p of await portraits.all()) await expect(p).toHaveAttribute('viewBox', '0 0 24 21');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (process.env.CAPTURE_HAIR_DIR)
      await page.screenshot({
        path: `${process.env.CAPTURE_HAIR_DIR}/cards-${width}.png`,
        fullPage: true,
      });
  });
}

for (const width of [390, 1280])
  for (let i = 0; i < styles.length; i++) {
    test(`new hairstyle ${i + 9} runs and shoots (${width}px)`, async ({ page }) => {
      await page.clock.install();
      await page.setViewportSize({ width, height: 844 });
      await resumeWithSave(page, {
        pending: null,
        phase: 1,
        injury: 0,
        serving: false,
        rng: { seed: 5 },
        look: { owned: ['style', 'hair'], pick: { style: i + 9, hair: 2 } },
      });
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
      await page.locator('[data-act="advance"]').click();
      const stage = page.locator('[data-progress-runner] .avatar-stage');
      await expect(stage).toBeVisible();
      await page.clock.runFor(400);
      await expect(stage).toHaveAttribute('data-motion', 'run');
      if (process.env.CAPTURE_HAIR_DIR)
        await page.screenshot({
          path: `${process.env.CAPTURE_HAIR_DIR}/run-${width}-${i + 9}.png`,
        });
      for (let f = 0; f < 24; f++) {
        if ((await stage.getAttribute('data-motion')) === 'shoot') break;
        await page.clock.runFor(80);
      }
      await expect(stage).toHaveAttribute('data-motion', 'shoot');
      if (process.env.CAPTURE_HAIR_DIR)
        await page.screenshot({
          path: `${process.env.CAPTURE_HAIR_DIR}/shoot-${width}-${i + 9}.png`,
        });
      await page.locator('#an-skip').click();
      await expect(page.locator('[data-progress-runner]')).toBeHidden();
    });
  }
