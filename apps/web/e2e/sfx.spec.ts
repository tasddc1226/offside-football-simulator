import { test, expect, type Page } from '@playwright/test';
import { API, ok } from './helpers.js';

// 클릭 효과음: 버튼을 누르면 Web Audio 오실레이터 하나로 '톡' 소리를 낸다. 설정에서 끄면 나지 않는다.
test('클릭 효과음: 버튼에서만 나고, 설정에서 끌 수 있다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __osc: number };
    w.__osc = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      w.__osc++;
      return create.call(this);
    };
  });
  const clicks = () => page.evaluate(() => (window as unknown as { __osc: number }).__osc);
  await page.goto('/');
  await page.locator('.hero-home h1').click();
  expect(await clicks()).toBe(0);

  await page.locator('[data-act="settings"]').click();
  // 클릭음은 버튼 처리가 끝난 뒤(결과음이 없을 때) 난다.
  await expect.poll(clicks).toBe(1);
  const toggle = page.locator('[data-setting="sfx"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  const after = await clicks();
  await page.locator('[data-act="owner"]').click();
  expect(await clicks()).toBe(after);
  expect(await page.evaluate(() => localStorage.getItem('ft_sfx'))).toBe('false');
});

// T-11-738 결과 효과음: 합성한 소리를 버퍼로 튼다(음원 파일 없음). 효과음을 끄면 나지 않는다.
async function stubAttendance(page: Page, sfx: boolean) {
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  await page.addInitScript((on) => {
    localStorage.setItem('ft_session', '1');
    localStorage.setItem('ft_owner', '1');
    localStorage.setItem('ft_sfx', JSON.stringify(on));
    const w = window as unknown as { __buf: number };
    w.__buf = 0;
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      w.__buf++;
      return create.call(this);
    };
  }, sfx);
  await page.route(`${API}/v1/attendance`, (r) =>
    r.fulfill(ok({ today, checkedIn: false, stamps: 6, streak: 6, bestStreak: 6 })),
  );
  await page.route(`${API}/v1/attendance/check-in`, (r) =>
    r.fulfill(
      ok({
        attendance: { today, checkedIn: true, stamps: 7, streak: 7, bestStreak: 7 },
        granted: { reroll: 0, boost: 2, scout: 0 },
      }),
    ),
  );
  return () => page.evaluate(() => (window as unknown as { __buf: number }).__buf);
}

test('결과 효과음: 출석 보상을 받으면 한 번 나고, 효과음을 끄면 나지 않는다', async ({ page }) => {
  const played = await stubAttendance(page, true);
  await page.goto('/');
  const sheet = page.locator('[data-attendance-sheet="owner"]');
  await expect(sheet).toBeVisible();
  expect(await played()).toBe(0);
  await sheet.locator('[data-act="attendance-check-in"]').click();
  await expect(sheet.locator('[data-attendance-done]')).toBeVisible();
  await expect.poll(played).toBe(1);
});

test('결과 효과음: 효과음을 꺼 두면 보상을 받아도 나지 않는다', async ({ page }) => {
  const played = await stubAttendance(page, false);
  await page.goto('/');
  const sheet = page.locator('[data-attendance-sheet="owner"]');
  await sheet.locator('[data-act="attendance-check-in"]').click();
  await expect(sheet.locator('[data-attendance-done]')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await played()).toBe(0);
});
