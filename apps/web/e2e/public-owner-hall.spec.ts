import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';

for (const locale of ['ko-KR', 'en-US', 'ja-JP']) {
  test.describe(locale, () => {
    test.use({ locale });
    test('guest visits a read-only hall with one profile read and no private requests', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 780 });
      const id = 'tem_00000000-0000-4000-8000-000000000002';
      const name = 'Public Owner';
      const owner = {
        nickname: name,
        avatarId: null,
        title: 'owner-developer',
        tier: null,
        team: { id, name: 'Public FC', manager: 'Manager', season: 1, seasonName: 'Season 1' },
        cupHonors: [],
        seasons: [
          {
            season: 0,
            name: 'Preseason',
            achScore: 1500,
            teamName: 'Public FC',
            teamRank: 2,
            closed: true,
          },
        ],
        stats: { retired: 10, retiredNumbers: 0, bestTeamRank: 2 },
      };
      const requests: string[] = [];
      let profileReads = 0;
      page.on('request', (req) => {
        if (req.url().startsWith(API)) requests.push(new URL(req.url()).pathname);
      });
      await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'fixture')));
      const record = { w: 9, d: 0, l: 1 };
      await page.route(`${API}/v1/teams?*`, (r) =>
        r.fulfill(
          ok({
            season: 1,
            seasons: [{ id: 1, name: 'Season 1' }],
            sort: 'rating',
            page: 1,
            total: 1,
            items: [
              {
                rank: 1,
                teamId: id,
                name: 'Public FC',
                manager: 'Manager',
                formation: '4-3-3',
                ovr: 60,
                rating: 1100,
                record,
                likes: 0,
                createdAt: '2026-10-10T00:00:00.000Z',
              },
            ],
          }),
        ),
      );
      await page.route(`${API}/v1/teams/${id}{,?*}`, (r) =>
        r.fulfill(
          ok({
            mine: false,
            liked: false,
            team: {
              id,
              season: 1,
              seasonName: 'Season 1',
              name: 'Public FC',
              manager: 'Manager',
              owner: name,
              formation: '4-3-3',
              layout: null,
              logo: null,
              ovr: 60,
              rating: 1100,
              record,
              rank: 1,
              lines: { atk: 60, mid: 60, def: 60, gk: 60 },
              goals: { for: 20, against: 10 },
              likes: 0,
              views: 0,
              badges: [],
              synergies: [],
              slots: ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST', 'W'].map(
                (slot) => ({ slot, careerId: null, name: 'Youth', pos: null, rating: 50, fit: 1 }),
              ),
              createdAt: '2026-10-10T00:00:00.000Z',
              updatedAt: '2026-10-10T00:00:00.000Z',
            },
          }),
        ),
      );
      await page.route(`${API}/v1/owners/by-team/${id}{,?*}`, (r) => {
        profileReads++;
        return r.fulfill(
          ok({
            owner,
            mine: false,
            hall: { owner, honors: [], pendingSeasons: [], titles: ['owner-developer'] },
          }),
        );
      });
      await page.goto('/');
      await page.locator('[data-act="hof"]').click();
      await page.locator('[data-hof-tab="teams"]').click();
      await page.locator(`[data-rank-team="${id}"]`).click();
      await page.locator('[data-act="owner-profile"]').click();
      const hall = page.locator('[data-owner-honors-screen]');
      await expect(hall).toBeVisible();
      await expect(hall.locator('.owner-nameplate')).toHaveText(name);
      await expect(hall.locator('[data-title="owner-developer"]')).not.toHaveCount(0);
      await expect(page.locator('[data-title-pick]')).toHaveCount(0);
      await expect(page.locator('[data-act="owner-hall"]')).toHaveCount(0);
      await hall.locator('[data-room-zone="0"]').click();
      await expect(hall.locator('[data-public-season="0"]')).toContainText('1,500');
      await hall.locator('[data-room-zone="2"]').click();
      await expect(hall.locator('[data-trophy-gallery]')).toBeVisible();
      await hall.locator('[data-room-zone="1"]').click();
      expect(profileReads).toBe(1);
      expect(requests.filter((p) => ['/v1/owner/archive', '/v1/owner/title'].includes(p))).toEqual(
        [],
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  });
}
