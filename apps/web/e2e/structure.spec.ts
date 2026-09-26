import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { API, ok } from './helpers.js';

// T-10-044: UI 구조 기준선 — 리팩터링(화면 분할·공용 컴포넌트 추출·내비게이션 정리)의 안전망.
// 고정 세이브를 넣고 주요 화면의 접근성 트리를 스냅샷(structure.spec.ts-snapshots/*.aria.yml)으로 고정한다.
// 스크린샷과 달리 OS·폰트와 무관해 CI(ubuntu)와 로컬(macOS)에서 같다. 화면을 의도해서 바꿨다면
// `pnpm e2e structure.spec.ts --update-snapshots`로 갱신하고 diff를 리뷰한다.
//
// 세이브(fixtures/save-fw26.json)는 시드 20260926 공격수를 8시즌 돌린 GameState다(26세·프리미어리그).
// 게임 로직이 바뀌어도 이 데이터는 그대로라 밸런스 변경이 스냅샷을 흔들지 않는다.
const SAVE = readFileSync(new URL('./fixtures/save-fw26.json', import.meta.url), 'utf8');
const NOW = new Date('2026-09-26T12:00:00.000Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const profile = {
  id: 'u1',
  linked: { google: false, toss: false },
  googleEmailMasked: null,
  recoveryCodeIssuedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  nickname: null,
};
const live = {
  now: NOW.toISOString(),
  stats: { playing: 3, seasonsToday: 17, newToday: 5, retiredToday: 2 },
  feed: [
    {
      kind: 'retire',
      at: ago(2),
      careerId: '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      name: '김오프',
      pos: 'MF',
      number: 8,
      score: 540,
      lastClub: '테스트 FC',
    },
    {
      kind: 'season',
      at: ago(9),
      pos: 'FW',
      club: '청운고',
      league: '고교리그',
      apps: 20,
      goals: 12,
      assists: 4,
      cs: null,
      honor: null,
      first: true,
    },
    {
      kind: 'season',
      at: ago(30),
      pos: 'GK',
      club: '테스트 FC',
      league: 'K리그1',
      apps: 30,
      goals: 0,
      assists: 0,
      cs: 11,
      honor: 'K리그1 우승',
      first: false,
    },
  ],
};

/** 시계·API·세이브를 고정한다. 목록 API(명예의 전당·게시판 등)는 503으로 막아 오류 상태 마크업도 기준선에 넣는다.
 * 보낸 API 요청(메서드·경로·쿼리)을 순서대로 모아 돌려준다. */
async function setup(page: Page, pending: unknown = null): Promise<string[]> {
  const requests: string[] = [];
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(`${API}/**`, (r) => {
    const url = new URL(r.request().url());
    const path = url.pathname;
    requests.push(`${r.request().method()} ${path}${url.search}`);
    const data = path === '/v1/profile' ? profile : path === '/v1/live' ? live : null;
    return r.fulfill(data ? ok(data) : { status: 503, body: '' });
  });
  await page.addInitScript(
    ([save, pending]) => {
      if (sessionStorage.getItem('__structure_seeded')) return;
      sessionStorage.setItem('__structure_seeded', '1');
      localStorage.clear();
      localStorage.setItem('ft_save', JSON.stringify({ ...JSON.parse(save), pending }));
    },
    [SAVE, pending] as const,
  );
  await page.goto('/');
  return requests;
}

/** 백엔드 보호: 홈 첫 화면이 보내는 요청 목록. 리팩터링으로 중복 요청이 생기거나 늘면 여기서 잡힌다. */
const HOME_REQUESTS = [
  'GET /v1/balance',
  'GET /v1/boards/notice/posts',
  'GET /v1/boards/release/posts',
  'GET /v1/firsts',
  'GET /v1/hof?limit=3',
  'GET /v1/live',
];

async function continueGame(page: Page) {
  await page.locator('[data-act="continue"]').click();
  await expect(page.locator('.player h1')).toBeVisible();
}

test('홈', async ({ page }) => {
  const requests = await setup(page);
  await expect(page.locator('[data-home-live] [data-live-stat]')).toHaveCount(4);
  await expect(page.locator('#app')).toMatchAriaSnapshot({ name: 'home.aria.yml' });
  await page.waitForLoadState('networkidle');
  expect(requests.toSorted()).toEqual(HOME_REQUESTS);
});

test('게임 탭 4개', async ({ page }) => {
  const requests = await setup(page);
  await continueGame(page);
  for (const tab of ['season', 'player', 'career', 'trophy']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await expect(page.locator(`[data-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#app')).toMatchAriaSnapshot({ name: `game-${tab}.aria.yml` });
  }
  await page.waitForLoadState('networkidle');
  // 게임 화면·탭 전환은 새 요청을 보내지 않는다.
  expect(requests.toSorted()).toEqual(HOME_REQUESTS);
});

test('이벤트 시트', async ({ page }) => {
  await setup(page, { type: 'event', id: 'interview', then: null });
  await continueGame(page);
  await expect(page.locator('#sheet .choice').first()).toBeVisible();
  await expect(page.locator('#sheet')).toMatchAriaSnapshot({ name: 'sheet-event.aria.yml' });
});

test('이적 시장 시트', async ({ page }) => {
  await setup(page, { type: 'market', res: null, m: null });
  await continueGame(page);
  await expect(page.locator('#sheet').getByRole('button', { name: '은퇴하기' })).toBeVisible();
  await expect(page.locator('#sheet')).toMatchAriaSnapshot({ name: 'sheet-market.aria.yml' });
});

test('설정', async ({ page }) => {
  await setup(page);
  await page.locator('[data-act="settings"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('#app')).toMatchAriaSnapshot({ name: 'settings.aria.yml' });
});
