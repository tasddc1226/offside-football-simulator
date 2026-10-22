import { test, expect, type Page } from '@playwright/test';
import { API, fail, ok } from './helpers.js';

// T-11-454 웹 결제(토스페이먼츠). 서버가 연 구단주에게만 '웹에서 사기'를 보이고, 상품을 고르면 결제 위젯을 그린 뒤
// 서버가 만든 주문으로 결제창에 간다. 돌아오면 승인을 보내고 결과를 알린다. 토스 SDK는 가짜 스크립트로 바꾼다.

const REROLL_15 = 'com.offsidelab.app.reroll_15';
const config = {
  enabled: true,
  clientKey: 'test_gck_e2e',
  customerKey: '11111111-1111-4111-8111-111111111111',
  products: [
    { productId: 'com.offsidelab.app.reroll_5', item: 'reroll', qty: 5, amount: 1100 },
    { productId: REROLL_15, item: 'reroll', qty: 15, amount: 2200 },
  ],
};
const FAKE_SDK = `window.TossPayments = (clientKey) => ({ widgets: ({ customerKey }) => ({
  setAmount: async (a) => { window.__toss = { clientKey, customerKey, amount: a.value }; },
  renderPaymentMethods: async ({ selector }) => { document.querySelector(selector).textContent = 'fake-methods'; },
  renderAgreement: async () => {},
  requestPayment: async (o) => {
    location.href = o.successUrl + '&paymentKey=pay_e2e&orderId=' + o.orderId + '&amount=' + window.__toss.amount;
  },
}) });`;

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
  let sdk = 0;
  await page.route('https://js.tosspayments.com/**', (r) => (sdk++, r.abort()));
  const calls = await setup(page, { enabled: false });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  await expect(page.locator('[data-scout-shop]')).toContainText(
    '프리미엄 스카우트권은 앱에서 살 수 있어요.',
  );
  await expect(page.locator('[data-web-pay-shop]')).toHaveCount(0);
  expect(calls()).toBe(1);
  expect(sdk).toBe(0);
});

test('상품을 고르면 위젯을 그리고, 서버 주문으로 결제한 뒤 돌아와 승인한다', async ({ page }) => {
  await page.route('https://js.tosspayments.com/**', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: FAKE_SDK }),
  );
  const calls = await setup(page, config);
  let orderBody: unknown = null;
  await page.route(`${API}/v1/web-pay/orders`, (r) => {
    orderBody = r.request().postDataJSON();
    return r.fulfill(ok({ orderId: 'wp_e2eorder', amount: 2200, orderName: '리롤권 15장' }, 201));
  });
  let confirmBody: unknown = null;
  await page.route(`${API}/v1/web-pay/confirm`, (r) => {
    confirmBody = r.request().postDataJSON();
    return r.fulfill(ok({ reroll: 15, boost: 0, scout: 0, rename: 0 }));
  });
  await page.goto('/');
  await page.locator('[data-act="owner"]').click();
  const shop = page.locator('[data-web-pay-shop]');
  await expect(shop).toContainText('리롤권 15장');
  await expect(shop).toContainText('2,200원');
  await expect(page.locator('[data-scout-shop]')).toContainText(
    '아래 웹에서 사기에서 살 수 있어요.',
  );
  await shop.locator(`[data-web-pay-product="${REROLL_15}"]`).click();
  await expect(shop.locator('#wp-methods')).toHaveText('fake-methods');
  await shop.locator('[data-web-pay-submit]').click();
  await expect(page.getByText('결제가 끝나 아이템이 들어왔어요.')).toBeVisible();
  expect(orderBody).toEqual({ productId: REROLL_15 });
  expect(confirmBody).toEqual({ paymentKey: 'pay_e2e', orderId: 'wp_e2eorder', amount: 2200 });
  await expect(page).toHaveURL(/\/$/);
  // 돌아온 뒤 구단주 화면을 다시 그려도 설정은 메모에서 읽는다(페이지를 새로 열어 한 번 더 물은 것까지 2번).
  expect(calls()).toBeLessThanOrEqual(2);
});

test('결제창에서 취소하고 돌아오면 취소했다고 알리고 승인을 보내지 않는다', async ({ page }) => {
  await setup(page, config);
  let confirms = 0;
  await page.route(`${API}/v1/web-pay/confirm`, (r) => (confirms++, r.fulfill(ok({}))));
  await page.goto('/?webpay=fail&code=PAY_PROCESS_CANCELED&message=x&orderId=wp_e2eorder');
  await expect(page.getByText('결제를 취소했어요.')).toBeVisible();
  await expect(page.locator('[data-web-pay-shop]')).toBeVisible();
  expect(confirms).toBe(0);
});
