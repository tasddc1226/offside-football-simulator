import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';

for (const locale of ['ko-KR', 'en-US', 'ja-JP']) {
  test.describe(locale, () => {
    test.use({ locale });
    test('subscription title is separate, selectable and readable at 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
      await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'fixture')));
      await page.route(`${API}/v1/profile*`, (r) =>
        r.fulfill(
          ok({
            id: 'test',
            linked: { google: true },
            nickname: 'Owner',
            googleEmailMasked: 'a***@example.com',
            recoveryCodeIssuedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          }),
        ),
      );
      await page.route(`${API}/v1/owner-team*`, (r) =>
        r.fulfill(
          ok({
            season: 1,
            current: 1,
            seasons: [{ id: 1, name: 'Season 1' }],
            team: null,
            players: [],
            matchesLeft: 10,
            matchesPerDay: 10,
            cap: 100,
            ownerTitle: 'owner-founder',
          }),
        ),
      );
      let title = 'owner-founder';
      await page.route(`${API}/v1/owner/title*`, async (r) => {
        if (r.request().method() === 'PUT') {
          title = r.request().postDataJSON().title;
          return r.fulfill(ok({ title, pinned: true }));
        }
        return r.fulfill(
          ok({
            title,
            pinned: true,
            teamId: null,
            titles: ['owner-founder'],
            permanent: [
              {
                id: 'owner-founder',
                value: 1,
                target: 1,
                earnedAt: '2026-10-01T00:00:00.000Z',
                isNew: false,
              },
            ],
            membership: {
              active: true,
              status: 'active',
              store: 'local',
              paidUntil: '2026-11-12T00:00:00.000Z',
              graceUntil: null,
              autoRenew: true,
              paidMonths: 3,
              badge: 'silver',
              appearance: { theme: 'classic', frame: 'none', supporterTitle: false },
              salesEnabled: false,
              grants: [],
            },
          }),
        );
      });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', locale.slice(0, 2));
      await expect(page.locator('[data-act="owner"]')).toContainText(
        locale.startsWith('en') ? 'My club' : locale.startsWith('ja') ? 'マイクラブ' : '내 구단',
      );
      await page.locator('[data-act="owner"]').click();
      await page.locator('[data-act="open-owner-hall"]').click();
      const hall = page.locator('[data-owner-hall]');
      const member = hall.locator('[data-title-pick="member-silver"]');
      await expect(member).toBeVisible();
      await expect(hall.locator('[data-title-filter="earned"]')).toContainText('1');
      await member.click();
      await expect(member).toHaveAttribute('aria-pressed', 'true');
      await expect(hall.locator('.oh-title-current [data-title="member-silver"]')).toBeVisible();
      await expect(hall.locator('[data-permanent-title]')).toHaveCount(1);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
      await member.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/member-title-${locale}.png` });
      await hall.locator('[data-title-pick="owner-founder"]').click();
      await expect(member).toHaveAttribute('aria-pressed', 'false');
    });
  });
}
