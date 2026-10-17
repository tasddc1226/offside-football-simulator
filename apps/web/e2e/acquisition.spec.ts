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
  await page.locator('[data-analytics="accept"]').click();
  const consent = page.locator('section[aria-label="유입과 앱 결제 연결"]');
  await expect(consent).toBeVisible();
  expect(sent).toHaveLength(0);
  await consent.getByRole('button', { name: '유입·결제 연결에 동의' }).click();
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
  await expect(consent).toBeVisible();
  await consent.getByRole('button', { name: '분석 동의 철회' }).click();
  await expect.poll(() => sent.filter((v) => v.action === 'revoke').length).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/acquisition-320.png', fullPage: true });
  expect(JSON.stringify(sent)).not.toContain('PRIVATE');
});
