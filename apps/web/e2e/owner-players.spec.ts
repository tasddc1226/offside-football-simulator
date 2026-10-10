import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok } from './helpers.js';

test('내 선수: 320px 별도 화면, 시즌 기록과 방출 관리 및 캐시', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.clock.setFixedTime(new Date('2026-10-10T00:00:00Z'));
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const entry = (n: number, season: number) => ({
    id: id(n),
    name: `기록선수${n}`,
    pos: 'FW',
    number: 9,
    peak: 80,
    legendScore: 500 - n,
    apps: 100,
    goals: 50,
    assists: 10,
    trophies: 1,
    awards: 0,
    caps: 0,
    ballon: 0,
    lastClub: '서울 FC',
    retiredAt: '2026-10-09T00:00:00Z',
    hasDetail: false,
    season,
  });
  const card = (n: number, extra = {}) => ({
    careerId: id(n),
    publicName: `보유선수${n}`,
    pos: 'FW',
    dpos: 'ST',
    number: 9,
    peak: 80,
    legendScore: 500,
    cardValue: 10000,
    raised: true,
    locked: false,
    listing: null,
    roles: null,
    attrs: null,
    season: 1,
    ...extra,
  });
  let cards = [
    card(1),
    card(2),
    card(3, { locked: true }),
    card(4, { raised: false }),
    card(5, { listing: { id: 'sale', price: 10000 } }),
    card(6),
  ];
  let posts = 0,
    mineGets = 0,
    teamGets = 0;
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: true, toss: false },
        nickname: '선수관리',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    ),
  );
  await page.route(`${API}/v1/boards/viewer`, (r) =>
    r.fulfill(ok({ admin: false, google: true, nickname: '선수관리' })),
  );
  await page.route(`${API}/v1/market/funds`, (r) =>
    r.fulfill(ok({ balance: 10000, clubValue: 70000 })),
  );
  await page.route(`${API}/v1/careers/mine**`, (r) => {
    mineGets++;
    return r.fulfill(
      ok({
        linked: true,
        entries: [entry(1, 1), entry(2, 1), entry(3, 1), entry(4, 1), entry(7, 0)],
      }),
    );
  });
  await page.route(`${API}/v1/market/me`, (r) =>
    r.fulfill(ok({ season: 1, balance: 10000, rules: { releaseRate: 1 } })),
  );
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) => {
      teamGets++;
      const season = Number(new URL(r.request().url()).searchParams.get('season') ?? 1);
      return r.fulfill(
        ok({
          season,
          current: 1,
          seasons: [
            { id: 0, name: '프리시즌' },
            { id: 1, name: '시즌 1' },
          ],
          team: {
            name: '관리FC',
            manager: '감독',
            formation: '4-3-3',
            slots: [{ careerId: id(6), slot: 0 }],
            ovr: 80,
            rating: 1000,
            record: { wins: 0, draws: 0, losses: 0 },
          },
          players: season === 1 ? cards : [card(7, { season: 0 })],
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      );
    },
  );
  await page.route(`${API}/v1/cards/release`, (r) => {
    posts++;
    expect(r.request().postDataJSON()).toEqual({ careerIds: [id(1), id(2)] });
    // Concurrent ownership change: only one of two selected cards is actually released.
    cards = cards.filter((c) => c.careerId !== id(1));
    return r.fulfill(ok({ released: 1, amount: 10000, balance: 20000 }));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-my-player]')).toHaveCount(0);
  await page.locator('[data-act="open-owner-players"]').click();
  await expect(page.locator('[data-act="players-manage"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-act="players-records"]').click();
  await expect(page.locator('[data-my-player]')).toHaveCount(4);
  await page.selectOption('[data-my-season-select]', '0');
  await expect(page.locator('[data-my-player]')).toHaveCount(1);
  await page.locator('[data-my-player="0"]').click();
  await expect(page.locator('.film-open h1')).toContainText('기록선수7');
  await page.locator('[data-act="hof-back"]').click();
  await expect(page.locator('[data-my-season-select]')).toHaveValue('0');
  await page.selectOption('[data-my-season-select]', '1');
  await page.locator('[data-act="players-manage"]').click();
  await expect(page.locator('[data-managed-player]')).toHaveCount(6);
  for (const n of [3, 4, 5, 6])
    await expect(page.locator(`[data-managed-player="${id(n)}"] input`)).toBeDisabled();
  await page.locator('[data-act="players-pick-all"]').click();
  await expect(page.locator('input:checked')).toHaveCount(2);
  await page.selectOption('[data-my-season-select]', '0');
  await expect(page.locator('input:checked')).toHaveCount(0);
  await page.selectOption('[data-my-season-select]', '1');
  await page.locator('[data-act="players-pick-all"]').click();
  await page.locator('[data-act="players-release"]').click();
  expect(posts).toBe(0);
  await page
    .locator('[data-player-release-summary]')
    .getByRole('button', { name: '닫기', exact: true })
    .click();
  await expect(page.locator('[data-act="players-release-confirm"]')).toHaveCount(0);
  expect(posts).toBe(0);
  await page.locator('[data-act="players-release"]').click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const confirmBox = await page.locator('[data-act="players-release-confirm"]').boundingBox();
  const backBox = await page.locator('[data-act="players-back"]').boundingBox();
  expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(backBox!.y);
  await page.screenshot({ path: '/tmp/title563-player-confirm-320.png' });
  await expect(page.locator('[data-player-release-summary]')).toContainText(
    '다시 데려올 수 없어요',
  );
  await page.screenshot({ path: '/tmp/title563-player-release-320.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.locator('[data-act="players-release-confirm"]').click();
  await expect(page.locator('[data-managed-player]')).toHaveCount(5);
  await expect(page.locator('[data-player-management] [role="status"]')).toContainText('1명');
  await page.locator('[data-act="players-records"]').click();
  await expect(page.locator('[data-my-player]')).toHaveCount(4);
  await page.locator('[data-act="players-back"]').click();
  await expect(page.locator('[data-act="open-owner-players"]')).toBeVisible();
  const counts = { mineGets, teamGets };
  await page.locator('[data-act="open-owner-players"]').click();
  await expect(page.locator('[data-act="players-manage"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-act="players-records"]').click();
  await expect(page.locator('[data-my-player]')).toHaveCount(4);
  await page.locator('[data-act="players-manage"]').click();
  await expect(page.locator('[data-managed-player]')).toHaveCount(5);
  // A successful release invalidates the career cache once; later read-only entries reuse it.
  expect({ mineGets, teamGets }).toEqual({
    mineGets: counts.mineGets + 1,
    teamGets: counts.teamGets,
  });
  const refreshed = { mineGets, teamGets };
  await page.locator('[data-act="players-back"]').click();
  await page.locator('[data-act="open-owner-players"]').click();
  await expect(page.locator('[data-managed-player]')).toHaveCount(5);
  expect({ mineGets, teamGets }).toEqual(refreshed);
});
