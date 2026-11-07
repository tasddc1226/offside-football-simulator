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
// T-11-417 유입 · 결제 연결을 아직 고르지 않았으면 동의 창이 다시 뜨므로, 이용 분석만 동의한 상태로 시작한다.
async function grantAnalytics(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'granted');
    localStorage.setItem('offside_acquisition_choice_v1', 'denied');
  }, consentKey);
}
// T-11-615 두 탭 중복이 CI에서만 드물게 나와 원인을 못 잡았다. 실패하면 장부 읽기 · 쓰기 · 잠금 순서를 로그에 남긴다(커리어 ID는 남기지 않는다).
async function traceMetricsLedger(page: Page, tab: string) {
  await page.addInitScript((tab) => {
    if (!navigator.locks) return;
    const key = 'offside_player_metrics_v1';
    const trace: unknown[] = [];
    Reflect.set(window, '__ledgerTrace', trace);
    const note = (op: string, raw?: string | null) => {
      const ledger = raw ? JSON.parse(raw) : null;
      trace.push({
        tab,
        at: performance.timeOrigin + performance.now(),
        op,
        ...(ledger && {
          firstPlay: ledger.firstPlay ?? null,
          phases: ledger.marks.map((m: { phase: number }) => m.phase),
        }),
      });
    };
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (k) {
      const raw = getItem.call(this, k);
      if (k === key) note('read', raw);
      return raw;
    };
    Storage.prototype.setItem = function (k, v) {
      setItem.call(this, k, v);
      if (k === key) note('write', v);
    };
    const request = navigator.locks.request.bind(navigator.locks) as (
      name: string,
      callback: LockGrantedCallback<unknown>,
    ) => Promise<unknown>;
    Reflect.set(
      navigator.locks,
      'request',
      (name: string, callback: LockGrantedCallback<unknown>) => {
        note('lock-ask');
        return request(name, (lock: Lock | null) => {
          note('lock-got');
          const result = callback(lock);
          note('lock-done');
          return result;
        });
      },
    );
  }, tab);
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
// T-11-437 동의 창은 홈에서만 묻는다. 다른 화면으로 바로 들어오면 고르기 전까지 아무것도 보내지 않고, 홈에 오면 묻는다.
test('consent sheet waits for home and sends nothing on other screens before a choice', async ({
  page,
}) => {
  await prepare(page);
  await page.goto('/career/00000000-0000-4000-8000-000000000000');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('[data-analytics="consent"]')).toHaveCount(0);
  expect(await commands(page)).toEqual([]);
  await page.goto('/');
  await expect(page.locator('[data-analytics="consent"]')).toBeVisible();
  await page.locator('[data-analytics="deny"]').click();
  await expect(page.locator('[data-analytics="consent"]')).toHaveCount(0);
});
test('opt-in normalizes URL, tracks once per screen and new career, withdraws across tabs', async ({
  page,
  context,
}) => {
  await prepare(page);
  await page.goto(
    '/?code=PRIVATE_CODE&email=PRIVATE_EMAIL&utm_source=threads&utm_medium=social&utm_campaign=season1_launch&utm_content=s1_story_01&unknown=PRIVATE#PRIVATE_HASH',
  );
  // 이용 분석만 고른다(유입 · 결제 연결 거절도 함께 저장돼 다시 열어도 동의 창이 뜨지 않는다).
  await page.locator('[data-analytics="pick-analytics"]').check();
  await page.locator('[data-analytics="deny"]').click();
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
  await tab.locator('[data-analytics="pick-analytics"]').uncheck();
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
  await grantAnalytics(page);
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
  await grantAnalytics(page);
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
  // Analytics loads independently of gameplay; wait for its ready marker after every reload.
  await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);
  await page.locator('[data-act="continue"]').click();
  expect(await events('career_resume')).toHaveLength(0);

  // Natural UI play, never patching the save or invoking the analytics adapter directly.
  async function step() {
    // T-11-390 장면 결과 줄이 머무는 동안(1.8초)은 누를 게 없다 — 반복 횟수를 쓰지 않게 사라질 때까지 기다린다.
    const result = page.locator('#sheet [data-key-moment-result]');
    if (await result.isVisible()) {
      await expect(result).toBeHidden({ timeout: 5_000 });
      return;
    }
    for (const selector of [
      '#an-skip',
      // T-11-390 결정적 장면 카드는 감독에게 맡긴다.
      '#sheet [data-key-moment-choice="auto"]:visible',
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
  // Moment/result cards can spend many steps waiting; bound wall time, not no-op step count.
  const progressDeadline = Date.now() + 90_000;
  while (Date.now() < progressDeadline && (await events('career_progress_milestone')).length === 0)
    await step();
  expect(await events('career_progress_milestone')).toHaveLength(1);
  expect(await events('first_action_complete')).toHaveLength(0);
  expect(await events('first_season_complete')).toHaveLength(1);
  expect(await events('player_first_play')).toHaveLength(1);
  expect(await events('player_first_season')).toHaveLength(1);
  expect((await events('player_first_play'))[0]?.[2]).toMatchObject({
    cohort_origin: 'observed_new',
    test_marker: 'qa',
    client_platform: 'web',
  });
  // Player metrics run through the async Web Locks queue; the season milestone is synchronous.
  await expect.poll(async () => (await events('play_complete')).length).toBeGreaterThanOrEqual(6);
  expect(
    (await events('game_operation')).every(
      (x) => (x[2] as { outcome: string }).outcome !== 'failed',
    ),
  ).toBe(true);
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
  await traceMetricsLedger(page, 'A');
  await grantAnalytics(page);
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
  await traceMetricsLedger(tab, 'B');
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
  try {
    await expect
      .poll(async () => (await combined()).filter((x) => x[1] === 'play_complete').length)
      .toBe(1);
    const all = await combined();
    expect(all.filter((x) => x[1] === 'player_first_play')).toHaveLength(1);
    expect(
      all.filter(
        (x) =>
          x[1] === 'game_operation' && (x[2] as { operation: string }).operation === 'progress',
      ),
    ).toHaveLength(3);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ft_save')!).phase)).toBe(2);
  } catch (error) {
    const traces = await Promise.all(
      [page, tab].map((p) => p.evaluate(() => Reflect.get(window, '__ledgerTrace') as unknown[])),
    );
    const order = (traces.flat() as { at: number }[]).sort((a, b) => a.at - b.at);
    console.log(`[metrics ledger trace] ${JSON.stringify(order)}`);
    throw error;
  }
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
// T-11-597 유럽 · 영국 · 스위스 밖(지역 쿠키 notice)은 방침 시행일부터 묻지 않고 켜고, 이미 거절한 브라우저는 그대로 둔다.
test('notice region starts on without the sheet and keeps an earlier denial', async ({
  page,
  context,
  baseURL,
}) => {
  await prepare(page);
  await page.clock.setSystemTime(new Date('2026-11-08T00:00:00Z'));
  await context.addCookies([
    { name: 'offside_consent_region', value: 'notice', url: baseURL ?? 'http://localhost' },
  ]);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('[data-analytics="consent"]')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('granted');
  await expect.poll(async () => (await commands(page)).some((c) => c[0] === 'config')).toBe(true);

  await page.evaluate((key) => localStorage.setItem(key, 'denied'), consentKey);
  await page.reload();
  await expect(page.locator('main')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('denied');
  expect(await commands(page)).toEqual([]);
});

// T-11-669 은퇴 화면 실험: 태그를 한 번 불러온 뒤 철회 → 은퇴(노출 보류) → 재동의하면 그때 노출을 보내고,
// 철회 중에 누른 장면은 되돌려 보내지 않는다(실제 웹 어댑터 경로, loaded 분기의 ready()).
test('retire experiment exposure waits for re-consent after the tag was loaded once', async ({
  page,
  context,
}) => {
  await grantAnalytics(page);
  await prepare(page);
  await page.route(`${API}/v1/balance`, (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          version: 9,
          values: { retireExpShare: 0.5 },
          activatedAt: '2026-11-08T00:00:00.000Z',
        },
      }),
    }),
  );
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'e2e-profile-1', // 실험군(retireExperiment 해시)
          linked: { google: false, toss: false, apple: false },
          googleEmailMasked: null,
          recoveryCodeIssuedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          nickname: null,
        },
      }),
    }),
  );
  await page.route(/\/v1\/careers\/[^/]+\/(seasons\/\d+|retirement)$/, (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) }),
  );
  await startCareer(page);
  await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);
  await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('ft_save')!);
    g.pending = { type: 'market', res: null, m: null };
    g.age = 25;
    g.career = [
      {
        year: 2026,
        age: 18,
        club: '서울 FC',
        league: 'K리그1',
        apps: 10,
        goals: 2,
        assists: 1,
        cs: 0,
        rating: 6.4,
        rank: 5,
        ovr: 60,
        honors: [],
      },
      {
        year: 2027,
        age: 19,
        club: '서울 FC',
        league: 'K리그1',
        apps: 30,
        goals: 9,
        assists: 4,
        cs: 0,
        rating: 7.1,
        rank: 2,
        ovr: 66,
        honors: [],
      },
    ];
    localStorage.setItem('ft_save', JSON.stringify(g));
  });
  await page.reload();
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('script[data-offside-analytics]')).toHaveCount(1);

  // 다른 탭에서 철회한다(이 탭은 storage 이벤트로 stop()).
  const tab = await context.newPage();
  await tab.goto('/app-ads.txt');
  await tab.evaluate((key) => localStorage.setItem(key, 'denied'), consentKey);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('offside_retire_exp_v1')))
    .toBeNull();

  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  const box = page.locator('[data-retire-exp="treatment"]');
  await expect(box).toBeVisible();
  await box.locator('[data-act="retire-scene"]').first().click(); // 노출 전 클릭
  const names = async () =>
    (await commands(page))
      .filter((x) => x[0] === 'event' && String(x[1]).startsWith('retire_exp_'))
      .map((x) => x[1]);
  expect(await names()).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('offside_retire_exp_v1'))).toBeNull();

  // 재동의: 태그는 이미 불러왔으므로 loaded 분기에서 보류한 노출을 보낸다.
  await tab.evaluate((key) => localStorage.setItem(key, 'granted'), consentKey);
  await expect.poll(names).toEqual(['retire_exp_exposure']);
  await box.locator('[data-act="retire-scene"]').nth(1).click();
  await expect.poll(names).toEqual(['retire_exp_exposure', 'retire_exp_scene_open']);
  const wire = JSON.stringify(await commands(page));
  expect(wire).not.toContain('e2e-profile-1');
  expect(await page.evaluate(() => localStorage.getItem('offside_retire_exp_v1'))).not.toBeNull();
});
