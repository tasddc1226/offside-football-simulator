import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';

// T-11-427 운영 도구 컵 탭의 리그 상태 · 일정 미루기.
const at = '2026-10-25T04:00:00.000Z';
const day = 86_400_000;
const shift = (iso: string, n: number) => new Date(Date.parse(iso) + n * day).toISOString();
const rounds = Array.from({ length: 14 }, (_, i) => shift('2026-11-05T04:00:00.000Z', i));
const view = (n: number) => ({
  league: {
    season: 2,
    startsAt: '2026-10-30T15:00:00.000Z',
    opensAt: '2026-10-23T15:00:00.000Z',
    closesAt: shift('2026-11-04T15:00:00.000Z', n),
    drawAt: shift('2026-11-05T00:00:00.000Z', n),
    rounds: rounds.map((r) => shift(r, n)),
    minFilled: 8,
  },
  phase: 'open',
  delayed: n > 0,
  counts: { entries: 12, placed: 0, dropped: 0, forfeited: 0 },
  drawnAt: null,
  doneAt: null,
  playedRounds: 0,
  overdue: 0,
});

for (const width of [320, 390])
  test(`league status ${width}px shows the schedule and delays it before the draw`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    let gets = 0;
    let delayed: unknown = null;
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
      if (path === '/v1/admin/leagues/current') {
        gets++;
        return route.fulfill(ok(view(0)));
      }
      if (path === '/v1/admin/leagues/current/delay') {
        delayed = route.request().postDataJSON();
        return route.fulfill(ok(view(2)));
      }
      if (path === '/v1/admin/cups') return route.fulfill(ok({ items: [] }));
      return route.fulfill(fail(404, 'NOT_FOUND', 'No fixture'));
    });
    await page.goto('/');
    await page.locator('[data-act="owner"]').click();
    await expect(page.getByText('ad***@gmail.com')).toBeVisible();
    await page.locator('[data-act="admin"]').click();
    expect(gets).toBe(0);
    await page.locator('[data-admin-tab="cup"]').click();
    const section = page.locator('[data-admin="league"]');
    await expect(section.locator('[data-league-phase="open"]')).toBeVisible();
    await expect(section.locator('[data-league-count="entries"]')).toHaveText('12');
    await expect(section).toContainText('11. 5.');
    expect(gets).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await section.locator('input[type="number"]').fill('2');
    page.once('dialog', (d) => void d.accept());
    await section.locator('[data-act="league-delay"]').click();
    await expect(section.locator('[data-league-delayed]')).toBeVisible();
    expect(delayed).toEqual({ days: 2 });
    await expect(section).toContainText('11. 7.');
  });
