import { test, expect, type Page } from '@playwright/test';
import { API, fail, ok } from './helpers.js';

// T-11-454 웹 결제(엑솔라). 서버가 연 구단주에게만 '웹에서 사기'를 보이고, 상품을 누르면 서버가 만든 결제창 주소로 간다.
// 결제창에서 돌아오면(`/?webpay=<주문>`) 주문 상태를 물어 결과를 알린다. 엑솔라 결제창은 가짜 페이지로 바꾼다.

const REROLL_15 = 'com.offsidelab.app.reroll_15';
const ORDER = `wp_${'a'.repeat(32)}`;
const PAY_URL = 'https://sandbox-secure.xsolla.com/paystation4/?token=tok_e2e';
const config = {
  enabled: true,
  products: [
    { productId: 'com.offsidelab.app.reroll_5', item: 'reroll', qty: 5, amount: 1100 },
    { productId: REROLL_15, item: 'reroll', qty: 15, amount: 2200 },
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

test('웹 결제가 꺼져 있으면 카드 없이 앱 안내를 그대로 둔다', async ({ page }) => {
  const calls = await setup(page, { enabled: false });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-scout-shop]')).toContainText(
    '프리미엄 스카우트권은 앱에서 살 수 있어요.',
  );
  await expect(page.locator('[data-web-pay-shop]')).toHaveCount(0);
  expect(calls()).toBe(1);
});

test('상품을 누르면 서버 주문의 결제창으로 가고, 돌아오면 결제 확인을 기다려 알린다', async ({
  page,
}) => {
  const calls = await setup(page, config);
  let orderBody: unknown = null;
  await page.route(`${API}/v1/web-pay/orders`, (r) => {
    orderBody = r.request().postDataJSON();
    return r.fulfill(ok({ orderId: ORDER, payUrl: PAY_URL }, 201));
  });
  // 가짜 결제창. 결제를 마치고 돌아오는 것은 아래에서 돌아오는 주소로 바로 연다.
  await page.route('https://sandbox-secure.xsolla.com/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<p>fake pay station</p>' }),
  );
  let statusCalls = 0;
  await page.route(`${API}/v1/web-pay/orders/${ORDER}`, (r) =>
    r.fulfill(ok({ status: ++statusCalls < 2 ? 'READY' : 'PAID' })),
  );
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  const shop = page.locator('[data-web-pay-shop]');
  await expect(shop).toContainText('리롤권 15장');
  await expect(shop).toContainText('2,200원');
  await expect(page.locator('[data-scout-shop]')).toContainText(
    '아래 웹에서 사기에서 살 수 있어요.',
  );
  await shop.locator(`[data-web-pay-product="${REROLL_15}"]`).click();
  await page.waitForURL(/sandbox-secure\.xsolla\.com/);
  expect(orderBody).toEqual({ productId: REROLL_15 });
  await page.goto(`/?webpay=${ORDER}`);
  await expect(page.getByText('결제가 끝나 아이템이 들어왔어요.')).toBeVisible();
  expect(statusCalls).toBe(2);
  await expect(page).toHaveURL(/\/$/);
  expect(calls()).toBeLessThanOrEqual(2);
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
  for (let i = 0; i < 6; i++) await page.clock.runFor(2000);
  await expect(
    page.getByText('결제가 확인되면 아이템이 자동으로 들어와요.', { exact: false }),
  ).toBeVisible();
  const polled = statusCalls;
  expect(polled).toBeGreaterThanOrEqual(6);
  paid = true;
  await page.reload();
  await page.locator('[data-act="owner"]').click();
  await expect(page.getByText('결제가 끝나 아이템이 들어왔어요.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ft_webpay_pending'))).toBeNull();
});
