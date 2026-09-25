import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// T-10-030 홈 라이브 현황: 서버 숫자(0은 숨김) + 소식 티커(한 줄씩 올라감, 일시정지·감속 모션이면 멈춤).
const API = 'http://localhost:8787';
const ID = '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const season = (min: number, over: Record<string, unknown> = {}) => ({
  kind: 'season', at: ago(min), pos: 'FW', club: '테스트 FC', league: 'K리그1', apps: 30, goals: 12, assists: 4, cs: null, honor: null, first: false, ...over,
});
const live = {
  now: new Date().toISOString(),
  stats: { playing: 3, seasonsToday: 17, newToday: 0, retiredToday: 2 },
  feed: [
    { kind: 'retire', at: ago(0), careerId: ID, name: '김오프', pos: 'MF', number: 8, score: 540, lastClub: '테스트 FC' },
    season(4, { club: '청운고', first: true }),
    season(30, { honor: 'K리그1 우승' }),
    season(90, { pos: 'GK', cs: 11, goals: 0, assists: 0 }),
    season(60 * 30),
  ],
};
async function stub(page: Page, body: unknown = live, status = 200) {
  await page.route(`${API}/v1/live`, (r) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { data: body } : {}) }));
}
const rowsText = (page: Page) => page.locator('[data-home-live] .live-row:not([aria-hidden])').allInnerTexts();

test('숫자와 소식 티커를 보여 주고, 한 줄씩 올라가다 일시정지로 멈춘다', async ({ page }) => {
  await stub(page);
  await page.goto('/');
  const card = page.locator('[data-home-live]');
  await expect(card.getByRole('heading', { name: '지금 오프사이드에서는' })).toBeVisible();
  // 0인 숫자(오늘 새 선수)는 숨긴다.
  await expect(card.locator('[data-live-stat]')).toHaveCount(3);
  await expect(card.locator('[data-live-stat="playing"]')).toContainText('3지금 뛰는 중');
  await expect(card.locator('[data-live-stat="new"]')).toHaveCount(0);

  const first = await rowsText(page);
  expect(first).toHaveLength(3);
  expect(first[0]).toMatch(/김오프 은퇴 · 레전드 점수 540\s*방금/);
  expect(first[1]).toMatch(/익명의 공격수 청운고에서 첫 시즌을 마쳤어요\s*4분 전/);
  expect(first[2]).toMatch(/익명의 공격수 K리그1 우승 · 테스트 FC\s*30분 전/);
  // 한 줄 올라가면 둘째 줄이 맨 위로, 넷째 소식이 아래에서 들어온다.
  await expect.poll(async () => (await rowsText(page)).join('|'), { timeout: 6_000 }).toMatch(
    /^익명의 공격수 청운고.*\|.*K리그1 우승.*\|익명의 골키퍼 테스트 FC 시즌 30경기 무실점 11\s*1시간 전$/s,
  );

  await card.locator('[data-act="live-pause"]').click();
  await expect(card.locator('[data-act="live-pause"]')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(0, 0);
  const paused = await rowsText(page);
  await page.waitForTimeout(4_500);
  expect(await rowsText(page)).toEqual(paused);

  const axe = await new AxeBuilder({ page }).include('[data-home-live]').analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('은퇴 소식을 누르면 그 선수 상세가 열린다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stub(page);
  const entry = {
    id: ID, name: '김오프', pos: 'MF', number: 8, retireAge: 35, peak: 88, legendScore: 540, apps: 500, goals: 90, assists: 150,
    trophies: 4, awards: 2, caps: 40, ballon: 0, lastClub: '테스트 FC', retiredAt: ago(0), hasDetail: false,
  };
  await page.route(`${API}/v1/hof/${ID}`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { entry, snapshot: null } }) }));
  await page.goto('/');
  // 감속 모션이면 움직이지 않고 최신 3줄만, 일시정지 버튼도 없다.
  await expect(page.locator('[data-home-live] .live-row')).toHaveCount(3);
  await expect(page.locator('[data-act="live-pause"]')).toHaveCount(0);
  await page.locator('[data-home-live]').getByRole('button', { name: /김오프 은퇴/ }).click();
  await expect(page.locator('.player h1')).toHaveText('김오프');
  await page.locator('[data-act="hof-back"]').click();
  await expect(page.locator('[data-home-live]')).toBeVisible();
});

test('서버에 연결하지 못하거나 아무 활동이 없으면 카드를 숨긴다', async ({ page }) => {
  await stub(page, null, 503);
  await page.goto('/');
  await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
  await expect(page.locator('[data-home-live]')).toHaveCount(0);

  await page.unroute(`${API}/v1/live`);
  await stub(page, { now: new Date().toISOString(), stats: { playing: 0, seasonsToday: 0, newToday: 0, retiredToday: 0 }, feed: [] });
  await page.reload();
  await expect(page.locator('[data-home-news="notice"]')).toBeVisible();
  await expect(page.locator('[data-home-live]')).toHaveCount(0);
});
