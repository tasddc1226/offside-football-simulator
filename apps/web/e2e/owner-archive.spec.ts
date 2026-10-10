import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';
import { archiveFixture, recapFixture } from './fixtures/owner-archive.js';

test('hall unifies seasons: lazy details, cache, retry, selection and mobile navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')));
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'archive-test',
        linked: { google: true },
        nickname: '기록테스트',
        googleEmailMasked: 'a***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );
  let summaries = 0;
  await page.route(`${API}/v1/owner/archive`, (r) => {
    summaries++;
    return r.fulfill(ok(archiveFixture));
  });
  let details = 0;
  await page.route(`${API}/v1/owner/season-recap?season=0`, (r) => {
    details++;
    return r.fulfill(details === 1 ? fail(503, 'UNAVAILABLE', 'unavailable') : ok(recapFixture));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-owner-recap]')).toHaveCount(0);
  await page.locator('[data-act="open-owner-hall"]').click();
  await expect(page.locator('[data-archive-cover]')).toContainText('2,600');
  await expect(page.locator('[data-cup-honor="sf"]')).toBeVisible();
  expect(details).toBe(0);
  await page.locator('[data-archive-season="0"]').click();
  await expect(page.locator('[data-archive-cover]')).toContainText('1,480');
  await expect(page.locator('[data-cup-honor]')).toHaveCount(0);
  expect(details).toBe(0);
  await page.locator('[data-act="archive-details"]').click();
  await expect(page.locator('[data-act="archive-retry"]')).toBeVisible();
  await page.locator('[data-act="archive-retry"]').click();
  await expect(page.locator('[data-recap-rank="ach"]')).toBeVisible();
  await expect(page.locator('[data-act="recap-share"]')).toHaveCount(1);
  await page.locator('[data-archive-season="1"]').click();
  await page.locator('[data-archive-season="0"]').click();
  await page.locator('[data-act="archive-details"]').click();
  await expect(page.locator('[data-recap]')).toBeVisible();
  expect(details).toBe(2);
  await page.locator('[data-hall-tab="titles"]').click();
  await page.locator('[data-hall-tab="records"]').click();
  expect(summaries).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.main-nav')).toBeVisible();
  await page.locator('.main-nav [data-act="owner"]').click();
  await expect(page.locator('[data-act="open-owner-hall"]')).toBeVisible();
  await page.locator('[data-act="open-owner-hall"]').click();
  await expect(page.locator('[data-archive-season="0"]')).toHaveAttribute('aria-pressed', 'true');
  expect(summaries).toBe(1);
});
