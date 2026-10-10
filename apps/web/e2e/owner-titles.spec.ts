import { test, expect } from '@playwright/test';
import { PERMANENT_TITLES } from '@offside/contracts/owner-title';
import { API, ok, fail } from './helpers.js';

test('permanent titles: progress, selection, header update, recovery and memoized re-entry at mobile width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  let gets = 0;
  let title: string | null = null;
  let pinned = false;
  const permanent = PERMANENT_TITLES.map((t) => ({
    id: t.id,
    target: t.target,
    value: t.id === 'owner-academy' ? 10 : t.target,
    earnedAt: t.id === 'owner-academy' ? null : '2026-10-10T00:00:00.000Z',
    isNew: t.id !== 'owner-academy',
  }));
  await page.route(`${API}/v1/**`, (route) =>
    route.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')),
  );
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(
      ok({
        id: 'test',
        linked: { google: true },
        nickname: '구단주',
        googleEmailMasked: 'a***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
  );
  await page.route(`${API}/v1/owner-team`, (route) =>
    route.fulfill(
      ok({
        season: 1,
        current: 1,
        seasons: [{ id: 1, name: '시즌 1' }],
        team: null,
        players: [],
        matchesLeft: 10,
        matchesPerDay: 10,
        cap: 100,
        ownerTitle: title,
      }),
    ),
  );
  await page.route(`${API}/v1/owner/title`, async (route) => {
    if (route.request().method() === 'PUT') {
      const picked = route.request().postDataJSON().title as string | null;
      title = picked === 'none' ? null : picked;
      pinned = picked !== null;
      await route.fulfill(ok({ title, pinned }));
    } else {
      gets++;
      await route.fulfill(
        ok({
          title,
          pinned,
          titles: permanent.filter((t) => t.earnedAt).map((t) => t.id),
          permanent,
          teamId: null,
        }),
      );
    }
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-permanent-title]')).toHaveCount(0);
  await page.locator('[data-act="open-owner-hall"]').click();
  const hall = page.locator('[data-owner-hall]');
  await expect(hall.locator('[data-permanent-title]')).toHaveCount(13);
  await expect(hall.locator('[data-title-grade]')).toHaveCount(4);
  await expect(
    hall.locator('[data-title-grade="legend"] [data-permanent-title="owner-keeper"]'),
  ).toHaveCount(1);
  await expect(
    hall.locator('[data-title-grade="honor"] [data-permanent-title="owner-ballon-maker"]'),
  ).toHaveCount(1);
  await expect(
    hall.locator('[data-title-grade="skilled"] [data-permanent-title="owner-national"]'),
  ).toHaveCount(1);
  await expect(hall.locator('[data-permanent-title="owner-goals"]')).toContainText(
    '통산 500골 선수',
  );
  await expect(hall.locator('[data-permanent-title="owner-academy"]')).toContainText('10/50');
  await expect(hall.locator('[data-title-pick="owner-academy"]')).toHaveCount(0);
  await hall.locator('[data-title-pick="owner-developer"]').click();
  await expect(hall.locator('[data-title-pick="owner-developer"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('[data-act="honors-back"]').click();
  await expect(
    page.locator('[aria-label="구단주 요약"] [data-title="owner-developer"]'),
  ).toBeVisible();
  await page.locator('[data-act="open-owner-hall"]').click();
  await hall.locator('[data-title-pick="none"]').click();
  await page.locator('[data-act="honors-back"]').click();
  await expect(page.locator('[aria-label="구단주 요약"] [data-title]')).toHaveCount(0);
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-permanent-title]')).toHaveCount(0);
  await page.locator('[data-act="open-owner-hall"]').click();
  await expect(hall).toBeVisible();
  const afterMutation = gets;
  await page.locator('[data-act="honors-back"]').click();
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-permanent-title]')).toHaveCount(0);
  await page.locator('[data-act="open-owner-hall"]').click();
  await expect(hall).toBeVisible();
  expect(gets).toBe(afterMutation);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-permanent-title]')).toHaveCount(0);
  await page.locator('[data-act="open-owner-hall"]').click();
  await expect(hall.locator('[data-title-pick="none"]')).toHaveAttribute('aria-pressed', 'true');
  await hall.locator('[data-act="title-season-achievements"]').click();
  await expect(page.locator('[data-club-achievements]')).toBeVisible();
});

test('hall read failure can retry and shows all locked goals for a new owner', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  await page.route(`${API}/v1/**`, (route) =>
    route.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')),
  );
  await page.route(`${API}/v1/profile`, (route) =>
    route.fulfill(
      ok({
        id: 'new-owner',
        linked: { google: true },
        nickname: '새구단주',
        googleEmailMasked: null,
        recoveryCodeIssuedAt: null,
        createdAt: '2026-10-10T00:00:00.000Z',
      }),
    ),
  );
  let reads = 0;
  await page.route(`${API}/v1/owner/title`, (route) => {
    reads++;
    return route.fulfill(
      reads === 1
        ? fail(503, 'UNAVAILABLE', 'unavailable')
        : ok({
            title: null,
            titles: [],
            pinned: false,
            teamId: null,
            permanent: PERMANENT_TITLES.map((t) => ({
              id: t.id,
              target: t.target,
              value: 0,
              earnedAt: null,
              isNew: false,
            })),
          }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-permanent-title]')).toHaveCount(0);
  await page.locator('[data-act="open-owner-hall"]').click();
  const error = page.locator('[data-owner-hall-error]');
  await expect(error).toContainText('명예관을 불러오지 못했어요.');
  await error.getByRole('button', { name: '다시 시도' }).click();
  const hall = page.locator('[data-owner-hall]');
  await expect(hall.locator('[data-permanent-title]')).toHaveCount(13);
  await expect(hall.locator('[data-title-pick]')).toHaveCount(0);
  expect(reads).toBe(2);
});
