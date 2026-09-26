import { test, expect, type Page, type Route } from '@playwright/test';

// T-10-010: 클럽 커스텀 계정 동기화. API는 route로 흉내 낸다(e2e 기본 API 주소 localhost:8787).
const API = /localhost:8787\/v1\/club-custom/;
const envelope = (data: unknown) => ({ data, meta: { requestId: 'req_e2e' } });

// 이 기기에서 프로필 조회가 성공한 적이 있다는 표시(T-10-037) — 있어야 부팅 때 계정과 맞춘다.
const withSessionHint = (page: Page) => page.addInitScript(() => localStorage.setItem('ft_session', '1'));

async function openPl(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="clubs"]').click();
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

  await withSessionHint(page);
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
  let getCount = 0;
  await page.route(API, async (route: Route) => {
    if (route.request().method() === 'PUT') putCount++;
    else getCount++;
    await route.fulfill({ status: 401, json: { error: { code: 'PROFILE_REQUIRED', message: '프로필 세션이 필요합니다.', retryable: false }, meta: { requestId: 'req_e2e' } } });
  });
  await openPl(page);
  await expect(page.locator('[data-club-sync]')).toHaveAttribute('data-club-sync', 'local');
  const input = page.locator('[data-club="pl-2"] input[type="text"]');
  await input.fill('로컬 FC');
  await input.blur();
  await page.reload();
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="clubs"]').click();
  await page.locator('#club-league').selectOption('pl');
  await expect(page.locator('[data-club="pl-2"] input[type="text"]')).toHaveValue('로컬 FC');
  expect(putCount).toBeLessThanOrEqual(1); // 편집 직후 한 번 시도 → 401 → 로컬 모드
  expect(getCount).toBe(0); // 세션이 있었던 적 없는 기기는 부팅 때 묻지 않는다(콘솔 401 없음)
});

test('세션 표시가 있어도 서버가 세션이 없다고 하면 표시를 지워 다음 부팅부터 묻지 않는다', async ({ page }) => {
  let getCount = 0;
  await page.route(API, async (route: Route) => {
    getCount++;
    await route.fulfill({ status: 401, json: { error: { code: 'PROFILE_REQUIRED', message: '프로필 세션이 필요합니다.', retryable: false }, meta: { requestId: 'req_e2e' } } });
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('ft_session', '1'));
  await page.reload();
  await expect.poll(() => getCount).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ft_session'))).toBeNull();
  await page.reload();
  await page.locator('[data-act="settings"]').waitFor();
  expect(getCount).toBe(1);
});

test('엠블럼 이미지 합계가 서버 한도를 넘으면 보내지 않고, 이 기기에만 남았다고 알린다', async ({ page }) => {
  let putCount = 0;
  await page.route(API, async (route: Route) => {
    if (route.request().method() === 'PUT') putCount++;
    await route.fulfill({ json: envelope({ clubs: {}, updatedAt: null }) });
  });
  // 64px 엠블럼 한도(16,000자)에 가까운 이미지 55개 ≈ 82만 자 > 합계 한도 80만 자.
  await page.addInitScript(() => {
    const img = `data:image/png;base64,${'A'.repeat(14_950)}`;
    const ids = ['pl', 'll', 'sa'].flatMap((l) => Array.from({ length: 20 }, (_, i) => `${l}-${i}`)).slice(0, 55);
    const clubs = Object.fromEntries(ids.map((id) => [id, { logo: { text: 'A', bg: '#123456', fg: '#ffffff', img } }]));
    localStorage.setItem('ft_clubs', JSON.stringify({ clubs, updatedAt: new Date().toISOString(), dirty: true }));
  });
  await withSessionHint(page);
  await openPl(page);
  await expect(page.locator('[data-club-sync]')).toHaveAttribute('data-club-sync', 'full');
  expect(putCount).toBe(0);
});
