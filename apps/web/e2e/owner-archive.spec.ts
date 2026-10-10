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
  await expect(page.locator('[data-room-zone="1"]')).toHaveAttribute('aria-pressed', 'true');
  expect(details).toBe(0);
  const stage = await page.locator('.locker-stage').boundingBox();
  if (!stage) throw new Error('Missing locker room');
  await page.mouse.move(stage.x + stage.width * 0.75, stage.y + stage.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.25, stage.y + stage.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-room-zone="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-room-open]')).toHaveCount(0);
  await expect(page.locator('dialog.locker-detail')).toHaveCount(0);
  await expect(page.locator('[data-room-list]')).toHaveAttribute('data-room-list', 'trophies');
  await expect(page.getByRole('button', { name: '오른쪽 공간으로' })).toBeDisabled();
  await expect(page.locator('[data-trophy-gallery]')).toBeVisible();
  await expect(page.locator('[data-room-zone="2"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-room-zone="0"]').click();
  await expect(page.locator('[data-archive-cover]')).toContainText('2,600');
  await expect(page.locator('[data-cup-honor="sf"]')).toBeVisible();
  expect(details).toBe(0);
  await page.locator('[data-archive-season="0"]').click();
  await expect(page.locator('[data-archive-cover]')).toContainText('1,480');
  await expect(page.locator('[data-room-list] [data-cup-honor]')).toHaveCount(0);
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
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-room-zone="1"]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-room-zone="0"]').click();
  expect(summaries).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.main-nav')).toBeVisible();
  await page.locator('.main-nav [data-act="owner"]').click();
  await expect(page.locator('[data-act="open-owner-hall"]')).toBeVisible();
  await page.locator('[data-act="open-owner-hall"]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-room-zone="0"]').click();
  await expect(page.locator('[data-archive-season="0"]')).toHaveAttribute('aria-pressed', 'true');
  expect(summaries).toBe(1);
});

for (const lang of ['en', 'ja'] as const) {
  test(`season rankings keep localized labels and percentage badges readable: ${lang}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((locale) => {
      localStorage.setItem('ft_session', '1');
      localStorage.setItem('ft_lang', JSON.stringify(locale));
    }, lang);
    await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')));
    await page.route(`${API}/v1/profile*`, (r) =>
      r.fulfill(
        ok({
          id: 'archive-test',
          linked: { google: true },
          nickname: 'Archive test',
          googleEmailMasked: 'a***@example.com',
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      ),
    );
    await page.route(`${API}/v1/owner/archive*`, (r) => r.fulfill(ok(archiveFixture)));
    await page.route(`${API}/v1/owner/season-recap?season=0*`, (r) => r.fulfill(ok(recapFixture)));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await page.locator('[data-act="owner"]').click();
    await page.locator('[data-act="open-owner-hall"]').click();
    await page.locator('[data-room-zone="0"]').click();
    await page.locator('[data-archive-season="0"]').click();
    await page.locator('[data-act="archive-details"]').click();
    const ranks = page.locator('.rank-list');
    await expect(ranks).toBeVisible();
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 780 });
      await ranks.scrollIntoViewIfNeeded();
      expect(
        await ranks.evaluate((list) =>
          [...list.querySelectorAll('.rank-row')].every((row) => {
            const label = row.querySelector('span')!;
            const badge = row.querySelector('em');
            const line = parseFloat(getComputedStyle(label).lineHeight);
            return (
              label.scrollWidth <= label.clientWidth &&
              label.getBoundingClientRect().height <= line + 1 &&
              (!badge || badge.getBoundingClientRect().height < 32) &&
              row.scrollWidth <= row.clientWidth
            );
          }),
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 320, height: 780 });
    await ranks.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/locale-audit/${lang}-rank-layout-320.png` });
  });
}
