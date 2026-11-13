import { test, expect } from '@playwright/test';
import { API, fail, ok } from './helpers.js';

// T-11-723 기록실 '데일리' 탭(오늘의 랭킹). 서버는 page.route로 흉내 낸다.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-20T03:00:00.000Z'));
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.route(/\/v1\/hof\?/, (r) => r.fulfill(ok({ entries: [], total: 0 })));
});

const entry = (id: string, score: number, over: Record<string, unknown> = {}) => ({
  id,
  name: null,
  pos: 'FW',
  dpos: 'ST',
  number: 9,
  retireAge: 36,
  peak: 98,
  legendScore: score,
  apps: 610,
  goals: 420,
  assists: 150,
  trophies: 14,
  awards: 9,
  caps: 101,
  ballon: 2,
  lastClub: '테스트 FC',
  retiredAt: '2026-11-20T01:00:00.000Z',
  hasDetail: true,
  ...over,
});
const A = '3b1d6c1e-2a4f-4f7e-9a0b-7c8d9e0f1a2b';
const B = '4c2e7d2f-3b5a-4a8f-8b1c-8d9e0f1a2b3c';
const C = '5d3f8e3a-4c6b-4b9a-9c2d-9e0f1a2b3c4d';
const daily = (over: Record<string, unknown> = {}) =>
  ok({
    day: '2026-11-20',
    resetAt: '2026-11-20T15:00:00.000Z',
    entries: [
      entry(A, 1840, {
        name: '김데일리',
        raiser: { nickname: '구단주A', teamId: null, teamName: null },
      }),
      entry(B, 1711),
    ],
    yesterday: {
      day: '2026-11-19',
      winners: [
        { rank: 1, entry: entry(C, 1902, { name: '어제일등' }) },
        { rank: 2, entry: entry(B, 1711) },
      ],
    },
    ...over,
  });
const SHOT = process.env.DAILY_SHOT_DIR;

test('오늘 순위와 어제 1 · 2 · 3위를 보이고, 탭을 다시 열어도 한 번만 받는다', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.origin === API) asked.push(u.pathname + u.search);
  });
  await page.route(`${API}/v1/hof/daily`, (r) => r.fulfill(daily()));

  await page.goto('/');
  await page.locator('[data-act="hof"]').click();
  // 탭을 열기 전에는 부르지 않는다.
  expect(asked.filter((a) => a === '/v1/hof/daily')).toEqual([]);
  await page.locator('[data-hof-tab="daily"]').click();
  const card = page.locator('[data-daily-rank]');
  await expect(card.locator('h2')).toHaveText('오늘의 랭킹');
  await expect(card.locator('[data-daily-reward]')).toContainText(
    '1위는 프리미엄 스카우트권 1장과 리롤권 1장, 2 · 3위는 리롤권 1장을 받아요.',
  );
  await expect(card.locator('[data-daily-count]')).toHaveText('오늘 2명');
  await expect(card.locator('[data-daily-reset]')).toHaveText(
    '11월 21일 0시(한국 시각)에 순위가 정해져요.',
  );
  const rows = card.locator('[data-daily-list] [data-hof-id]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('김데일리');
  await expect(rows.nth(0)).toContainText('1,840');
  await expect(rows.nth(0)).toContainText('구단주A');
  const yesterday = card.locator('[data-daily-yesterday]');
  await expect(yesterday.locator('h3')).toHaveText('어제 1 · 2 · 3위');
  await expect(yesterday.locator('[data-hof-id]')).toHaveCount(2);
  await expect(yesterday.locator('[data-hof-id]').nth(0)).toContainText('어제일등');
  if (SHOT) {
    await page.setViewportSize({ width: 360, height: 1100 });
    await page.screenshot({ path: `${SHOT}/web-daily.png` });
    await page.setViewportSize({ width: 360, height: 780 });
  }

  // 다른 탭을 다녀와도 다시 받지 않는다(1분 메모).
  await page.locator('[data-hof-tab="rn"]').click();
  await page.locator('[data-hof-tab="daily"]').click();
  await expect(rows).toHaveCount(2);
  expect(asked.filter((a) => a === '/v1/hof/daily')).toHaveLength(1);
});

test('오른 선수가 없는 날은 빈 상태를 보인다', async ({ page }) => {
  await page.route(`${API}/v1/hof/daily`, (r) =>
    r.fulfill(daily({ entries: [], yesterday: null })),
  );
  await page.goto('/');
  await page.locator('[data-act="hof"]').click();
  await page.locator('[data-hof-tab="daily"]').click();
  const card = page.locator('[data-daily-rank]');
  await expect(card.locator('[data-daily-empty]')).toHaveText('오늘은 아직 오른 선수가 없어요.');
  await expect(card.locator('[data-daily-count]')).toHaveText('오늘 0명');
  await expect(card.locator('[data-daily-yesterday]')).toHaveCount(0);
});

test('순위를 매기기 전 날짜에는 언제부터 시작하는지 알린다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T13:00:00.000Z'));
  await page.route(`${API}/v1/hof/daily`, (r) =>
    r.fulfill(
      daily({
        day: '2026-11-13',
        resetAt: '2026-11-13T15:00:00.000Z',
        entries: [],
        yesterday: null,
      }),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="hof"]').click();
  await page.locator('[data-hof-tab="daily"]').click();
  const card = page.locator('[data-daily-rank]');
  await expect(card.locator('[data-daily-opens]')).toHaveText(
    '11월 14일 0시(한국 시각)부터 은퇴한 선수로 순위를 매겨요.',
  );
  await expect(card.locator('[data-daily-count]')).toHaveCount(0);
  await expect(card.locator('[data-daily-empty]')).toHaveCount(0);
});

test('불러오지 못하면 다시 시도할 수 있다', async ({ page }) => {
  let n = 0;
  await page.route(`${API}/v1/hof/daily`, (r) =>
    r.fulfill(n++ === 0 ? fail(503, 'SERVICE_UNAVAILABLE', 'x') : daily()),
  );
  await page.goto('/');
  await page.locator('[data-act="hof"]').click();
  await page.locator('[data-hof-tab="daily"]').click();
  const card = page.locator('[data-daily-rank]');
  await expect(card).toContainText('오늘의 랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  await card.getByRole('button', { name: '다시 시도' }).click();
  await expect(card.locator('[data-daily-list] [data-hof-id]')).toHaveCount(2);
});

test('오늘의 랭킹 1위를 한 선수 카드에는 순위 표식이 붙는다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T00:00:00.000Z'));
  const STRIKER = '00000000-0000-4000-8000-000000000011';
  const slots = ['GK', 'FB', 'CB', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST', 'W'];
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'u1',
        linked: { google: true, toss: false },
        googleEmailMasked: 'te***@gmail.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        nickname: '구단주',
      }),
    ),
  );
  await page.route(`${API}/v1/boards/viewer`, (r) =>
    r.fulfill(ok({ admin: false, google: true, nickname: '구단주' })),
  );
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) =>
      r.fulfill(
        ok({
          season: 0,
          current: 0,
          seasons: [{ id: 0, name: '프리시즌' }],
          team: {
            id: 'tem_00000000-0000-4000-8000-000000000001',
            season: 0,
            name: '우리 동네 FC',
            manager: '홍감독',
            formation: '4-3-3',
            layout: null,
            logo: null,
            slots: slots.map((slot, i) => ({
              slot,
              careerId: i === 9 ? STRIKER : null,
              name: i === 9 ? '선수' : '유스 선수',
              pos: i === 9 ? 'FW' : null,
              rating: i === 9 ? 90 : 50,
              fit: 1,
            })),
            ovr: 56,
            lines: { atk: 60, mid: 52, def: 48, gk: 50 },
            rating: 1000,
            record: { w: 0, d: 0, l: 0 },
            likes: 0,
            views: 0,
            createdAt: '2026-09-29T00:00:00.000Z',
            updatedAt: '2026-09-29T00:00:00.000Z',
          },
          players: [
            {
              careerId: STRIKER,
              pos: 'FW',
              dpos: 'ST',
              peak: 90,
              roles: { GK: 25, CB: 50, FB: 62, DM: 60, CM: 70, AM: 82, W: 84, ST: 90 },
              attrs: { pac: 88, sho: 91, pas: 70, dri: 84, def: 35, phy: 78 },
              number: 9,
              publicName: '공개 골잡이',
              legendScore: 500,
              cardValue: 543_000,
              daily: 1,
            },
          ],
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      ),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();
  const mark = page.locator('[data-card-special="daily"]').first();
  await expect(mark).toHaveText('데일리 1위');
  await expect(mark).toHaveAttribute('aria-label', '오늘의 랭킹 1위 카드');
  if (SHOT) await page.screenshot({ path: `${SHOT}/web-daily-card.png` });
});
