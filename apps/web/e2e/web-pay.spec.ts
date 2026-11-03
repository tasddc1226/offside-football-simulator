import { test, expect, type Page } from '@playwright/test';
import { API, fail, ok } from './helpers.js';
import { resumeFixture } from './fixtures/career-save.js';

// T-11-454 웹 결제(엑솔라). 서버가 연 구단주에게만 '웹에서 사기'를 보이고, 상품을 누르면 서버가 만든 결제창 주소로 간다.
// 결제창에서 돌아오면(`/?webpay=<주문>`) 주문 상태를 물어 결과를 알린다. 엑솔라 결제창은 가짜 페이지로 바꾼다.
// T-11-471 앱 스토어 묶음과 같은 자리(아이템별 상점 카드 · 선수 탭 강화 · 이름 변경 창)에 보이고, 결제를 시작한 화면으로 돌아온다.

const REROLL_15 = 'com.offsidelab.app.reroll_15';
const BOOST_3 = 'com.offsidelab.app.boost_3';
const BOOST_100 = 'com.offsidelab.app.boost_100';
const RENAME_5 = 'com.offsidelab.app.rename_5';
const ORDER = `wp_${'a'.repeat(32)}`;
const PAY_URL = 'https://sandbox-secure.xsolla.com/paystation4/?token=tok_e2e';
const config = {
  enabled: true,
  products: [
    { productId: 'com.offsidelab.app.reroll_5', item: 'reroll', qty: 5, amount: 1100 },
    { productId: REROLL_15, item: 'reroll', qty: 15, amount: 2200 },
    { productId: BOOST_3, item: 'boost', qty: 3, amount: 1100 },
    { productId: BOOST_100, item: 'boost', qty: 100, amount: 19800 },
    { productId: 'com.offsidelab.app.scout_1', item: 'scout', qty: 1, amount: 1100 },
    { productId: RENAME_5, item: 'rename', qty: 5, amount: 1100 },
  ],
};

async function setup(page: Page, cfg: unknown) {
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')));
  await page.route(`${API}/v1/profile`, (r) =>
    r.fulfill(
      ok({
        id: 'owner-pay',
        nickname: '결제구단주',
        linked: { google: true },
        googleEmailMasked: 'f***@example.com',
        recoveryCodeIssuedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        avatarId: null,
      }),
    ),
  );
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(ok({ reroll: 0, boost: 0, scout: 0, rename: 0 })),
  );
  let configCalls = 0;
  await page.route(`${API}/v1/web-pay/config`, (r) => (configCalls++, r.fulfill(ok(cfg))));
  return () => configCalls;
}

async function fakePayStation(page: Page) {
  let orderBody: unknown = null;
  await page.route(`${API}/v1/web-pay/orders`, (r) => {
    orderBody = r.request().postDataJSON();
    return r.fulfill(ok({ orderId: ORDER, payUrl: PAY_URL }, 201));
  });
  await page.route('https://sandbox-secure.xsolla.com/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<p>fake pay station</p>' }),
  );
  return () => orderBody;
}

test('웹 결제가 꺼져 있으면 묶음 없이 앱 안내를 그대로 둔다', async ({ page }) => {
  const calls = await setup(page, { enabled: false });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="shop"]').click();
  await expect(page.locator('[data-scout-shop]')).toContainText(
    '프리미엄 스카우트권은 앱에서 살 수 있어요.',
  );
  // 가진 장수가 없으면 강화권 · 변경권 카드는 그대로 숨는다.
  await expect(page.locator('[data-boost-shop]')).toHaveCount(0);
  await expect(page.locator('[data-rename-shop]')).toHaveCount(0);
  await expect(page.locator('[data-web-pay-packs]')).toHaveCount(0);
  expect(calls()).toBe(1);
});

test('상점 화면: 아이템마다 앱과 같은 가격의 묶음을 보이고, 설정은 한 번만 묻는다', async ({
  page,
}) => {
  const calls = await setup(page, config);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="shop"]').click();
  const boost = page.locator('[data-boost-shop]');
  await expect(boost.locator('[data-web-pay-packs="boost"]')).toContainText(
    '잠재력 강화권 3장 · 1,100원',
  );
  await expect(page.locator('[data-scout-shop] [data-web-pay-packs="scout"]')).toContainText(
    '프리미엄 스카우트권 1장 · 1,100원',
  );
  await expect(page.locator('[data-rename-shop] [data-web-pay-packs="rename"]')).toContainText(
    '선수 이름 변경권 5장 · 1,100원',
  );
  // 다른 아이템 상품은 섞이지 않는다.
  await expect(boost.locator('[data-web-pay-product]')).toHaveCount(2);
  await expect(page.locator('[data-scout-shop]')).not.toContainText('앱에서 살 수 있어요');
  expect(calls()).toBe(1);
});

for (const width of [320, 390]) {
  test(`100-ticket pack shows its price and opens the correct order at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page, config);
    const orderBody = await fakePayStation(page);
    await page.goto('/');
    await page.locator('[data-act="owner"]').click();
    await page.locator('[data-act="shop"]').click();
    const button = page.locator(`[data-web-pay-product="${BOOST_100}"]`);
    await expect(button).toHaveText('잠재력 강화권 100장 · 19,800원');
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
    await testInfo.attach(`boost-100-${width}px`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await button.click();
    await page.waitForURL(/sandbox-secure\.xsolla\.com/);
    expect(orderBody()).toEqual({ productId: BOOST_100 });
  });
}

test('상품을 누르면 서버 주문의 결제창으로 가고, 돌아오면 결제 확인을 기다려 알린다', async ({
  page,
}) => {
  const calls = await setup(page, config);
  // 가짜 결제창. 결제를 마치고 돌아오는 것은 아래에서 돌아오는 주소로 바로 연다.
  const orderBody = await fakePayStation(page);
  let statusCalls = 0;
  await page.route(`${API}/v1/web-pay/orders/${ORDER}`, (r) =>
    r.fulfill(ok({ status: ++statusCalls < 2 ? 'READY' : 'PAID' })),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="shop"]').click();
  const shop = page.locator('[data-boost-shop]');
  await shop.locator(`[data-web-pay-product="${BOOST_3}"]`).click();
  await page.waitForURL(/sandbox-secure\.xsolla\.com/);
  expect(orderBody()).toEqual({ productId: BOOST_3 });
  await page.goto(`/?webpay=${ORDER}`);
  await expect(page.getByText('결제가 끝나 아이템이 들어왔어요.')).toBeVisible();
  expect(statusCalls).toBe(2);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-boost-shop]')).toBeVisible();
  expect(calls()).toBeLessThanOrEqual(2);
});

test('경기 화면 이름 변경 창: 변경권이 없으면 묶음을 보이고, 결제 뒤 진행 중 선수 화면으로 돌아온다', async ({
  page,
}) => {
  await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'unavailable')));
  await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
  await page.route(`${API}/v1/items`, (r) =>
    r.fulfill(ok({ reroll: 0, boost: 0, scout: 0, rename: 0 })),
  );
  await page.route(`${API}/v1/web-pay/config`, (r) => r.fulfill(ok(config)));
  await page.route(`${API}/v1/web-pay/orders/${ORDER}`, (r) => r.fulfill(ok({ status: 'PAID' })));
  const orderBody = await fakePayStation(page);
  await resumeFixture(page);
  await page.locator('[data-act="rename-open"]').click();
  const dialog = page.getByRole('dialog', { name: '선수 이름 바꾸기' });
  await expect(dialog.locator('[data-rename-none]')).toBeVisible();
  const packs = dialog.locator('[data-web-pay-packs="rename"]');
  await expect(packs).toContainText('선수 이름 변경권 5장 · 1,100원');
  await packs.locator(`[data-web-pay-product="${RENAME_5}"]`).click();
  await page.waitForURL(/sandbox-secure\.xsolla\.com/);
  expect(orderBody()).toEqual({ productId: RENAME_5 });
  await page.goto(`/?webpay=${ORDER}`);
  await expect(page.getByText('결제가 끝나 아이템이 들어왔어요.')).toBeVisible();
  await expect(page.locator('.player h1')).toBeVisible();
});

test('결제 확인이 늦으면 자동으로 들어온다고 알리고, 다음에 상점을 열 때 한 번 더 묻는다', async ({
  page,
}) => {
  await page.clock.install();
  await setup(page, config);
  let paid = false;
  let statusCalls = 0;
  await page.route(`${API}/v1/web-pay/orders/${ORDER}`, (r) => {
    statusCalls++;
    return r.fulfill(ok({ status: paid ? 'PAID' : 'READY' }));
  });
  await page.addInitScript(
    (order) =>
      localStorage.setItem('ft_webpay_pending', JSON.stringify({ orderId: order, at: Date.now() })),
    ORDER,
  );
  await page.goto(`/?webpay=${ORDER}`);
  await expect(page.getByText('결제를 확인하는 중…')).toBeVisible();
  // 확인 요청은 진짜 네트워크라, 느린 러너에서는 시계를 정해진 횟수만 감으면 마지막 확인이 아직 안 끝났을 수 있다.
  const later = page.getByText('결제가 확인되면 아이템이 자동으로 들어와요.', { exact: false });
  await expect
    .poll(
      async () => {
        await page.clock.runFor(2000);
        return later.isVisible();
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  const polled = statusCalls;
  expect(polled).toBeGreaterThanOrEqual(6);
  paid = true;
  await page.reload();
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="shop"]').click();
  await expect(page.getByText('결제가 끝나 아이템이 들어왔어요.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ft_webpay_pending'))).toBeNull();
});

test('T-11-591 클럽 멤버십: 웹 30일 이용권을 사고 돌아오면 멤버십 창을 다시 열어 새 상태를 보인다', async ({
  page,
}) => {
  const MEMBER = 'com.offsidelab.app.club_monthly';
  await setup(page, { ...config, membership: { productId: MEMBER, amount: 4900, days: 30 } });
  let paid = false;
  await page.route(`${API}/v1/membership`, (r) =>
    r.fulfill(
      ok(
        paid
          ? {
              active: true,
              until: '2026-12-01T00:00:00.000Z',
              autoRenew: null,
              store: null,
              stores: [],
            }
          : { active: false, until: null, autoRenew: null, store: null, stores: [] },
      ),
    ),
  );
  await page.route(`${API}/v1/web-pay/orders/${ORDER}`, (r) => r.fulfill(ok({ status: 'PAID' })));
  const orderBody = await fakePayStation(page);
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await page.locator('[data-act="membership"]').click();
  const buy = page.locator('[data-act="member-web-buy"]');
  await expect(buy).toContainText('웹에서 30일 이용권 사기 · 4,900원');
  await buy.click();
  await page.waitForURL(/sandbox-secure\.xsolla\.com/);
  expect(orderBody()).toEqual({ productId: MEMBER });
  paid = true;
  await page.goto(`/?webpay=${ORDER}`);
  await expect(page.getByText('결제가 끝나 멤버십 혜택이 시작됐어요.')).toBeVisible();
  await expect(page.getByText('멤버십을 이용하고 있어요')).toBeVisible();
  // 웹 이용권 중에도 이어서 살 수 있다.
  await expect(page.locator('[data-act="member-web-buy"]')).toBeVisible();
});
