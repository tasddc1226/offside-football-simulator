import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';

const at = '2026-10-10T04:00:00.000Z';
const report = {
  current: { v: 20738, asOf: '2026-10-10', source: 'fixture', values: { 'pl-0': 84 } },
  runs: [
    {
      day: '2026-10-10',
      at,
      version: 20738,
      leagues: [
        {
          league: 'pl',
          status: 'changed',
          reason: 'validated-standings',
          season: '2026-08-01',
          changes: [{ id: 'pl-0', before: 87, after: 84 }],
        },
        {
          league: 'k1',
          status: 'unconfigured',
          reason: 'source-or-key-missing',
          season: null,
          changes: [],
        },
      ],
    },
  ],
  nextBefore: null,
};
for (const width of [320, 390])
  test(`strength history ${width}px loads on open and reuses cache`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    let calls = 0;
    await page.route(`${API}/v1/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/v1/profile')
        return route.fulfill(
          ok({
            id: 'u1',
            linked: { google: true },
            googleEmailMasked: 'ad***@gmail.com',
            nickname: null,
            recoveryCodeIssuedAt: null,
            createdAt: at,
          }),
        );
      if (path === '/v1/owner/summary')
        return route.fulfill(ok({ linked: true, admin: true, tier: null, entries: [] }));
      if (path === '/v1/boards/viewer')
        return route.fulfill(ok({ admin: true, google: true, nickname: null }));
      if (path === '/v1/admin/club-strength') {
        calls++;
        return route.fulfill(ok(report));
      }
      if (path === '/v1/admin/stats')
        return route.fulfill(
          ok({
            generatedAt: at,
            profiles: { total: 0, linked: 0, new24h: 0, new7d: 0, active24h: 0, active7d: 0 },
            careers: { total: 0, active: 0, retired: 0, new7d: 0, retired7d: 0 },
            board: { posts: 0, comments: 0, comments7d: 0 },
            daily: [],
            balance: null,
            audit: [],
          }),
        );
      if (path === '/v1/club-strength')
        return route.fulfill(ok({ v: 1, asOf: '2026-10-07', source: 'fixture', values: {} }));
      return route.fulfill(fail(404, 'NOT_FOUND', 'No fixture'));
    });
    await page.goto('/');
    await page.locator('[data-act="owner"]').click();
    await expect(page.getByText('ad***@gmail.com')).toBeVisible();
    await page.locator('[data-act="admin"]').click();
    expect(calls).toBe(0);
    await page.locator('[data-admin-tab="club-strength"]').click();
    const section = page.locator('[data-admin="club-strength"]');
    await expect(section).toContainText('v20738');
    await section.locator('summary').first().click();
    await expect(section).toContainText('87 → 84 (-3)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('[data-admin-tab="dashboard"]').click();
    await page.locator('[data-admin-tab="club-strength"]').click();
    await expect(section).toContainText('v20738');
    expect(calls).toBe(1);
    await section.getByRole('button', { name: '새로고침' }).click();
    await expect.poll(() => calls).toBe(2);
  });
