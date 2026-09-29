import { test, expect, type Page } from '@playwright/test';
import { startCareer, API } from './helpers.js';

test.skip(
  process.env.E2E_ANALYTICS !== '1',
  'Run with the isolated GA4 test build; no production traffic.',
);
const consentKey = 'offside_analytics_consent_v1';
const ledgerKey = 'offside_analytics_ledger_v1';
async function commands(page: Page): Promise<unknown[][]> {
  return page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((x) =>
      Array.from(x),
    ),
  );
}
async function prepare(page: Page) {
  await page.route(`${API}/**`, (r) => r.fulfill({ status: 503, body: '' }));
  await page.route('https://www.googletagmanager.com/**', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: '/* GA queue inspected without sending test traffic */',
    }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
test('no tag or analytics storage before consent/after denial, gameplay still saves', async ({
  page,
}) => {
  await prepare(page);
  const google: string[] = [];
  page.on('request', (r) => {
    if (/google-analytics|googletagmanager/.test(r.url())) google.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('[data-analytics="consent"]')).toBeVisible();
  await page.locator('[data-analytics="deny"]').click();
  await startCareer(page);
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBeTruthy();
  expect(await page.evaluate((key) => localStorage.getItem(key), ledgerKey)).toBeNull();
  expect(google).toEqual([]);
});
test('opt-in normalizes URL, tracks once per screen and new career, withdraws across tabs', async ({
  page,
  context,
}) => {
  await prepare(page);
  await page.goto(
    '/?code=PRIVATE_CODE&email=PRIVATE_EMAIL&utm_source=threads&utm_medium=social&utm_campaign=launch#PRIVATE_HASH',
  );
  await page.locator('[data-analytics="accept"]').click();
  await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);
  const first = await commands(page);
  const wire = JSON.stringify(first);
  expect(wire).not.toContain('PRIVATE');
  expect(wire).toContain('utm_source=threads');
  expect(first.filter((x) => x[0] === 'event' && x[1] === 'page_view')).toHaveLength(1);
  expect(first.find((x) => x[0] === 'config')?.[2]).toMatchObject({
    send_page_view: false,
    allow_google_signals: false,
  });
  await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
  await page.locator('[data-act="next-candidates"]').click();
  await page.locator('[data-cand="0"]').click();
  await page.locator('[data-act="start"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
  const after = await commands(page);
  expect(after.filter((x) => x[0] === 'event' && x[1] === 'career_start')).toHaveLength(1);
  expect(after.filter((x) => x[0] === 'event' && x[1] === 'page_view')).toHaveLength(3);
  const save = await page.evaluate(() => localStorage.getItem('ft_save'));
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect((await commands(page)).filter((x) => x[1] === 'career_start')).toHaveLength(0);
  const tab = await context.newPage();
  await prepare(tab);
  await tab.goto('/');
  await tab.locator('[data-act="settings"]').click();
  await tab.locator('[data-analytics="deny"]').click();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), consentKey))
    .toBe('denied');
  expect(await page.evaluate((key) => localStorage.getItem(key), ledgerKey)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('ft_save'))).toBe(save);
  expect(
    await page.evaluate(() =>
      Object.entries(window)
        .filter(([key]) => key.startsWith('ga-disable-'))
        .map(([, value]) => value),
    ),
  ).toContain(true);
  const before = await commands(page);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect(await commands(page)).toEqual([]);
  expect(before).toEqual([]);
});
test('shared URLs and player names never enter GA commands', async ({ page }) => {
  await prepare(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'granted'), consentKey);
  await page.goto('/career/00000000-0000-4000-8000-000000000000?secret=PRIVATE#PRIVATE');
  await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);
  const wire = JSON.stringify(await commands(page));
  expect(wire).toContain('/shared_career');
  expect(wire).not.toContain('00000000');
  expect(wire).not.toContain('PRIVATE');
});
