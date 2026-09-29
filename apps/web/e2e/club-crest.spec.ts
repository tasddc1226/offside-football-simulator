import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ok, API } from './helpers.js';

// T-10-064: 기록에 이름으로만 남은 클럽에도 엠블럼을 붙인다 — 홈 라이브 · 명예의 전당 · 은퇴 리포트 · 리그 순위표 · 커리어/트로피 탭.
// 게임 속 클럽 이름(별칭)은 엠블럼이 붙고, 다른 유저가 바꿔 부른 이름·대표팀은 이름만 보인다.
const SAVE = readFileSync(
  new URL('../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
  'utf8',
);
const ID = '7c1d6c1e-2a4f-4f7e-9a0b-7c8d9e0f1a2b';
const entry = {
  id: ID,
  name: null,
  pos: 'FW',
  number: 9,
  retireAge: 35,
  peak: 90,
  legendScore: 700,
  apps: 500,
  goals: 280,
  assists: 90,
  trophies: 6,
  awards: 4,
  caps: 70,
  ballon: 0,
  lastClub: '런던 해머스',
  retiredAt: '2026-09-24T00:00:00.000Z',
  hasDetail: true,
};
const row = (year: number, club: string, league: string) => ({
  year,
  age: year - 2008,
  club,
  league,
  apps: 30,
  goals: 10,
  assists: 3,
  cs: 0,
  rating: 7,
  rank: 2,
  ovr: 80,
  honors: [],
});
const snapshot = {
  number: 9,
  pos: 'FW',
  age: 35,
  peak: 90,
  lastClub: '런던 해머스',
  career: [
    row(2030, '포항 스틸웨이브', 'K리그1'),
    row(2032, '웨스트햄', '프리미어리그'),
    row(2034, '런던 해머스', '프리미어리그'),
  ],
  trophies: [
    { year: 2030, t: 'K리그1 우승', club: '포항 스틸웨이브' },
    { year: 2031, t: '아시안컵 우승', club: '대한민국' },
  ],
  awards: [],
  ballon: [],
  nat: { caps: 70 },
  storyLog: [],
  miles: [],
};
const live = {
  now: new Date().toISOString(),
  stats: { playing: 1, seasonsToday: 2, newToday: 0, retiredToday: 1 },
  feed: [
    {
      kind: 'retire',
      at: new Date().toISOString(),
      careerId: ID,
      name: null,
      pos: 'FW',
      number: 9,
      score: 700,
      lastClub: '런던 해머스',
    },
    {
      kind: 'season',
      at: new Date().toISOString(),
      pos: 'FW',
      club: '포항 스틸웨이브',
      league: 'K리그1',
      apps: 30,
      goals: 12,
      assists: 4,
      cs: null,
      honor: null,
      first: false,
    },
  ],
};
async function stub(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`${API}/v1/live`, (r) => r.fulfill(ok(live)));
  await page.route(/\/v1\/hof\?/, (r) => r.fulfill(ok({ entries: [entry] })));
  await page.route(`${API}/v1/hof/${ID}`, (r) => r.fulfill(ok({ entry, snapshot })));
}

test('홈 라이브 · 명예의 전당 · 은퇴 리포트에 클럽 엠블럼이 붙는다', async ({ page }) => {
  await stub(page);
  await page.goto('/');
  await expect(page.locator('[data-home-live] .live-row svg.crest').first()).toBeVisible();
  const hof = page.locator(`[data-hof-id="${ID}"]`);
  await expect(hof.locator('svg.crest')).toHaveCount(1);
  await hof.click();
  // 챕터 셋 중 '웨스트햄'은 이 기기에서 모르는 이름이라 엠블럼 없이 이름만.
  await expect(page.locator('.ch-club')).toHaveCount(3);
  await expect(page.locator('.ch-club svg.crest')).toHaveCount(2);
  await expect(page.locator('.ch-club').nth(1)).toHaveText('웨스트햄');
  await expect(page.locator('.film-finale svg.crest')).toHaveCount(1);
});

test('리그 순위표 · 커리어 · 트로피 탭에 클럽 엠블럼이 붙는다(상무 포함, 대표팀 제외)', async ({
  page,
}) => {
  // 전반기를 치른 시점으로 바꿔 순위표가 채워지게 한다.
  const save = JSON.parse(SAVE);
  save.season = { ...save.season, played: 19, w: 12, d: 4, l: 3, pts: 40 };
  await page.addInitScript((save) => localStorage.setItem('ft_save', save), JSON.stringify(save));
  await page.goto('/');
  await page.locator('[data-act="continue"]').click();
  // 시즌 화면 리그 순위표: 모든 줄에 엠블럼.
  await page.locator('[data-tab="season"]').click();
  await page.locator('[data-act="table-toggle"]').click();
  const teams = page.locator('[data-league-table] tbody tr:not(.lt-gap)');
  await expect(teams.locator('svg.crest')).toHaveCount(await teams.count());
  await page.locator('[data-tab="career"]').click();
  const cells = page.locator('tbody tr td:nth-child(2)');
  const n = await cells.count();
  expect(n).toBeGreaterThan(3);
  await expect(page.locator('tbody tr td:nth-child(2) svg.crest')).toHaveCount(n);
  await page.locator('[data-tab="trophy"]').click();
  await expect(page.locator('.trophy svg.crest').first()).toBeVisible();
});
