import { test, expect } from '@playwright/test';
import { API, ok } from './helpers.js';

// T-10-122 홈 전광판 — 이적·프로 입단·서버 최초 기록이 헤더 아래에서 흐른다.
const now = new Date().toISOString();
const ticker = {
  now,
  transfers: [
    {
      at: now,
      name: '김오프',
      pos: 'FW',
      number: null,
      age: 24,
      fromClubId: 'k1-2',
      toClubId: 'pl-3',
    },
    { at: now, name: null, pos: 'MF', number: null, age: 19, fromClubId: 'hs-0', toClubId: 'k1-1' },
  ],
  firsts: [
    {
      at: now,
      kind: 'first',
      id: 'ballon',
      label: '발롱도르 최초 수상!',
      value: null,
      unit: null,
      name: '도하람',
      pos: 'MF',
      number: 8,
    },
  ],
};

test('이적·프로 입단·서버 최초 기록이 흐르고, 같은 줄을 한 벌 더 이어 붙인다', async ({ page }) => {
  await page.route(`${API}/v1/ticker`, (r) => r.fulfill(ok(ticker)));
  await page.goto('/');
  const bar = page.locator('[data-home-ticker]');
  const copy = bar.locator('.tk-copy').first();
  await expect(copy.locator('[data-ticker-kind]')).toHaveCount(3);
  await expect(copy).toContainText('이적');
  await expect(copy).toContainText('김오프(24세)');
  await expect(copy).toContainText('프로 입단');
  await expect(copy).toContainText('익명의 미드필더');
  await expect(copy).toContainText('발롱도르 최초 수상!');
  await expect(bar.locator('.tk-copy[aria-hidden="true"]')).toHaveCount(1);
});

test('감속 모션이면 흐르지 않고 한 줄만 보인다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`${API}/v1/ticker`, (r) => r.fulfill(ok(ticker)));
  await page.goto('/');
  const bar = page.locator('[data-home-ticker]');
  await expect(bar.locator('[data-ticker-kind]')).toHaveCount(1);
  await expect(bar.locator('.tk-track')).toHaveCount(0);
});

test('불러오지 못해도 같은 높이의 자리를 지킨다(첫 화면이 밀리지 않게)', async ({ page }) => {
  await page.route(`${API}/v1/ticker`, (r) => r.fulfill({ status: 503, body: '' }));
  await page.goto('/');
  const bar = page.locator('[data-home-ticker]');
  await expect(bar).toContainText('이적 소식과 서버 최초 기록이 여기로 흘러요');
  expect((await bar.boundingBox())?.height).toBe(34);
});
