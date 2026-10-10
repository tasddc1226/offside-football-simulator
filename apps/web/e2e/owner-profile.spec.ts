import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';
import path from 'node:path';

test('owner profile image preview, save, reload and default restoration at mobile width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  let avatarId: string | null = null;
  const id = '11111111-1111-4111-8111-111111111111';
  const me = () => ({
    id: 'owner-image',
    nickname: '사진구단주',
    linked: { google: true },
    googleEmailMasked: 'f***@example.com',
    recoveryCodeIssuedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    avatarId,
  });
  await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')));
  await page.route(`${API}/v1/profile`, (r) => r.fulfill(ok(me())));
  let writes = 0;
  await page.route(`${API}/v1/profile/avatar`, (r) => {
    const body = r.request().postDataJSON() as { image: string | null };
    if (body.image) {
      expect(body.image).toMatch(/^data:image\/(webp|png);base64,/);
      expect(body.image.length).toBeLessThanOrEqual(16384);
    }
    writes++;
    avatarId = body.image ? id : null;
    return r.fulfill(ok(me()));
  });
  await page.route(`${API}/v1/avatars/*`, (r) =>
    r.fulfill({ path: path.resolve('public/brand/offside-icon-v7-64.png') }),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  const editor = page.locator('[data-owner-profile-editor]');
  await editor.locator('[data-owner-profile-edit]').click();
  await expect(page.locator('#account-slot input')).toHaveCount(0);
  await editor
    .locator('[data-avatar-upload]')
    .setInputFiles(path.resolve('public/brand/offside-icon-v7-64.png'));
  await expect(editor.locator('.preview')).toBeVisible();
  expect(writes).toBe(0);
  await editor.locator('[data-avatar-save]').click();
  await expect(page.locator('[data-owner-summary] > .owner-id > :first-child img')).toHaveAttribute(
    'src',
    `${API}/v1/avatars/${id}`,
  );
  await page.reload();
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-owner-summary] > .owner-id > :first-child img')).toBeVisible();
  await editor.locator('[data-owner-profile-edit]').click();
  await editor.locator('[data-avatar-reset]').click();
  await expect(page.locator('[data-owner-summary] > .owner-id > :first-child img')).toHaveCount(0);
  expect(writes).toBe(2);
  const dialog = editor.locator('[data-owner-profile-dialog]');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(editor.locator('[data-owner-profile-edit]')).toBeFocused();
  await editor.locator('[data-owner-profile-edit]').click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('owner entry shares one compact read and reentry uses cache', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  const requested: string[] = [];
  page.on('request', (req) => {
    if (req.url().startsWith(API)) requested.push(new URL(req.url()).pathname);
  });
  await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')));
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'owner-summary',
        nickname: '테스트구단주',
        linked: { google: true },
        googleEmailMasked: 'f***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        avatarId: null,
      }),
    ),
  );
  await page.route(`${API}/v1/owner/summary`, (r) =>
    r.fulfill(
      ok({
        linked: true,
        admin: false,
        tier: { season: 3, tier: 'diamond' },
        tiers: [
          { season: 3, tier: 'diamond' },
          { season: 2, tier: 'platinum' },
          { season: 1, tier: 'silver' },
          { season: 0, tier: 'gold' },
        ],
        entries: [{ id: 'one', season: 1, legendScore: 9710, retiredNumber: 9 }],
      }),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-owner-summary]')).toContainText('9,710');
  await expect(page.locator('[data-owner-summary]')).toContainText('프리시즌 골드');
  await expect(page.locator('[data-owner-tier-history] li')).toHaveCount(4);
  expect(
    await page
      .locator('[data-tier-season]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-tier-season'))),
  ).toEqual(['3', '2', '1', '0']);
  await page.locator('[data-act="home"]').click();
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-owner-summary]')).toContainText('9,710');
  expect(requested.filter((p) => p === '/v1/owner/summary')).toHaveLength(1);
  expect(
    requested.filter((p) =>
      ['/v1/careers/mine', '/v1/owner/season-recap', '/v1/boards/viewer'].includes(p),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
