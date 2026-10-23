import { test, expect } from '@playwright/test';
import { ok, API } from './helpers.js';

// T-11-463 기록실 BEST 11 탭: 4-3-3 그라운드 · 자리 선택 → 선정 이유 · 상위 10명, 잠정 표시, 다시 열어도 같은 요청은 한 번.
const SLOTS = ['GK', 'LB', 'CB1', 'CB2', 'RB', 'DM', 'CM', 'AM', 'LW', 'ST', 'RW'] as const;
const DPOS = ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'ST', 'RW'] as const;
const NAMES = [
  '한도윤',
  '서지호',
  '문태건',
  '백승우',
  '노현준',
  '차민혁',
  '윤시온',
  '강이안',
  '오재민',
  '류하람',
  '신우진',
];
const NATIONS = [
  '대한민국',
  '브라질',
  '스페인',
  '대한민국',
  '잉글랜드',
  '프랑스',
  '아르헨티나',
  '대한민국',
  '포르투갈',
  '대한민국',
  '독일',
];
const id = (k: number) => `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`;

const player = (k: number, dpos: string, name: string, index: number) => ({
  careerId: id(k),
  name,
  dpos,
  nation: NATIONS[k % NATIONS.length]!,
  look: null,
  peak: 88 + (k % 8),
  retiredAt: '2026-10-18T12:00:00.000Z',
  index,
  ind: Math.min(100, index + 6),
  team: Math.max(0, index - 14),
  award: Math.max(0, index - 30),
  facts: {
    rating: 7.62,
    apps: 512,
    leagues: 4,
    ucl: 2,
    wc: 1,
    ballon: k === 9 ? 1 : 0,
    fifpro: 3,
    posAwards: 2,
  },
});

const xi = SLOTS.map((slot, i) => ({
  slot,
  player: player(i, DPOS[i]!, NAMES[i]!, i === 9 ? 100 : 82 + (i % 5) * 3),
  since: '2026-10-18T12:00:00.000Z',
}));
const stRanking = [
  { ...xi[9]!.player, held: 'xi', at: 'ST' },
  { ...player(21, 'CF', '임건우', 91.4), held: 'owner', at: null },
  { ...player(22, 'ST', '정바울', 88.2), held: null, at: null },
  { ...player(23, 'SS', '홍지산', 79.5), held: null, at: null },
];
const BODY = {
  season: 1,
  finalAt: null,
  updatedAt: '2026-10-22T19:00:00.000Z',
  slots: xi,
  rankings: SLOTS.filter((s) => s !== 'CB2').map((slot) => ({
    slot,
    entries:
      slot === 'ST' ? stRanking : [{ ...xi[SLOTS.indexOf(slot)]!.player, held: 'xi', at: slot }],
  })),
  changes: [
    { slot: 'ST', at: '2026-10-21T09:12:00.000Z', in: '류하람', out: '정바울' },
    { slot: 'GK', at: '2026-10-20T14:40:00.000Z', in: '한도윤', out: null },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-23T03:00:00.000Z'));
  await page.route(`${API}/v1/careers/mine`, (r) => r.fulfill(ok({ linked: false, entries: [] })));
  await page.route(/\/v1\/hof\?/, (r) => r.fulfill(ok({ entries: [], total: 0 })));
});

test('BEST 11 탭: 잠정 BEST 11을 그라운드에 세우고 자리를 누르면 그 자리 순위가 나온다', async ({
  page,
}) => {
  const asked: string[] = [];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.origin === API && u.pathname === '/v1/best11') asked.push(u.search);
  });
  await page.route(/\/v1\/best11\?/, (r) => r.fulfill(ok(BODY)));
  await page.goto('/');
  await page.locator('[data-act="hof-all"]').click();
  await page.locator('[data-hof-tab="best11"]').click();
  const card = page.locator('[data-best11]');
  await expect(card.locator('[data-best11-state="provisional"]')).toBeVisible();
  await expect(card.getByText('류하람').first()).toBeVisible();
  // 기본 선택은 ST: 같은 구단주라 빠진 2위는 표시만 남는다.
  await expect(card.locator(`[data-best11-rank="${id(21)}"]`)).toContainText('같은 구단주');
  await card.locator('.b11-pitch').getByText('한도윤').click();
  await expect(card.locator('[data-best11-slot="GK"]')).toBeVisible();
  await expect(card.locator(`[data-best11-player="${id(0)}"]`)).toContainText('한도윤');

  // 다른 탭에 갔다 돌아와도 메모에서 그린다.
  await page.locator('[data-hof-tab="legends"]').click();
  await page.locator('[data-hof-tab="best11"]').click();
  await expect(card.getByText('류하람').first()).toBeVisible();
  expect(asked).toEqual(['?season=1']);
});

test('BEST 11 탭: 아직 아무도 오르지 않은 시즌은 빈 안내를 보인다', async ({ page }) => {
  await page.route(/\/v1\/best11\?/, (r) =>
    r.fulfill(
      ok({
        ...BODY,
        updatedAt: null,
        slots: SLOTS.map((slot) => ({ slot, player: null, since: null })),
        rankings: [],
        changes: [],
      }),
    ),
  );
  await page.goto('/');
  await page.locator('[data-act="hof-all"]').click();
  await page.locator('[data-hof-tab="best11"]').click();
  await expect(page.locator('[data-best11-empty]')).toBeVisible();
});
