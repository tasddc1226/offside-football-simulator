import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, ok } from './helpers.js';

// T-11-360 홈 출석 체크: 홈에는 한 줄 입구만 두고, 출석 창은 하루 한 번 저절로 뜬다. 구단주는 매일 그날 칸의 보상을 받고,
// 로그인하지 않은 기기는 같은 도장판과 로그인 버튼을 본다(처음 온 방문자에게는 저절로 띄우지 않는다).
const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

async function stubOwner(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('ft_session', '1');
    if (localStorage.getItem('ft_owner') === null) localStorage.setItem('ft_owner', '1');
  });
  const calls = { get: 0, post: 0 };
  let checked = false;
  await page.route(`${API}/v1/attendance`, (r) => {
    calls.get++;
    const n = checked ? 7 : 6;
    return r.fulfill(ok({ today, checkedIn: checked, stamps: n, streak: n, bestStreak: 7 }));
  });
  await page.route(`${API}/v1/attendance/check-in`, (r) => {
    calls.post++;
    checked = true;
    return r.fulfill(
      ok({
        attendance: { today, checkedIn: true, stamps: 7, streak: 7, bestStreak: 7 },
        granted: { reroll: 0, boost: 2, scout: 0 },
      }),
    );
  });
  return calls;
}

test('출석 체크: 출석 창이 하루 한 번 뜨고, 출석하면 그날 칸의 보상을 받는다', async ({ page }) => {
  const calls = await stubOwner(page);
  await page.goto('/');
  const sheet = page.locator('[data-attendance-sheet="owner"]');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('도장 6/28');
  await expect(sheet.locator('[data-attendance-next]')).toContainText(
    '오늘 보상 · 잠재력 강화권 2장',
  );
  await expect(sheet.locator('[data-attendance-streak]')).toContainText('6일 연속');
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );

  await sheet.locator('[data-act="attendance-check-in"]').click();
  await expect(page.locator('.toast')).toContainText(
    '7번째 도장을 찍었어요. 받은 아이템: 잠재력 강화권 2장',
  );
  await expect(sheet.locator('[data-attendance-done]')).toBeVisible();
  await expect(sheet.locator('[data-attendance-next]')).toContainText('내일 보상 · 리롤권 1장');
  // T-11-440 받은 아이템과 쓰는 곳을 창 안에 남기고, 내 구단으로 가는 버튼을 둔다.
  await expect(sheet.locator('[data-attendance-got]')).toContainText(
    '받은 아이템: 잠재력 강화권 2장',
  );
  await expect(sheet.locator('[data-attendance-got]')).toContainText('선수 탭 잠재력 강화');
  await expect(sheet.locator('[data-act="attendance-to-owner"]')).toBeVisible();
  // T-11-440 칸에는 모양 기호와 장수를 적고, 누르면 그날 보상을 글로 보인다.
  await expect(sheet.locator('[data-attendance-cell="14"]')).toContainText('★1');
  await sheet.locator('[data-attendance-cell="14"]').click();
  await expect(sheet.locator('[data-attendance-pick]')).toContainText(
    '14일째 보상 · 프리미엄 스카우트권 1장',
  );
  await expect(sheet.locator('[data-attendance-cell="14"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await sheet.locator('[data-act="attendance-close"]').click();
  await expect(sheet).toHaveCount(0);

  // 홈에는 한 줄 입구만 남고, 누르면 다시 연다.
  const entry = page.locator('[data-act="attendance-open"]');
  await expect(entry).toContainText('오늘 도장 완료');
  await entry.click();
  await expect(sheet.locator('[data-attendance-done]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  expect(calls).toEqual({ get: 1, post: 1 });

  // 같은 날 다시 열어도 창이 저절로 뜨지 않는다.
  await page.reload();
  await expect(entry).toContainText('오늘 도장 완료');
  await expect(sheet).toHaveCount(0);
  expect(calls.post).toBe(1);
});

test('출석 체크: 출석 전이라도 오늘 이미 띄웠으면 다시 열 때 저절로 뜨지 않는다', async ({
  page,
}) => {
  await stubOwner(page);
  await page.goto('/');
  const sheet = page.locator('[data-attendance-sheet="owner"]');
  await expect(sheet).toBeVisible();
  await sheet.locator('[data-act="attendance-close"]').click();
  await page.reload();
  const entry = page.locator('[data-act="attendance-open"]');
  await expect(entry).toContainText('오늘 보상 · 잠재력 강화권 2장');
  await expect(sheet).toHaveCount(0);
});

test('출석 체크: 처음 온 방문자는 한 줄 입구만, 열면 로그인을 권한다', async ({ page }) => {
  let asked = 0;
  await page.route(`${API}/v1/attendance`, (r) => {
    asked++;
    return r.fulfill(ok({}));
  });
  await page.goto('/');
  const entry = page.locator('[data-act="attendance-open"][data-home-attendance="guest"]');
  await expect(entry).toContainText('로그인하면 매일 보상');
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await entry.click();
  const sheet = page.locator('[data-attendance-sheet="guest"]');
  await expect(sheet).toContainText(
    '28일 동안 받는 보상: 리롤권 20장, 잠재력 강화권 12장, 프리미엄 스카우트권 3장',
  );
  await expect(sheet.locator('[data-act="attendance-google-login"]')).toBeVisible();
  await expect(sheet.locator('[data-act="attendance-check-in"]')).toHaveCount(0);
  expect(asked).toBe(0);
});

test('출석 체크: 플레이해 본 비로그인 기기는 한 번 확인한 뒤 로그인 창을 하루 한 번 띄운다', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  let asked = 0;
  await page.route(`${API}/v1/attendance`, (r) => {
    asked++;
    return r.fulfill({
      status: 403,
      json: {
        error: {
          code: 'FORBIDDEN',
          message: '로그인하면 팀을 만들 수 있어요.',
          retryable: false,
          details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
        },
      },
    });
  });
  await page.goto('/');
  const sheet = page.locator('[data-attendance-sheet="guest"]');
  await expect(sheet.locator('[data-act="attendance-google-login"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('[data-act="attendance-open"]')).toContainText('로그인하면 매일 보상');
  await expect(sheet).toHaveCount(0);
  expect(asked).toBe(1);
});

// T-11-435 오늘 출석 전인 구단주는 출석 입구가 히어로 바로 아래로 올라오고, 출석한 뒤 다시 열면 원래 자리로 내려간다.
test('출석 체크: 받을 출석이 있으면 히어로 바로 아래, 출석하면 원래 자리', async ({ page }) => {
  const calls = await stubOwner(page);
  // 원래 자리는 시즌 게이지 아래다. 게이지를 그려 두어야 자리가 바뀐 것이 보인다.
  await page.route(`${API}/v1/season/gauge`, (r) =>
    r.fulfill(
      ok({
        gauge: {
          season: 1,
          startsAt: '2026-10-05T15:00:00.000Z',
          progress: 0.42,
          contributed: 4_200,
          participants: 830,
          target: 9_960,
          endsAt: null,
          minEndsAt: '2026-10-19T15:00:00.000Z',
          maxEndsAt: '2026-10-30T15:00:00.000Z',
          updatedAt: '2026-10-12T00:00:00.000Z',
        },
        seasons: [],
      }),
    ),
  );
  await page.goto('/');
  await expect(page.locator('[data-season-gauge]')).toBeVisible();
  const sheet = page.locator('[data-attendance-sheet="owner"]');
  await expect(sheet).toBeVisible();
  const heroNext = () =>
    page.evaluate(
      () =>
        document.querySelector('.hero-home')?.nextElementSibling?.getAttribute('data-act') ?? null,
    );
  await expect.poll(heroNext).toBe('attendance-open');

  await sheet.locator('[data-act="attendance-check-in"]').click();
  await expect(sheet.locator('[data-attendance-done]')).toBeVisible();
  await sheet.locator('[data-act="attendance-close"]').click();
  // 출석한 화면에서는 자리를 옮기지 않는다(누른 곳이 갑자기 사라지지 않게).
  expect(await heroNext()).toBe('attendance-open');

  await page.reload();
  const entry = page.locator('[data-act="attendance-open"]');
  await expect(entry).toContainText('오늘 도장 완료');
  await expect(page.locator('[data-season-gauge]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const gauge = document.querySelector('[data-season-gauge]')!;
        const entry = document.querySelector('[data-act="attendance-open"]')!;
        return !!(gauge.compareDocumentPosition(entry) & Node.DOCUMENT_POSITION_FOLLOWING);
      }),
    )
    .toBe(true);
  expect(calls.post).toBe(1);
});

test('출석 체크: 불러오지 못하면 누를 수 없는 빈 입구를 남기지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ft_session', '1');
    localStorage.setItem('ft_owner', '1');
  });
  let calls = 0;
  await page.route(`${API}/v1/attendance`, (r) => {
    calls++;
    return r.fulfill({
      status: 500,
      json: { error: { code: 'INTERNAL', message: 'x', retryable: true } },
    });
  });
  await page.goto('/');
  await expect.poll(() => calls).toBeGreaterThan(0);
  await expect(page.locator('[data-home-live], [data-home-live-pending]').first()).toBeVisible();
  await expect(page.locator('.home-att-entry')).toHaveCount(0);
});
