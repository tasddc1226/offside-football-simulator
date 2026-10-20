import { test, expect } from '@playwright/test';
import { API, ok } from './helpers.js';
test.skip(
  process.env.E2E_ACQUISITION !== '1',
  'Requires isolated acquisition + synthetic Apple token build.',
);
test('320px optional consent, one session/start, campaign new tab and withdrawal', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await context.route('https://apps.apple.com/**', (r) => r.abort());
  await page.route('https://www.googletagmanager.com/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: '/* no analytics traffic */' }),
  );
  const sent: Record<string, unknown>[] = [];
  let granted = false;
  await page.route(`${API}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/v1/profile')
      return r.fulfill(
        ok({
          id: 'prf_test-acquisition',
          linked: { google: true, apple: false },
          nickname: null,
          avatarId: null,
          createdAt: '2026-10-17T00:00:00.000Z',
          recoveryCodeIssuedAt: null,
          googleEmailMasked: null,
        }),
      );
    if (path === '/v1/acquisition/consent')
      return r.fulfill(ok({ profileId: 'prf_test-acquisition', granted }));
    if (path === '/v1/acquisition') {
      const body = r.request().postDataJSON() as Record<string, unknown>;
      sent.push(body);
      if (body.action === 'grant') granted = true;
      if (body.action === 'revoke') granted = false;
      return body.action === 'grant'
        ? r.fulfill({ json: { profileId: 'prf_test-acquisition', granted: true } })
        : r.fulfill({ status: 204 });
    }
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto(
    '/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a&fbclid=PRIVATE',
  );
  expect(sent).toHaveLength(0);
  // T-11-417 이용 분석과 유입 · 결제 연결을 한 창에서 '모두 동의'로 함께 고른다.
  await expect(page.locator('[data-analytics="pick-acquisition"]')).not.toBeChecked();
  await page.locator('[data-analytics="accept"]').click();
  await expect.poll(() => sent.filter((v) => v.action === 'session').length).toBe(1);
  const link = page.locator('[data-app-conversion="home"] [data-act="app-store"]');
  const href = await link.getAttribute('href');
  expect(href).toContain('pt=123456');
  expect(href).not.toContain('PRIVATE');
  const popupPromise = page.waitForEvent('popup');
  await link.click();
  const popup = await popupPromise;
  await popup.close();
  await expect.poll(() => sent.filter((v) => v.action === 'store_click').length).toBe(1);
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect.poll(() => sent.filter((v) => v.action === 'start').length).toBe(1);
  expect(new Set(sent.filter((v) => v.sessionId).map((v) => v.sessionId)).size).toBe(1);
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  const consent = page.locator('section[data-analytics="consent"]');
  await expect(consent.locator('[data-analytics="pick-acquisition"]')).toBeChecked();
  await consent.locator('[data-analytics="pick-analytics"]').uncheck();
  await consent.locator('[data-analytics="deny"]').click();
  await expect.poll(() => sent.filter((v) => v.action === 'revoke').length).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/acquisition-320.png', fullPage: true });
  expect(JSON.stringify(sent)).not.toContain('PRIVATE');
});

test('settings keeps pending withdrawal available with analytics off and never targets the switched account', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('offside_analytics_consent_v1', 'denied');
    localStorage.setItem('offside_acquisition_choice_v1', 'denied');
    localStorage.setItem('offside_acquisition_revoke_v1', 'profile-a');
    localStorage.setItem('offside_acquisition_profile_v1', 'profile-a');
  });
  const sent: Record<string, unknown>[] = [];
  let originalAccount = false;
  await page.route(`${API}/**`, async (r) => {
    if (new URL(r.request().url()).pathname === '/v1/acquisition') {
      sent.push(r.request().postDataJSON() as Record<string, unknown>);
      return r.fulfill({ status: originalAccount ? 204 : 409 });
    }
    return r.fulfill({ status: 503 });
  });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  const consent = page.locator('section[data-analytics="consent"]');
  await expect(consent).toBeVisible();
  await expect(consent.getByRole('alert')).toContainText('원래 계정');
  await expect(consent.getByRole('button', { name: '모두 동의' })).toBeDisabled();
  expect(sent.every((b) => b.profileId === 'profile-a' && b.action === 'revoke')).toBe(true);
  originalAccount = true;
  await consent.getByRole('button', { name: '동의 안 함', exact: true }).click();
  await expect(consent.getByRole('alert')).not.toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('offside_acquisition_revoke_v1')),
  ).toBeNull();
});
