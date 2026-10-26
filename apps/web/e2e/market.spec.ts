import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, fail, ok } from './helpers.js';

// T-11-080 이적시장 — 구단 자금 · 영입 · 내놓기 · 방출. 서버는 page.route로 흉내 낸다(금액·소유권은 서버가 정한다).

const RULES = {
  releaseRate: 1,
  feeRate: 0.05,
  priceMin: 0.5,
  priceMax: 3,
};
const RAISED = '00000000-0000-4000-8000-000000000021';
const BOUGHT = '00000000-0000-4000-8000-000000000022';
const LISTING = 'lst_00000000-0000-4000-8000-000000000031';

const card = {
  careerId: '00000000-0000-4000-8000-000000000041',
  pos: 'FW',
  dpos: 'ST',
  peak: 88,
  look: 's5h6y2g2',
  number: 9,
  publicName: '시장 골잡이',
  legendScore: 420,
  cardValue: 100_000,
  transfers: 1,
  season: 0,
  nation: null,
  attrs: null,
  height: 183,
  weight: 76,
  foot: '왼발',
  type: 'speed',
};
const listing = { id: LISTING, price: 120_000, createdAt: '2026-10-04T00:00:00.000Z', card };

const me = (balance: number) =>
  ok({
    season: 0,
    balance,
    clubValue: balance + 300_000,
    listings: [],
    trades: [],
    spends: [],
    boughtToday: 0,
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
  // T-11-356 매물 줄에 선수 유형을 띠로 보인다(목록 응답에 실린 값 — 카드마다 따로 묻지 않는다).
  await expect(page.locator(`[data-listing="${LISTING}"] .mk-style`)).toHaveText('스피드스터');
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
  await page.goBack();
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

test('홈 타일에서 이적시장으로 바로 가고, 뒤로 가면 홈으로 돌아온다', async ({ page }) => {
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
  await page.goBack();
  await expect(page.locator('[data-act="home-market"]')).toBeVisible();
});

test('T-11-477 매물 줄 아래에 카드 능력치 6개를 보이고, 능력치가 없는 옛 카드는 줄을 두지 않는다', async ({
  page,
}) => {
  await stub(page);
  const old = { ...listing, id: `${LISTING.slice(0, -1)}7`, card: { ...card, careerId: 'old' } };
  const withAttrs = {
    ...listing,
    card: { ...card, attrs: { pac: 93, sho: 89, pas: 74, dri: 86, def: 38, phy: 71 } },
  };
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(200_000)));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => r.fulfill(ok({ season: 0, items: [withAttrs, old], hasMore: false, recent: [] })),
  );
  await page.route(`${API}/v1/market/chart**`, (r) => r.fulfill(ok({ season: 0, points: [] })));
  await page.goto('/');
  await page.locator('[data-act="home-market"]').click();
  const strip = page.locator(`[data-listing="${LISTING}"] [data-listing-attrs]`);
  await expect(strip).toContainText('스피드93');
  await expect(strip.locator('.mk-attr')).toHaveCount(6);
  await expect(strip.locator('.mk-attr-hi')).toHaveText('93');
  await expect(page.locator(`[data-listing="${old.id}"] [data-listing-attrs]`)).toHaveCount(0);
  await expectNoA11yViolations(page);
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
  // T-11-211 카드 체격 줄 끝에 주발.
  await expect(page.locator('[data-card-body]')).toHaveText('183cm · 76kg · 왼발');
  // T-11-270 초상은 24×21칸 캔버스(× 10px).
  await expect(page.getByRole('dialog').locator('canvas.avatar')).toHaveAttribute('height', '210');
  // 꾸미기 코드의 머리 모양이 PNG 초상에 들어간다(T-11-243 도트 그림 제거).
  await expect(page.getByRole('dialog').locator('canvas.image-avatar')).toHaveAttribute(
    'data-hair',
    'long',
  );
  await expect(
    page.getByRole('dialog').locator('canvas.image-avatar[data-ready="true"]'),
  ).toBeVisible();
  await expect(page.locator('[data-act="buy"]')).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();

  await page.locator(`[data-listing="${LISTING.slice(0, -1)}2"]`).click();
  await page.locator('[data-act="buy"]').click();
  // T-11-434 팔렸거나 내린 매물이면 시트를 닫고 토스트로 알린다.
  await expect(page.locator('#toast')).toHaveText('이미 팔렸거나 내려간 선수예요.');
  await expect(page.getByRole('dialog', { name: '선수 영입' })).toHaveCount(0);
  await expect.poll(() => listCalls).toBe(2);
});

test('가격이 바뀐 매물은 영입 시트를 새 가격으로 바꾸고 새 가격으로만 다시 보낸다(T-11-434)', async ({
  page,
}) => {
  await stub(page);
  let price = 120_000;
  const sent: number[] = [];
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(1_000_000)));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) =>
      r.fulfill(ok({ season: 0, items: [{ ...listing, price }], hasMore: false, rules: RULES })),
  );
  await page.route(`${API}/v1/market/listings/**`, (r) => {
    const body = r.request().postDataJSON() as { price: number };
    sent.push(body.price);
    // 화면이 시트를 연 뒤 판매자가 가격을 올렸다.
    if (body.price !== 150_000) {
      price = 150_000;
      return r.fulfill({
        status: 409,
        json: {
          error: {
            code: 'CONFLICT',
            message: '판매가가 바뀌었어요. 다시 확인해 주세요.',
            retryable: false,
            details: { reason: 'PRICE_CHANGED' },
          },
          meta: { requestId: 'req_e2e' },
        },
      });
    }
    return r.fulfill(ok({ balance: 850_000 }));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="market"]').click();
  await page.locator(`[data-listing="${LISTING}"]`).click();
  const sheet = page.getByRole('dialog', { name: '선수 영입' });
  await expect(page.locator('[data-act="buy"]')).toHaveText('12억에 영입하기');
  await page.locator('[data-act="buy"]').click();

  await expect(sheet.getByRole('alert')).toHaveText(
    '가격이 15억으로 바뀌었어요. 다시 확인해 주세요.',
  );
  await expect(page.locator('[data-act="buy"]')).toHaveText('15억에 영입하기');
  await expect(sheet).toContainText('85억');
  await page.locator('[data-act="buy"]').click();
  await expect(page.locator('#toast')).toHaveText('선수를 영입했어요.');
  expect(sent).toEqual([120_000, 150_000]);
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

test('T-11-188 라커룸에서 선수를 잠그면 팔기 · 방출에서 막히고, 그 자리에서 풀 수 있다', async ({
  page,
}) => {
  await stub(page);
  const LISTED = '00000000-0000-4000-8000-000000000023';
  let players = [
    player(RAISED, true),
    player(BOUGHT, false),
    player(LISTED, true, {
      publicName: '판매 중 미드필더',
      listing: { id: LISTING, price: 90_000 },
    }),
  ];
  const locks: unknown[] = [];
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(0)));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => r.fulfill(fail(500, 'X', 'x')),
  );
  await page.route(`${API}/v1/cards/lock`, (r) => {
    const body = r.request().postDataJSON() as { careerId: string; locked: boolean };
    locks.push(body);
    players = players.map((p) =>
      p.careerId === body.careerId ? { ...p, locked: body.locked } : p,
    );
    return r.fulfill(ok({ locked: body.locked }));
  });
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) =>
      r.fulfill(
        ok({
          season: 0,
          current: 0,
          seasons: [{ id: 0, name: '프리시즌' }],
          team: null,
          players,
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      ),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="team"]').click();

  // 라커룸: 키운 선수 · 영입한 선수를 잠근다. 판매 중인 선수는 내린 뒤에 잠근다.
  const locker = page.locator('[data-team-locker]');
  await locker.getByLabel('선발 선수 포함').check();
  const lockBtn = (id: string) => locker.locator(`[data-locker-player="${id}"] [data-act="lock"]`);
  await expect(lockBtn(LISTED)).toBeDisabled();
  await expect(lockBtn(LISTED)).toHaveText('판매 중');
  await lockBtn(RAISED).click();
  await expect(page.locator('#toast')).toHaveText(
    '선수를 잠갔어요. 이적시장에 내놓거나 방출할 수 없어요.',
  );
  await expect(lockBtn(RAISED)).toHaveAttribute('aria-pressed', 'true');
  await expect(locker.locator(`[data-locker-player="${RAISED}"] [data-card-locked]`)).toBeVisible();
  await lockBtn(BOUGHT).click();
  await expect(lockBtn(BOUGHT)).toHaveText('잠김');
  expect(locks).toEqual([
    { careerId: RAISED, locked: true },
    { careerId: BOUGHT, locked: true },
  ]);

  // 팔기: 잠긴 선수는 고를 수 없고 '잠금 풀기'로 바로 푼다.
  await page.locator('[data-act="team-back"]').click();
  await page.locator('[data-act="market"]').click();
  await page.locator('[data-market-tab="sell"]').click();
  await expect(page.locator(`[data-sell-pick="${RAISED}"]`)).toBeDisabled();
  await expect(page.locator(`[data-sell-pick="${RAISED}"]`)).toContainText('잠김');
  await expectNoA11yViolations(page);
  await page.locator(`[data-unlock="${BOUGHT}"]`).click();
  await expect(page.locator('#toast')).toHaveText('잠금을 풀었어요.');
  await expect(page.locator(`[data-sell-pick="${BOUGHT}"]`)).toBeEnabled();

  // 방출: 잠긴 선수는 체크할 수 없고, 같은 줄에서 푼 뒤 고른다.
  await page.locator('[data-act="open-release"]').click();
  const row = page.locator(`[data-mine="${RAISED}"]`);
  await expect(row.locator('input[type="checkbox"]')).toBeDisabled();
  await expect(row).toContainText('잠긴 선수예요');
  await page.locator(`[data-unlock="${RAISED}"]`).click();
  await expect(row.locator('input[type="checkbox"]')).toBeEnabled();
  expect(locks.at(-1)).toEqual({ careerId: RAISED, locked: false });
});

test('T-11-442 로그인 전에는 팔기 · 내 거래 · 방출이 오류 대신 로그인 안내를 보이고 내 선수를 묻지 않는다', async ({
  page,
}) => {
  let teamCalls = 0;
  await page.route(`${API}/v1/market/me`, (r) =>
    r.fulfill(fail(401, 'PROFILE_REQUIRED', '프로필 세션이 필요합니다.')),
  );
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => r.fulfill(ok({ season: 0, items: [listing], hasMore: false, recent: [] })),
  );
  await page.route(`${API}/v1/market/chart**`, (r) => r.fulfill(ok({ season: 0, points: [] })));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) => (teamCalls++, r.fulfill(fail(401, 'PROFILE_REQUIRED', 'x'))),
  );
  await page.goto('/');
  await page.locator('[data-act="home-market"]').click();
  await expect(page.locator('[data-market-guest-note]')).toHaveText(
    '로그인하면 구단주가 되어 구단 자금으로 선수를 사고팔 수 있어요.',
  );
  await page.locator('[data-market-tab="sell"]').click();
  await expect(page.locator('[data-market-guest="sell"]')).toContainText(
    '로그인하면 직접 키운 선수를 이적시장에 내놓을 수 있어요.',
  );
  await expect(
    page.locator('[data-market-guest="sell"] [data-act="market-guest-login"]'),
  ).toBeVisible();
  await expect(page.getByText('내 선수를 불러오지 못했어요.')).toHaveCount(0);
  await page.locator('[data-market-tab="trades"]').click();
  await expect(page.locator('[data-market-guest="trades"]')).toContainText('로그인하면');
  await page.locator('[data-act="open-release"]').click();
  await expect(page.locator('[data-act="open-release"]')).toHaveText('방출해서 자금 만들기');
  await expect(page.locator('[data-market-guest="release"]')).toContainText('로그인하면');
  await expectNoA11yViolations(page);
  expect(teamCalls).toBe(0);
});

test('T-11-442 방출 전체 선택은 한 번에 50명까지만 고르고, 팔기 가격 칸은 고르면 화면에 들어온다', async ({
  page,
}) => {
  await stub(page);
  const many = Array.from({ length: 53 }, (_, i) =>
    player(`00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`, true, {
      publicName: `키운 선수 ${i}`,
    }),
  );
  let released: { careerIds: string[] } | null = null;
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(0)));
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => r.fulfill(fail(500, 'X', 'x')),
  );
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/owner-team',
    (r) =>
      r.fulfill(
        ok({
          season: 0,
          current: 0,
          seasons: [{ id: 0, name: '프리시즌' }],
          team: null,
          players: many,
          lastManager: null,
          matchesLeft: 10,
          matchesPerDay: 10,
        }),
      ),
  );
  await page.route(`${API}/v1/cards/release`, (r) => {
    released = r.request().postDataJSON();
    return r.fulfill(ok({ released: 50, amount: 4_000_000, balance: 4_000_000 }));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="market"]').click();

  // 팔기: 아래쪽 카드를 고르면 가격 칸이 화면 안으로 내려온다.
  await page.locator('[data-market-tab="sell"]').click();
  await page.locator(`[data-sell-pick="${many[52]!.careerId}"]`).click();
  await expect(page.locator('.mk-price-box')).toBeInViewport();
  await expect(page.locator('[data-act="list"]')).toBeInViewport();

  await page.locator('[data-act="open-release"]').click();
  const pickAll = page.locator('[data-act="pick-all"]');
  await expect(pickAll).toHaveText('최대 50명 선택');
  await pickAll.click();
  await expect(page.locator('.mk-rel-list input:checked')).toHaveCount(50);
  await expect(pickAll).toHaveText('선택 해제');
  await expect(page.locator('.mk-dock')).toContainText('50명 방출');
  // 51번째는 넣지 않고 알린다.
  await page.locator(`[data-mine="${many[52]!.careerId}"] input[type="checkbox"]`).click();
  await expect(page.locator('#toast')).toHaveText('한 번에 50명까지 방출할 수 있어요.');
  await expect(page.locator('.mk-rel-list input:checked')).toHaveCount(50);
  await page.locator('[data-act="release"]').click();
  await page.locator('[data-act="release-confirm"]').click();
  await expect(page.locator('#toast')).toHaveText('50명을 방출했어요.');
  expect(released!.careerIds).toHaveLength(50);
});

test('T-11-442 리롤권 상점에서 자금이 모자라면 모자란 금액과 방출 화면으로 가는 버튼을 보인다', async ({
  page,
}) => {
  await stub(page);
  await page.route(`${API}/v1/items/shop`, (r) =>
    r.fulfill(ok({ reroll: 0, balance: 30_000, price: 100_000, bought: 0, cap: 5 })),
  );
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(ok({ reroll: 0, boost: 0, scout: 0, rename: 0 })),
  );
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(30_000)));
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="reroll-shop"]').click();
  const short = page.locator('[data-reroll-shop] [data-funds-short]');
  await expect(short).toContainText('구단 자금이 7억 모자라요.');
  await expect(page.locator('[data-act="reroll-buy"]')).toBeDisabled();
  await short.locator('[data-act="funds-go-release"]').click();
  await expect(page.locator('.mk-pane[aria-label="방출해서 자금 만들기"]')).toBeVisible();
  await expect(page.locator('[data-act="open-release"]')).toHaveAttribute('aria-pressed', 'true');
});

test('T-11-500 국적 · 팀으로 찾기 — 시트를 열 때만 고를 거리를 받고, 고르면 목록을 그 조건으로 다시 받는다', async ({
  page,
}) => {
  await stub(page);
  await page.route(`${API}/v1/market/me`, (r) => r.fulfill(me(200_000)));
  const lists: string[] = [];
  await page.route(
    (u) => u.href.startsWith(API) && u.pathname === '/v1/market',
    (r) => {
      lists.push(new URL(r.request().url()).search);
      return r.fulfill(
        ok({
          season: 0,
          items: [{ ...listing, card: { ...card, nation: 'BR', league: 'pl', club: 'pl-0' } }],
          hasMore: false,
          recent: [],
        }),
      );
    },
  );
  await page.route(`${API}/v1/market/chart**`, (r) => r.fulfill(ok({ season: 0, points: [] })));
  let facetCalls = 0;
  await page.route(`${API}/v1/market/facets`, (r) => {
    facetCalls++;
    return r.fulfill(
      ok({
        nations: [
          { id: 'KR', n: 30 },
          { id: 'BR', n: 4 },
        ],
        leagues: [
          { id: 'pl', n: 20 },
          { id: 'll', n: 5 },
        ],
        clubs: [
          { id: 'pl-0', n: 9 },
          { id: 'pl-4', n: 3 },
          { id: 'll-1', n: 2 },
        ],
      }),
    );
  });
  await page.goto('/');
  await page.locator('[data-act="home-market"]').click();
  // 매물 줄에 국적 · 가장 오래 뛴 클럽을 보인다.
  await expect(page.locator(`[data-listing="${LISTING}"] [data-listing-from]`)).toHaveText(
    '브라질 · 맨체스터 스카이블루',
  );
  expect(facetCalls).toBe(0);

  await page.locator('[data-act="market-find"]').click();
  const sheet = page.getByRole('dialog', { name: '국적 · 팀으로 찾기' });
  await expect(sheet.locator('[data-find-nation]')).toHaveCount(2);
  await expect(sheet.locator('[data-find-nation="BR"]')).toContainText('4');
  await sheet.locator('[data-find-query]').fill('브라');
  await expect(sheet.locator('[data-find-nation]')).toHaveCount(1);
  await expectNoA11yViolations(page);
  await sheet.locator('[data-find-nation="BR"]').click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('[data-market-find-chip="nation"]')).toHaveText('브라질');
  await expect.poll(() => lists.at(-1)).toBe('?sort=new&nation=BR');

  // 팀 탭: 매물이 가장 많은 리그가 펼쳐지고, 클럽을 고르면 국적과 함께 건다.
  await page.locator('[data-act="market-find"]').click();
  await sheet.locator('[data-find-tab="team"]').click();
  await expect(sheet.locator('[data-find-club]')).toHaveCount(2);
  await sheet.locator('[data-find-league="ll"]').click();
  await expect(sheet.locator('[data-find-club]')).toHaveCount(1);
  await sheet.locator('[data-find-club="ll-1"]').click();
  await expect.poll(() => lists.at(-1)).toBe('?sort=new&nation=BR&club=ll-1');
  // 포지션을 바꿔도 국적 · 팀은 남는다.
  await page.locator('[data-market-pos="FW"]').click();
  await expect.poll(() => lists.at(-1)).toBe('?sort=new&pos=FW&nation=BR&club=ll-1');
  // 칩을 누르면 그 조건만 푼다. 시트를 다시 열어도 고를 거리는 메모로 그린다.
  await page.locator('[data-market-find-chip="nation"]').click();
  await expect.poll(() => lists.at(-1)).toBe('?sort=new&pos=FW&club=ll-1');
  expect(facetCalls).toBe(1);
});
