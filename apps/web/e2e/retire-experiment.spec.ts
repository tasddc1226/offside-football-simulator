import { test, expect, type Page } from '@playwright/test';
import { API, resumeWithSave } from './helpers.js';

// T-11-669 은퇴 화면 실험(기본 꺼짐). 서버 최신 밸런스 retireExpShare와 프로필 ID로 고정 배정한다.
// 실험군만 맨 위에 저장된 시즌 기록의 대표 장면(최대 3개)과 내 구단 다음 행동을 보고, 대조군 · 실험 밖은 지금 화면이다.
// 배정 해시는 app-core retireExperiment.test.ts가 고정한다. 아래 ID는 그 해시로 고른 값이다(share 0.5면 전원 참여).
const TREATMENT_ID = 'e2e-profile-1';
const CONTROL_ID = 'e2e-profile-0';

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});
const profile = (id: string, google: boolean) => ({
  data: {
    id,
    linked: { google, toss: false, apple: false },
    googleEmailMasked: google ? 'te***@gmail.com' : null,
    recoveryCodeIssuedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    nickname: null,
  },
});
const season = (p: Record<string, unknown>) => ({
  year: 2026,
  age: 18,
  club: '서울 FC',
  league: 'K리그1',
  apps: 0,
  goals: 0,
  assists: 0,
  cs: 0,
  rating: 0,
  rank: 5,
  ovr: 60,
  honors: [],
  ...p,
});
const CAREER = [
  season({ year: 2026, age: 18, apps: 10, goals: 2, assists: 1, rating: 6.4 }),
  season({
    year: 2027,
    age: 19,
    apps: 30,
    goals: 14,
    assists: 6,
    rating: 7.38,
    rank: 1,
    honors: ['K리그1 우승'],
  }),
  season({ year: 2028, age: 20, apps: 22, goals: 7, assists: 3, rating: 6.9 }),
];

async function stub(
  page: Page,
  o: { share?: number; profile?: { id: string; google: boolean } | 'none'; upload?: 'ok' | 'down' },
) {
  const calls = { profile: 0, balance: 0 };
  if (o.share !== undefined)
    await page.route(`${API}/v1/balance`, (r) => {
      calls.balance++;
      return r.fulfill(
        json({
          data: {
            version: 9,
            values: { retireExpShare: o.share },
            activatedAt: '2026-11-08T00:00:00.000Z',
          },
        }),
      );
    });
  await page.route(`${API}/v1/profile`, (r) => {
    calls.profile++;
    if (!o.profile || o.profile === 'none')
      return r.fulfill(
        json({ error: { code: 'UNAUTHENTICATED', message: '세션 없음', retryable: false } }, 401),
      );
    return r.fulfill(json(profile(o.profile.id, o.profile.google)));
  });
  await page.route(/\/v1\/careers\/[^/]+\/(seasons\/\d+|retirement)$/, (r) =>
    o.upload === 'down'
      ? r.fulfill(
          json(
            { error: { code: 'SERVICE_UNAVAILABLE', message: '점검 중', retryable: true } },
            503,
          ),
        )
      : r.fulfill(json({ data: {} })),
  );
  return calls;
}

/** 시즌 기록 셋을 가진 선수(기본 25세, 30세 이상이면 공유 바가 붙는다)로 이적 시장에서 바로 은퇴한다. */
async function retire(page: Page, age = 25, before?: () => void) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, {
    pending: { type: 'market', res: null, m: null },
    age,
    career: CAREER,
  });
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  before?.();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  await expect(page.locator('[data-credit="player"]')).toBeVisible();
}

async function noOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
}

test('꺼짐(기본): 서버 값을 못 받으면 지금 화면 그대로이고 실험 때문에 계정을 묻지 않는다', async ({
  page,
}) => {
  const calls = await stub(page, { profile: { id: TREATMENT_ID, google: false } });
  let atRetire = -1;
  await retire(page, 25, () => (atRetire = calls.profile));
  await expect(page.locator('[data-act="my-club"]')).toHaveText('내 구단 만들기');
  await page.waitForTimeout(800);
  await expect(page.locator('[data-retire-exp]')).toHaveCount(0);
  // 은퇴 업로드 큐가 보내기 전에 하는 세션 확인(outbox.ts) 한 번 말고는 은퇴 화면이 계정을 새로 묻지 않는다.
  expect(calls.profile - atRetire).toBeLessThanOrEqual(1);
});

test('비율 0이면 실험군 ID여도 지금 화면이다', async ({ page }) => {
  await stub(page, { share: 0, profile: { id: TREATMENT_ID, google: false } });
  await retire(page);
  await page.waitForTimeout(500);
  await expect(page.locator('[data-retire-exp]')).toHaveCount(0);
  await expect(page.locator('[data-act="my-club"]')).toBeVisible();
});

test('대조군은 지금 화면(내 구단 만들기 버튼 그대로)', async ({ page }) => {
  const calls = await stub(page, { share: 0.5, profile: { id: CONTROL_ID, google: false } });
  await retire(page);
  await expect.poll(() => calls.profile).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await expect(page.locator('[data-retire-exp]')).toHaveCount(0);
  await expect(page.locator('[data-act="my-club"]')).toHaveText('내 구단 만들기');
});

test('프로필 ID가 없으면(세션 없음) 실험 밖이라 지금 화면이다', async ({ page }) => {
  await stub(page, { share: 0.5, profile: 'none' });
  await retire(page);
  await page.waitForTimeout(800);
  await expect(page.locator('[data-retire-exp]')).toHaveCount(0);
  await expect(page.locator('[data-act="my-club"]')).toBeVisible();
});

for (const width of [320, 390]) {
  test(`실험군(${width}px): 대표 장면 3개 · 로그인 전 다음 행동, 가로로 넘치지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await stub(page, { share: 0.5, profile: { id: TREATMENT_ID, google: false } });
    await retire(page);
    const box = page.locator('[data-retire-exp="treatment"]');
    await expect(box).toBeVisible();
    // 리포트보다 위(맨 위)에 있다.
    const [boxY, reportY] = await Promise.all([
      box.evaluate((el) => el.getBoundingClientRect().top),
      page.locator('[data-credit="player"]').evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(boxY).toBeLessThan(reportY);
    const scenes = box.locator('[data-scene]');
    await expect(scenes).toHaveCount(3);
    await expect(scenes.nth(0)).toContainText('첫 출전 기록');
    await expect(scenes.nth(0)).toContainText('2026 · 18세');
    await expect(scenes.nth(1)).toContainText('최고 평점 시즌');
    await expect(scenes.nth(1)).toContainText('평점 7.38');
    await expect(scenes.nth(2)).toContainText('마지막 출전 시즌');
    await expect(box).not.toContainText('데뷔');
    // 장면을 누르면 그 시즌 기록이 펼쳐진다.
    await scenes.nth(1).locator('[data-act="retire-scene"]').click();
    await expect(scenes.nth(1).locator('[data-scene-detail]')).toContainText('1위');
    await expect(scenes.nth(1).locator('[data-act="retire-scene"]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    // 업로드가 끝난 로그인 전 구단주: 로그인하면 팀을 꾸릴 수 있다고만 말한다.
    const next = box.locator('[data-retire-next]');
    await expect(next).toHaveAttribute('data-retire-next', 'login');
    await expect(next).toContainText('로그인하면');
    // 실험군은 같은 길을 두 번 두지 않는다. 새 커리어 · 명예의 전당 · 공유는 그대로다.
    await expect(page.locator('[data-act="my-club"]')).toHaveCount(0);
    await expect(page.locator('[data-act="new"]')).toBeVisible();
    await expect(page.locator('[data-act="home"]')).toBeAttached();
    await noOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`retire-exp-${width}.png`) });
    await next.locator('[data-act="retire-next"]').click();
    await expect(page.locator('[data-owner-team-locked]')).toBeVisible();
  });
}

test('실험군: 업로드 대기 중이면 올라갔다고 말하지 않고, 로그인한 구단주가 올라가면 내 팀 편성으로 간다', async ({
  page,
}) => {
  let down = true;
  await stub(page, { share: 0.5, profile: { id: TREATMENT_ID, google: true } });
  await page.route(/\/v1\/careers\/[^/]+\/retirement$/, (r) =>
    down
      ? r.fulfill(
          json(
            { error: { code: 'SERVICE_UNAVAILABLE', message: '점검 중', retryable: true } },
            503,
          ),
        )
      : r.fallback(),
  );
  await retire(page, 34);
  const next = page.locator('[data-retire-next]');
  await expect(next).toHaveAttribute('data-retire-next', 'wait');
  await expect(next).toContainText('올리는 중이에요');
  await expect(next).not.toContainText('올라갔어요');
  down = false;
  await page.locator('[data-act="upload-retry"]').click();
  await expect(next).toHaveAttribute('data-retire-next', 'team');
  await expect(next).toContainText('내 팀 편성에서 이 선수를 고를 수 있어요');
  const teamLoad = page.waitForRequest((r) => r.url().startsWith(`${API}/v1/owner-team`));
  await next.locator('[data-act="retire-next"]').click();
  // 은퇴 화면을 떠나 내 팀 화면이 팀을 불러온다.
  await teamLoad;
  await expect(page.locator('[data-credit="player"]')).toHaveCount(0);
});

test('데이터가 모자라면 장면을 줄이고, 출전 기록이 없으면 장면 없이 다음 행동만 보인다', async ({
  page,
}) => {
  await stub(page, { share: 0.5, profile: { id: TREATMENT_ID, google: false } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, {
    pending: { type: 'market', res: null, m: null },
    age: 25,
    career: [season({ apps: 0 })],
  });
  const sheet = page.locator('#sheet');
  await sheet.getByRole('button', { name: '은퇴하기' }).click();
  await sheet.getByRole('button', { name: '은퇴한다' }).click();
  const box = page.locator('[data-retire-exp="treatment"]');
  await expect(box).toBeVisible();
  await expect(box.locator('[data-scene]')).toHaveCount(0);
  await expect(box.locator('[data-retire-next]')).toBeVisible();
});
