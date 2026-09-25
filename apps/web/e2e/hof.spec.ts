import { test, expect } from '@playwright/test';

// T-10-005 공개 명예의 전당: 전체 목록(API 스텁) → 다른 유저 선수 상세 → 돌아오기, 내 선수 탭 → 상세.
const API = 'http://localhost:8787';
const ID = '3b1d6c1e-2a4f-4f7e-9a0b-7c8d9e0f1a2b';
const entry = {
  id: ID, name: null, pos: 'FW', number: 7, retireAge: 35, peak: 91, legendScore: 612, apps: 540, goals: 301, assists: 120,
  trophies: 9, awards: 5, caps: 88, ballon: 1, lastClub: '테스트 FC', retiredAt: '2026-09-24T00:00:00.000Z', hasDetail: true,
};
const snapshot = {
  number: 7, pos: 'FW', age: 35, peak: 91, lastClub: '테스트 FC',
  career: [
    { year: 2026, age: 18, club: '테스트 고교', league: '고교리그', apps: 20, goals: 15, assists: 4, cs: 0, rating: 7.4, rank: 1, ovr: 58, honors: ['고교리그 우승'] },
    { year: 2027, age: 19, club: '테스트 FC', league: 'K리그1', apps: 30, goals: 12, assists: 5, cs: 0, rating: 7.1, rank: 3, ovr: 66, honors: [], ch: ['goals'] },
  ],
  trophies: [{ year: 2026, t: '고교리그 우승', club: '테스트 고교' }],
  awards: [{ year: 2027, t: '영플레이어상' }],
  ballon: [],
  nat: { caps: 88 },
  storyLog: [],
  miles: [{ year: 2027, t: '프로 데뷔' }],
};

test('전체 명예의 전당에서 다른 유저의 은퇴 선수 상세를 연다', async ({ page }) => {
  await page.route(`${API}/v1/hof?limit=50`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { entries: [entry] } }) }));
  await page.route(`${API}/v1/hof/${ID}`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { entry, snapshot } }) }));

  await page.goto('/');
  const row = page.locator(`[data-hof-id="${ID}"]`);
  await expect(row).toContainText('익명의');
  await row.click();
  await expect(page.locator('.player h1')).toContainText('익명의');
  await expect(page.getByRole('heading', { name: '레전드 점수 구성' })).toBeVisible();
  await expect(page.locator('table')).toContainText('K리그1');
  await page.locator('[data-act="hof-back"]').click();
  await expect(page.locator(`[data-hof-id="${ID}"]`)).toBeVisible();
});

test('내 선수 탭: 상세 없는 옛 기록은 요약만 보여 준다', async ({ page }) => {
  await page.route(`${API}/v1/hof?limit=50`, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.addInitScript(() => {
    localStorage.setItem('ft_hof', JSON.stringify([{ name: '옛선수', pos: 'MF', number: 8, peak: 80, age: 34, apps: 400, goals: 60, assists: 90, trophies: 3, awards: 1, caps: 20, ballon: 0, lastClub: '옛 FC', score: 380, date: '2026-01-01' }]));
  });
  await page.goto('/');
  await expect(page.locator('.card').filter({ hasText: '명예의 전당' })).toContainText('불러오지 못했습니다');
  await page.locator('[data-hof-tab="mine"]').click();
  await page.locator('[data-hof-mine="0"]').click();
  await expect(page.locator('.player h1')).toHaveText('옛선수');
  await expect(page.getByText('요약만 보여 드립니다')).toBeVisible();
});

// T-10-013: 계정에 연결돼 있으면 '내 선수'는 계정 기록이다. 이 기기 기록이 있으면 그 이름을 쓰고,
// 다른 기기에서 은퇴한 선수는 익명 이름으로 보인다. 다른 계정의 이 기기 기록은 빠진다.
test('내 선수 탭: 계정 기록(서버) + 이 기기 이름 덮어쓰기', async ({ page }) => {
  const OTHER = '7c2e5a10-1b3d-4e5f-8a9b-0c1d2e3f4a5b';
  await page.route(`${API}/v1/hof?limit=50`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { entries: [] } }) }));
  await page.route(`${API}/v1/careers/mine`, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { linked: true, entries: [entry, { ...entry, id: OTHER, legendScore: 100, pos: 'GK', number: 1 }] } }),
    }),
  );
  await page.addInitScript((id) => {
    const base = { pos: 'FW', number: 7, peak: 91, age: 35, apps: 540, goals: 301, assists: 120, trophies: 9, awards: 5, caps: 88, ballon: 1, lastClub: '테스트 FC', score: 612, date: '2026-09-24' };
    localStorage.setItem('ft_hof', JSON.stringify([
      { ...base, id, name: '이기기선수', public: false },
      { ...base, id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a', name: '다른계정선수', score: 999 },
    ]));
  }, ID);
  await page.goto('/');
  await page.locator('[data-hof-tab="mine"]').click();
  await expect(page.locator('[data-hof-source="account"]')).toBeVisible();
  await expect(page.locator('[data-hof-mine]')).toHaveCount(2);
  await expect(page.locator('[data-hof-mine="0"]')).toContainText('이기기선수');
  await expect(page.locator('[data-hof-mine="1"]')).toContainText('익명의 골키퍼');
  await expect(page.locator('.card').filter({ hasText: '명예의 전당' })).not.toContainText('다른계정선수');
});

test('내 선수 탭: 계정에 연결되지 않았으면 이 기기 기록', async ({ page }) => {
  await page.route(`${API}/v1/hof?limit=50`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { entries: [] } }) }));
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { linked: false, entries: [] } }) }));
  await page.addInitScript(() => {
    localStorage.setItem('ft_hof', JSON.stringify([{ id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', name: '기기선수', pos: 'DF', number: 4, peak: 78, age: 33, apps: 300, goals: 10, assists: 5, trophies: 1, awards: 0, caps: 3, ballon: 0, lastClub: 'FC', score: 250, date: '2026-09-24' }]));
  });
  await page.goto('/');
  await page.locator('[data-hof-tab="mine"]').click();
  await expect(page.locator('[data-hof-source="device"]')).toContainText('구글 계정을 연결하면');
  await expect(page.locator('[data-hof-mine="0"]')).toContainText('기기선수');
});
