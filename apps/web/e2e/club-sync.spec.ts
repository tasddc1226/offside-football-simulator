import { test, expect, type Page, type Route } from '@playwright/test';

// T-10-010: 클럽 커스텀 계정 동기화. API는 route로 흉내 낸다(e2e 기본 API 주소 localhost:8787).
const API = /localhost:8787\/v1\/club-custom/;
const envelope = (data: unknown) => ({ data, meta: { requestId: 'req_e2e' } });

async function openPl(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('#club-league').selectOption('pl');
}

test('로그인 상태면 계정에 저장된 클럽 이름을 받아 오고, 바꾸면 계정으로 보낸다', async ({ page }) => {
  let server = { clubs: { 'pl-0': { name: '서버 FC' } }, updatedAt: '2026-09-25T00:00:00.000Z' };
  const puts: { clubs: Record<string, { name?: string }>; updatedAt: string }[] = [];
  await page.route(API, async (route: Route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as typeof puts[number];
      puts.push(body);
      server = body as typeof server;
    }
    await route.fulfill({ json: envelope(server) });
  });

  await openPl(page);
  await expect(page.locator('[data-club="pl-0"] input[type="text"]')).toHaveValue('서버 FC');
  await expect(page.locator('[data-club-sync]')).toHaveAttribute('data-club-sync', 'synced');

  const input = page.locator('[data-club="pl-1"] input[type="text"]');
  await input.fill('동기화 FC');
  await input.blur();
  await expect.poll(() => puts.length, { timeout: 5000 }).toBeGreaterThan(0);
  expect(puts.at(-1)!.clubs['pl-1']!.name).toBe('동기화 FC');
  expect(puts.at(-1)!.clubs['pl-0']!.name).toBe('서버 FC');
  await expect(page.locator('[data-club-sync]')).toHaveAttribute('data-club-sync', 'synced');
});

test('세션이 없으면 이 기기에만 저장하고 서버로 보내지 않는다', async ({ page }) => {
  let putCount = 0;
  await page.route(API, async (route: Route) => {
    if (route.request().method() === 'PUT') putCount++;
    await route.fulfill({ status: 401, json: { error: { code: 'PROFILE_REQUIRED', message: '프로필 세션이 필요합니다.', retryable: false }, meta: { requestId: 'req_e2e' } } });
  });
  await openPl(page);
  await expect(page.locator('[data-club-sync]')).toHaveAttribute('data-club-sync', 'local');
  const input = page.locator('[data-club="pl-2"] input[type="text"]');
  await input.fill('로컬 FC');
  await input.blur();
  await page.reload();
  await page.locator('[data-act="settings"]').click();
  await page.locator('#club-league').selectOption('pl');
  await expect(page.locator('[data-club="pl-2"] input[type="text"]')).toHaveValue('로컬 FC');
  expect(putCount).toBeLessThanOrEqual(1); // 편집 직후 한 번 시도 → 401 → 로컬 모드
});
