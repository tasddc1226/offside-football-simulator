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
