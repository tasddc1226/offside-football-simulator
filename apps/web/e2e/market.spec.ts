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
  nation: null,
  peak: 88,
  number: 9,
  publicName: '시장 골잡이',
  legendScore: 420,
  attrs: null,
  cardValue: 100_000,
  transfers: 1,
  season: 0,
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
        ok({ season: 0, items: bought ? [] : [listing], hasMore: false, rules: RULES }),
      );
    },
  );
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
  await expect(page.locator(`[data-listing="${LISTING}"]`)).toContainText('기준가 120%');
  await expectNoA11yViolations(page);

  // 구단주로 돌아갔다가 다시 와도 자금·목록을 다시 묻지 않는다(메모).
  await page.locator('[data-back-bar] button').click();
  await page.locator('[data-act="market"]').click();
  await expect(page.locator(`[data-listing="${LISTING}"]`)).toBeVisible();
  expect(calls).toEqual({ me: 1, list: 1 });

  await page.locator(`[data-listing="${LISTING}"]`).click();
  await expect(page.getByRole('dialog', { name: '선수 영입' })).toContainText('영입 뒤 자금');
  await page.locator('[data-act="buy"]').click();
  await expect(page.getByRole('status')).toHaveText('선수를 영입했어요.');
  expect(bought).toEqual({ price: 120_000 });
  await expect(page.locator('[data-market-funds]')).toContainText('8억');
  await expect(page.locator(`[data-listing="${LISTING}"]`)).toHaveCount(0);
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

test('내 선수 — 이번 시즌 선수를 내놓고, 직접 키운 선수만 골라 방출한다', async ({ page }) => {
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
    return r.fulfill(ok({ released: 1, amount: 250_000, balance: 250_000 }));
  });
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => r.fulfill(fail(500, 'X', 'x')),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="market"]').click();
  await page.locator('[data-market-tab="mine"]').click();

  // 영입한 선수는 방출할 수 없다(고르는 칸이 없다).
  await expect(page.locator(`[data-mine="${BOUGHT}"] input[type="checkbox"]`)).toHaveCount(0);
  await expect(page.locator(`[data-mine="${BOUGHT}"]`)).toContainText('영입');

  // 내놓기 — 기본값은 기준가, 범위를 벗어나면 막는다.
  await page.locator(`[data-mine="${RAISED}"] [data-act="sell"]`).click();
  const sell = page.getByRole('dialog', { name: '선수 내놓기' });
  await expect(page.locator('[data-sell-price]')).toHaveValue('8');
  await page.locator('[data-sell-price]').fill('30');
  await expect(sell).toContainText('24억까지 정할 수 있어요.');
  await expect(page.locator('[data-act="list"]')).toBeDisabled();
  await page.locator('[data-sell-price]').fill('10');
  await expect(sell).toContainText('팔리면 받는 돈');
  await expect(sell).toContainText('9억 5천만');
  await page.locator('[data-act="list"]').click();
  await expect(page.getByRole('status')).toHaveText('시장에 내놓았어요.');
  expect(listed).toEqual({ careerId: RAISED, price: 100_000 });

  // 방출 — 받을 자금과 되돌릴 수 없다는 안내를 보이고 확인을 받는다.
  await page.locator(`[data-mine="${RAISED}"] input[type="checkbox"]`).check();
  await page.locator('[data-act="release"]').click();
  await expect(page.getByRole('dialog', { name: '선수 방출' })).toContainText(
    '다시 데려올 수 없어요',
  );
  await expect(page.getByRole('dialog', { name: '선수 방출' })).toContainText('25억');
  await expectNoA11yViolations(page);
  await page.locator('[data-act="release-confirm"]').click();
  await expect(page.getByRole('status')).toHaveText('1명을 방출했어요.');
  expect(released).toEqual({ careerIds: [RAISED] });
});
