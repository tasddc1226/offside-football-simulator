import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail, ok } from './helpers.js';

// T-11-080 이적시장 — 구단 자금 · 영입 · 내놓기 · 방출. 서버는 page.route로 흉내 낸다(금액·소유권은 서버가 정한다).

const RULES = {
  releaseRate: 1,
  feeRate: 0.05,
  priceMin: 0.5,
  priceMax: 3,
  listLimit: 20,
  dailyBuys: 10,
};
const RAISED = '00000000-0000-4000-8000-000000000021';
const BOUGHT = '00000000-0000-4000-8000-000000000022';
const LISTING = 'lst_00000000-0000-4000-8000-000000000031';

const card = {
  careerId: '00000000-0000-4000-8000-000000000041',
  pos: 'FW',
  dpos: 'ST',
  peak: 88,
  number: 9,
  publicName: '시장 골잡이',
  legendScore: 420,
  cardValue: 100_000,
  transfers: 1,
  season: 0,
  nation: null,
  attrs: null,
};
const listing = { id: LISTING, price: 120_000, createdAt: '2026-10-04T00:00:00.000Z', card };

const me = (balance: number) =>
  ok({
    season: 0,
    balance,
    clubValue: balance + 300_000,
    listings: [],
    trades: [],
    buysLeft: 10,
    rules: RULES,
  });

const player = (careerId: string, raised: boolean, over: Record<string, unknown> = {}) => ({
  careerId,
  pos: 'MF',
  dpos: 'CM',
  peak: 82,
  roles: null,
  attrs: null,
  number: 8,
  publicName: raised ? '키운 미드필더' : '영입한 미드필더',
  legendScore: 300,
  cardValue: 80_000,
  raised,
  ...(raised ? { retireValue: 250_000 } : {}),
  listing: null,
  ...over,
});

async function stub(page: Page) {
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
  // 구단주 화면 요약은 가벼운 /funds만 부른다(이적시장 화면의 /me와 따로).
  await page.route(`${API}/v1/market/funds`, (r) =>
    r.fulfill(ok({ balance: 200_000, clubValue: 500_000 })),
  );
  await page.route(`${API}/v1/careers/mine**`, (r) => r.fulfill(ok({ linked: true, entries: [] })));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) =>
      r.fulfill(
        ok({
          season: 0,
          current: 0,
          seasons: [{ id: 0, name: '프리시즌' }],
          team: null,
          players: [player(RAISED, true), player(BOUGHT, false)],
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      ),
  );
}

async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact})`)).toEqual([]);
}

test('구단주 화면에서 이적시장을 열고 선수를 영입한다(화면 왕복에 같은 API를 다시 부르지 않는다)', async ({
  page,
}) => {
  await stub(page);
  let balance = 200_000;
  const calls = { me: 0, list: 0 };
  let bought: unknown = null;
  await page.route(`${API}/v1/market/me`, (r) => {
    calls.me++;
    return r.fulfill(me(balance));
  });
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => {
      calls.list++;
      return r.fulfill(
        ok({
          season: 0,
          items: bought ? [] : [listing],
          hasMore: false,
          recent: [
            {
              id: `${LISTING.slice(0, -1)}9`,
              price: 70_000,
              soldAt: new Date().toISOString(),
              card: { ...card, publicName: '팔린 수비수', pos: 'DF', dpos: 'CB' },
            },
            {
              id: `${LISTING.slice(0, -1)}8`,
              price: 50_000,
              soldAt: '2026-10-04T00:00:00.000Z',
              card,
            },
          ],
        }),
      );
    },
  );
  // 시세 차트(T-11-080f): 날짜는 오늘(KST) 기준으로 만든다.
  const kstDay = (back: number) =>
    new Date(Date.now() + 9 * 3_600_000 - back * 86_400_000).toISOString().slice(0, 10);
  const charts: string[] = [];
  await page.route(`${API}/v1/market/chart**`, (r) => {
    const q = new URL(r.request().url()).search;
    charts.push(q);
    const day = (back: number, avg: number) => ({
      day: kstDay(back),
      trades: 3,
      volume: 300_000,
      avg,
      min: avg - 50,
      max: avg + 50,
    });
    return r.fulfill(
      ok({
        season: 0,
        points: q.includes('pos=') && q.includes('month') ? [] : [day(1, 1000), day(0, 1030)],
      }),
    );
  });
  await page.route(`${API}/v1/market/cards/${card.careerId}/trades`, (r) => {
    charts.push('trades');
    return r.fulfill(
      ok({ trades: [{ price: 110_000, ratio: 1100, soldAt: new Date().toISOString() }] }),
    );
  });
  await page.route(`${API}/v1/market/listings/${LISTING}/buy`, (r) => {
    bought = r.request().postDataJSON();
    balance -= 120_000;
    return r.fulfill(ok({ balance }));
  });

  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  // 구단 가치는 서버가 센 값(자금 + 카드 가치)
  await expect(page.locator('[data-owner-value]')).toContainText('50억');
  await expect(page.locator('[data-owner-market]')).toContainText('구단 자금 20억');
  await page.locator('[data-act="market"]').click();
  await expect(page.locator('[data-market-funds]')).toContainText('20억');
  await expect(page.locator(`[data-listing="${LISTING}"]`)).toContainText('시장 골잡이');
  await expect(page.locator(`[data-listing="${LISTING}"]`)).toContainText('기준가 +20%');
  // 시장 지수 — 마지막 거래일 평균과 그 전 거래일과의 차이(오름은 빨강).
  await expect(page.locator('[data-market-index]')).toContainText('103%');
  await expect(page.locator('[data-market-index]')).toContainText('▲ 3%p');
  // 방금 이적 — 최근 거래가 한 줄씩 넘어가고, 누르면 모두 펼친다(서버는 다시 부르지 않는다).
  await expect(page.locator('[data-market-live]')).toContainText('팔린 수비수 CB 88 · 7억에 이적');
  await expect(page.locator('[data-market-live]')).toContainText('시장 골잡이 ST 88 · 5억에 이적', {
    timeout: 6000,
  });
  await page.locator('[data-market-live] button').click();
  await expect(page.locator('.mk-live-list li')).toHaveCount(2);
  await expectNoA11yViolations(page);

  // 구단주로 돌아갔다가 다시 와도 자금·목록을 다시 묻지 않는다(메모).
  await page.locator('[data-back-bar] button').click();
  await page.locator('[data-act="market"]').click();
  await expect(page.locator(`[data-listing="${LISTING}"]`)).toBeVisible();
  expect(calls).toEqual({ me: 1, list: 1 });

  await page.locator(`[data-listing="${LISTING}"]`).click();
  await expect(page.getByRole('dialog', { name: '선수 영입' })).toContainText('영입 뒤 남는 자금');
  // 카드 상세 시세 — 같은 포지션군 · OVR대(85~89) 하루 평균 점 둘과 이 선수 거래 점 하나. 점을 누르면 그날 값.
  const chart = page.locator('[data-market-chart]');
  await expect(chart).toContainText('공격수 OVR 85~89');
  await expect(chart.locator('.mc-day')).toHaveCount(2);
  await chart.locator('[data-chart-trade]').click();
  await expect(chart.locator('.mc-pick')).toContainText('이 선수 · 110%');
  await expectNoA11yViolations(page);
  await chart.locator('[data-chart-range="month"]').click();
  await expect(chart.locator('.mc-day')).toHaveCount(0);
  await expect(chart.locator('[data-chart-trade]')).toHaveCount(1);
  // 기간을 되돌리면 메모를 쓴다(지수 1 · 묶음 1주 · 선수 거래 · 묶음 1달).
  await chart.locator('[data-chart-range="week"]').click();
  await expect(chart.locator('.mc-day')).toHaveCount(2);
  expect(charts).toEqual([
    '?range=week',
    '?range=week&pos=FW&band=85',
    'trades',
    '?range=month&pos=FW&band=85',
  ]);
  await page.locator('[data-act="buy"]').click();
  await expect(page.locator('#toast')).toHaveText('선수를 영입했어요.');
  expect(bought).toEqual({ price: 120_000 });
  await expect(page.locator('[data-market-funds]')).toContainText('8억');
  await expect(page.locator(`[data-listing="${LISTING}"]`)).toHaveCount(0);
});

test('홈 타일에서 이적시장으로 바로 가고, 이전으로 누르면 홈으로 돌아온다', async ({ page }) => {
  await stub(page);
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(200_000)));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => r.fulfill(ok({ season: 0, items: [listing], hasMore: false, recent: [] })),
  );
  await page.route(`${API}/v1/market/chart**`, (r) => r.fulfill(ok({ season: 0, points: [] })));
  await page.goto('/');
  await page.locator('[data-act="home-market"]').click();
  await expect(page.locator(`[data-listing="${LISTING}"]`)).toBeVisible();
  // 거래가 없으면 시장 지수 줄을 두지 않는다.
  await expect(page.locator('[data-market-index]')).toHaveCount(0);
  await page.locator('[data-back-bar] button').click();
  await expect(page.locator('[data-act="home-market"]')).toBeVisible();
});

test('자금이 모자라면 영입 버튼이 잠기고, 이미 팔린 선수는 목록을 새로 받는다', async ({
  page,
}) => {
  await stub(page);
  let listCalls = 0;
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(100_000)));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => {
      listCalls++;
      return r.fulfill(
        ok({
          season: 0,
          items: [listing, { ...listing, id: `${LISTING.slice(0, -1)}2`, price: 90_000 }],
          hasMore: false,
          rules: RULES,
        }),
      );
    },
  );
  await page.route(`${API}/v1/market/listings/**`, (r) =>
    r.fulfill({
      status: 409,
      json: {
        error: {
          code: 'CONFLICT',
          message: '이미 팔렸거나 내린 선수예요.',
          retryable: false,
          details: { reason: 'LISTING_GONE' },
        },
        meta: { requestId: 'req_e2e' },
      },
    }),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="market"]').click();
  await page.locator(`[data-listing="${LISTING}"]`).click();
  await expect(page.getByRole('dialog', { name: '선수 영입' })).toContainText(
    '구단 자금이 2억 모자라요',
  );
  await expect(page.locator('[data-act="buy"]')).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();

  await page.locator(`[data-listing="${LISTING.slice(0, -1)}2"]`).click();
  await page.locator('[data-act="buy"]').click();
  await expect(page.getByRole('alert')).toHaveText('이미 팔렸거나 내린 선수예요.');
  await expect.poll(() => listCalls).toBe(2);
});

test('팔기 — 이번 시즌 선수를 슬라이더로 값을 정해 내놓고, 자금 만들기에서 직접 키운 선수만 방출한다', async ({
  page,
}) => {
  await stub(page);
  let listed: unknown = null;
  let released: unknown = null;
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(0)));
  await page.route(`${API}/v1/market/listings`, (r) => {
    listed = r.request().postDataJSON();
    return r.fulfill(ok({ listing }, 201));
  });
  await page.route(`${API}/v1/cards/release`, (r) => {
    released = r.request().postDataJSON();
    return r.fulfill(ok({ released: 1, amount: 80_000, balance: 80_000 }));
  });
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => r.fulfill(fail(500, 'X', 'x')),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="market"]').click();
  await page.locator('[data-market-tab="sell"]').click();

  // 카드를 고르면 기준가 그대로가 기본값, 슬라이더로 기준가의 %를 정한다.
  await page.locator(`[data-sell-pick="${RAISED}"]`).click();
  await expect(page.locator('[data-act="list"]')).toHaveText('8억에 내놓기');
  await page.locator('[data-sell-pct]').fill('125');
  await expect(page.locator('[data-act="list"]')).toHaveText('10억에 내놓기');
  await expect(page.locator('.mk-price-box')).toContainText('팔리면 받는 자금');
  await expect(page.locator('.mk-price-box')).toContainText('9억 5천만');
  await expectNoA11yViolations(page);
  await page.locator('[data-act="list"]').click();
  await expect(page.locator('#toast')).toHaveText('시장에 내놓았어요.');
  expect(listed).toEqual({ careerId: RAISED, price: 100_000 });

  // 방출 — 영입한 선수는 고를 수 없다. 받을 자금과 되돌릴 수 없다는 안내를 보이고 확인을 받는다.
  await page.locator('[data-act="open-release"]').click();
  await expect(page.locator(`[data-mine="${BOUGHT}"] input[type="checkbox"]`)).toBeDisabled();
  await expect(page.locator(`[data-mine="${BOUGHT}"]`)).toContainText(
    '영입한 선수는 방출할 수 없어요',
  );
  await page.locator(`[data-mine="${RAISED}"] input[type="checkbox"]`).check();
  // T-11-104 방출 지급은 은퇴 가치(25억)가 아니라 카드 기준가(8억)다.
  await expect(page.locator('.mk-dock')).toContainText('+8억');
  await page.locator('[data-act="release"]').click();
  await expect(page.getByRole('dialog', { name: '선수 방출' })).toContainText(
    '다시 데려올 수 없어요',
  );
  await expect(page.getByRole('dialog', { name: '선수 방출' })).toContainText('8억');
  await expectNoA11yViolations(page);
  await page.locator('[data-act="release-confirm"]').click();
  await expect(page.locator('#toast')).toHaveText('1명을 방출했어요.');
  expect(released).toEqual({ careerIds: [RAISED] });
});
