import { test, expect } from '@playwright/test';
import { API, fail, ok } from './helpers.js';

// T-11-321 설정의 서버 상태: 펼칠 때만 한 번 불러오고, 접었다 펴도 다시 부르지 않는다.
test('서버 상태는 펼칠 때 한 번만 불러와 상태·추이·30일 표를 그린다', async ({ page }) => {
  const now = Date.now();
  const at = new Date(Math.floor(now / 300_000) * 300_000 - 300_000).toISOString();
  let calls = 0;
  await page.route(`${API}/v1/status**`, (r) => {
    calls++;
    return r.fulfill(
      ok({
        generatedAt: new Date(now).toISOString(),
        buckets: [{ at, requests: 600, avgMs: 240, slow: 3, errors: 0 }],
        days: [{ day: '2026-10-16', requests: 1100000, avgMs: 280, slow: 900, errors: 2 }],
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  const card = page.locator('[data-settings="server-status"]');
  await expect(card).toBeVisible();
  expect(calls).toBe(0); // 설정을 열기만 해서는 부르지 않는다

  await card.locator('summary').click();
  await expect(card.locator('[data-status-level="ok"]')).toContainText('정상이에요');
  await expect(card.locator('[data-status-chart="requests"] .bar')).toHaveCount(24);
  await expect(card.locator('[data-status-days]')).toContainText('1,100,000');

  await card.locator('summary').click();
  await card.locator('summary').click();
  await expect(card.locator('[data-status-level]')).toBeVisible();
  expect(calls).toBe(1);
});

test('서버 상태를 못 불러오면 안내하고, 다시 펼치면 새로 부른다', async ({ page }) => {
  let calls = 0;
  await page.route(`${API}/v1/status**`, (r) => {
    calls++;
    return r.fulfill(fail(503, 'SERVICE_UNAVAILABLE', 'down'));
  });
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  const card = page.locator('[data-settings="server-status"]');
  await card.locator('summary').click();
  await expect(card).toContainText('서버 상태를 불러오지 못했어요');
  await card.locator('summary').click();
  await card.locator('summary').click();
  await expect.poll(() => calls).toBe(2);
});
