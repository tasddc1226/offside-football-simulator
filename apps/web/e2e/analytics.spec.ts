import { test, expect, type Page } from '@playwright/test';
import { clearPendingEvent, startCareer, API } from './helpers.js';

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
  await page.goto(
    '/?utm_source=instagram&utm_medium=social&utm_campaign=season1_launch&utm_content=s1_bio',
  );
  expect(await commands(page)).toEqual([]);
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
    '/?code=PRIVATE_CODE&email=PRIVATE_EMAIL&utm_source=threads&utm_medium=social&utm_campaign=season1_launch&utm_content=s1_story_01&unknown=PRIVATE#PRIVATE_HASH',
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
  for (const event of after.filter(
    (x) => x[0] === 'event' && ['page_view', 'career_start'].includes(String(x[1])),
  )) {
    const params = event[2] as { page_location: string };
    expect(new URL(params.page_location).search).toBe(
      '?utm_source=threads&utm_medium=social&utm_campaign=season1_launch&utm_content=s1_story_01',
    );
  }
  expect(JSON.stringify(after)).not.toContain('PRIVATE');
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
  expect(await page.evaluate(() => localStorage.getItem('offside_player_metrics_v1'))).toBeNull();
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

test('actual play measures first action, milestones and a resumed career without reload duplicates', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await prepare(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'granted'), consentKey);
  await startCareer(page);
  await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);
  const events = async (name: string) =>
    (await commands(page)).filter((x) => x[0] === 'event' && x[1] === name);
  expect(await events('first_action_complete')).toHaveLength(0);
  expect(await events('play_complete')).toHaveLength(0);
  expect(await events('player_first_play')).toHaveLength(0);
  await page.locator('[data-act="advance"]').click();
  await expect.poll(async () => (await events('first_action_complete')).length).toBe(1);
  expect(await events('career_resume')).toHaveLength(0);
  expect(await events('play_complete')).toHaveLength(0); // preseason has no league block
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  expect(await events('career_resume')).toHaveLength(0);

  // Natural UI play, never patching the save or invoking the analytics adapter directly.
  async function step() {
    for (const selector of [
      '#an-skip',
      '.choice:visible',
      '[data-opt]:visible',
      // T-11-039 오퍼를 고르면 계약서가 뜬다 — 이름 사인을 넣고 확정한다.
      '#sheet [data-sign="ok"]:enabled',
      '#sheet [data-sign="name"]:enabled',
      '#sheet [data-sheet]:visible',
      '[data-act="resume"]:visible',
      '[data-act="advance"]:visible',
    ]) {
      if (selector.startsWith('[data-act=') && (await page.locator('#sheet').isVisible())) continue;
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        await el.click({ timeout: 2000 });
        return;
      }
    }
    await page.waitForTimeout(50);
  }
  for (let i = 0; i < 300 && (await events('career_progress_milestone')).length === 0; i++)
    await step();
  expect(await events('first_action_complete')).toHaveLength(0);
  expect(await events('first_season_complete')).toHaveLength(1);
  expect(await events('player_first_play')).toHaveLength(1);
  expect(await events('player_first_season')).toHaveLength(1);
  expect((await events('player_first_play'))[0]?.[2]).toMatchObject({
    cohort_origin: 'observed_new',
    test_marker: 'qa',
    client_platform: 'web',
  });
  expect((await events('play_complete')).length).toBeGreaterThanOrEqual(6);
  expect(
    (await events('game_operation')).every(
      (x) => (x[2] as { outcome: string }).outcome !== 'failed',
    ),
  ).toBe(true);
  expect(await events('career_progress_milestone')).toHaveLength(1);
  expect((await events('career_progress_milestone'))[0]?.[2]).toMatchObject({
    milestone_seasons: 3,
  });
  expect(await events('career_resume')).toHaveLength(0);
  // Advance only the analytics activity clock to exercise the inactivity boundary.
  await page.evaluate((key) => {
    const l = JSON.parse(localStorage.getItem(key)!);
    for (const e of l.entries) e.lastActionAt = Date.now() - 31 * 60_000;
    localStorage.setItem(key, JSON.stringify(l));
  }, ledgerKey);
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);
  expect(await events('career_resume')).toHaveLength(0);
  expect(await events('career_progress_milestone')).toHaveLength(0);
  for (let i = 0; i < 30 && (await events('career_resume')).length === 0; i++) await step();
  expect(await events('career_resume')).toHaveLength(1);
  expect(await events('first_action_complete')).toHaveLength(0);
  expect(await events('career_progress_milestone')).toHaveLength(0);
  const wire = JSON.stringify(await commands(page));
  const cid = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).cid);
  expect(wire).not.toContain(cid);
});

test('two tabs completing the same half and repeated clicks emit one player milestone', async ({
  page,
  context,
}) => {
  await prepare(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'granted'), consentKey);
  await startCareer(page);
  await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);
  await page.locator('[data-act="advance"]').click();
  await expect
    .poll(async () => (await commands(page)).filter((x) => x[1] === 'first_action_complete').length)
    .toBe(1);
  if (await page.locator('#an-skip').isVisible()) await page.locator('#an-skip').click();
  await expect(page.locator('#sheet')).toBeHidden();
  await clearPendingEvent(page);
  const tab = await context.newPage();
  await prepare(tab);
  await tab.goto('/');
  await tab.locator('[data-act="continue"]').click();
  await expect(tab.locator('script[data-offside-analytics]')).toHaveCount(1);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase);
  expect(before).toBe(1);
  await Promise.all(
    [page, tab].map((p) =>
      p.locator('[data-act="advance"]').evaluate((el) => {
        (el as HTMLElement).click();
        (el as HTMLElement).click();
      }),
    ),
  );
  const combined = async () => [...(await commands(page)), ...(await commands(tab))];
  await expect
    .poll(async () => (await combined()).filter((x) => x[1] === 'play_complete').length)
    .toBe(1);
  const all = await combined();
  expect(all.filter((x) => x[1] === 'player_first_play')).toHaveLength(1);
  expect(
    all.filter(
      (x) => x[1] === 'game_operation' && (x[2] as { operation: string }).operation === 'progress',
    ),
  ).toHaveLength(3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase)).toBe(2);
});

for (const [source, campaign, content] of [
  ['instagram', 'season1_launch', 's1_bio'],
  ['instagram', 'season1_launch', 's1_ig_story_01'],
  ['threads', 'launch', 'career'],
  ['threads', 'retirement_share', 'retirement'],
  ['threads', 'season1_launch', 'PRIVATE_PERSON'],
]) {
  test(`sanitized attribution survives navigation: ${source}/${campaign}/${content}`, async ({
    page,
  }) => {
    await prepare(page);
    await page.goto(
      `/?utm_source=${source}&utm_medium=social&utm_campaign=${campaign}&utm_content=${content}&email=PRIVATE#PRIVATE`,
    );
    await page.locator('[data-analytics="accept"]').click();
    await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);
    await page.getByRole('button', { name: /새 커리어 킥오프/ }).click();
    await page.locator('[data-act="next-candidates"]').click();
    await page.locator('[data-cand="0"]').click();
    await page.locator('[data-act="start"]').click();
    await expect(page.locator('.player h1')).toBeVisible();
    const events = (await commands(page)).filter(
      (x) => x[0] === 'event' && ['page_view', 'career_start'].includes(String(x[1])),
    );
    expect(events.filter((x) => x[1] === 'page_view')).toHaveLength(3);
    expect(events.filter((x) => x[1] === 'career_start')).toHaveLength(1);
    for (const event of events) {
      const url = new URL((event[2] as { page_location: string }).page_location);
      expect(url.search).toBe(
        `?utm_source=${source}&utm_medium=social&utm_campaign=${campaign}${content === 'PRIVATE_PERSON' ? '' : `&utm_content=${content}`}`,
      );
    }
    expect(JSON.stringify(await commands(page))).not.toContain('PRIVATE');
  });
}
