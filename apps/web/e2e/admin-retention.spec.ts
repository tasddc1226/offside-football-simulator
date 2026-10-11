import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';

const at = '2026-10-11T06:00:00.000Z';
const metrics = {
  queued: 20,
  pending: 2,
  accepted: 15,
  confirmed: 12,
  failed: 1,
  unknown: 1,
  cancelled: 1,
  recipients: 20,
  acceptedRecipients: 15,
  clicked: 7,
  targetOpened: 6,
};
const report = {
  generatedAt: at,
  trackingStartedAt: at,
  from: at,
  cohortThrough: at,
  totals: metrics,
  categories: [],
  daily: [],
  campaigns: [],
  hasMore: false,
  cups: [
    {
      ...metrics,
      cupId: 's1-1',
      season: 1,
      edition: 1,
      title: 'Cup',
      createdAt: at,
      participants: 12,
      predictors: 18,
      overlap: 10,
      predictionOnly: 8,
      predictionEntries: 70,
      duplicatesRemoved: 62,
      notQueued: 0,
    },
  ],
  retention: [{ ...metrics, stage: 1, returned: 10, retired: 3 }],
};
for (const width of [320, 390])
  test(`retention report ${width}px loads on open and reuses cache`, async ({ page }) => {
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
      if (path === '/v1/admin/push-performance') {
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
    await page.locator('[data-admin-tab="push"]').click();
    const section = page.locator('[data-admin="push"]');
    await expect(section).toContainText('첫 커리어 독려');
    await expect(section).toContainText('7일 내 첫 은퇴');
    await expect(section.locator('.retention')).toContainText('10');
    const cups = section.locator('[data-cup-push]');
    await expect(cups).toContainText('컵 종료 알림');
    const cup = cups.locator('[data-cup-id="s1-1"]');
    await cup.locator('summary').click();
    await expect(cup).toContainText('중복으로 합친 건수');
    await expect(cup).toContainText('62');
    expect(calls).toBe(1);
    await page.screenshot({ path: `/tmp/cup-metrics-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('[data-admin-tab="dashboard"]').click();
    await page.locator('[data-admin-tab="push"]').click();
    await expect(section).toContainText('첫 커리어 독려');
    expect(calls).toBe(1);
    await section.getByRole('button', { name: '새로고침' }).click();
    await expect.poll(() => calls).toBe(2);
  });
