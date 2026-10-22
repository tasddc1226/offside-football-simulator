import {
  IAP_PRODUCTS,
  OwnerItemsResponseSchema,
  WEB_PAY_PRODUCTS,
  WEB_PAY_STORE,
  WebPayConfigResponseSchema,
  WebPayConfirmBodySchema,
  WebPayOrderBodySchema,
  WebPayOrderResponseSchema,
  webPayAmount,
  type IapProductId,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { cupKo } from '../cupText.js';
import { grantIapPurchase, ownerItemsOf, revokeIapPurchase } from '../db/repos/iap.js';
import {
  createWebPayOrder,
  markWebPayCanceled,
  markWebPayDone,
  webPayOrderByPaymentKey,
  webPayOrderOf,
} from '../db/repos/webPay.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { billingAlertId } from '../iap/alerts.js';
import {
  confirmTossPayment,
  getTossPayment,
  tossTest,
  webPayCustomerKey,
  webPayEnabled,
  type TossResult,
} from '../iap/toss.js';
import { WEB_PAY_WEBHOOK_PATH } from '../middleware/originGuard.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { billing } from '../i18n/ko/billing.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, enforceLimit, NO_STORE, nowIso, ok, readBody, readJson } from './shared.js';

// T-11-454 웹 결제(토스페이먼츠). 웹이 주문을 만들고(금액은 서버가 정한다) 결제창을 띄운 뒤, 결제창이 돌려준 paymentKey로
// 승인을 부탁하면 서버가 토스에 승인하고 인앱 구매와 같은 원장(iap_purchases, store 'toss')에 아이템을 준다. 환불은 운영자가
// 토스 상점관리자에서 취소하면 웹훅으로 알고 회수한다. 문서: docs/operations/web-pay.md.

const unavailable = () =>
  new AppError({ code: 'SERVICE_UNAVAILABLE', message: cupKo('webPayUnavailable') });
const invalid = () => conflictError(cupKo('iapInvalid'), 'IAP_INVALID');

/** 결제창 · 영수증의 상품 이름(한국어 저장값). */
const orderName = (productId: IapProductId) => {
  const p = IAP_PRODUCTS[productId];
  return billing.quantity(billing.items[p.item], p.qty);
};

/** 승인 결과를 해석한다. 이미 승인한 결제(새로고침 · 재전송)는 토스에 다시 조회한다. */
async function approved(c: Context<AppEnv>, input: Parameters<typeof confirmTossPayment>[1]) {
  let r: TossResult = await confirmTossPayment(c.env, input);
  if (!r.ok && r.code === 'ALREADY_PROCESSED_PAYMENT')
    r = await getTossPayment(c.env, input.paymentKey);
  return r;
}

export function registerWebPayRoutes(app: Hono<AppEnv>) {
  app.get('/v1/web-pay/config', requireProfile, async (c) => {
    const me = await requireOwner(c);
    if (!webPayEnabled(c.env, me.id))
      return ok(c, WebPayConfigResponseSchema, { enabled: false }, 200, NO_STORE);
    return ok(
      c,
      WebPayConfigResponseSchema,
      {
        enabled: true,
        clientKey: c.env.TOSS_CLIENT_KEY,
        customerKey: webPayCustomerKey(me.id),
        products: WEB_PAY_PRODUCTS,
      },
      200,
      NO_STORE,
    );
  });

  app.post('/v1/web-pay/orders', requireProfile, async (c) => {
    const me = await requireOwner(c);
    if (!webPayEnabled(c.env, me.id)) throw unavailable();
    const { productId } = readBody(c, WebPayOrderBodySchema);
    const db = getDb(c);
    const now = nowIso();
    await enforceLimit(db, 'WEB_PAY', me.id, 30, now, 'RATE_LIMITED');
    const order = {
      orderId: `wp_${crypto.randomUUID().replaceAll('-', '')}`,
      amount: webPayAmount(productId),
      orderName: orderName(productId),
    };
    await createWebPayOrder(db, { ...order, profileId: me.id, productId, now });
    return ok(c, WebPayOrderResponseSchema, order, 201, NO_STORE);
  });

  app.post('/v1/web-pay/confirm', requireProfile, async (c) => {
    const me = await requireOwner(c);
    if (!webPayEnabled(c.env, me.id)) throw unavailable();
    const input = readBody(c, WebPayConfirmBodySchema);
    const db = getDb(c);
    const order = await webPayOrderOf(db, input.orderId);
    // 다른 구단주의 주문 · 금액을 바꾼 요청은 토스에 승인을 부탁하지 않는다.
    if (!order || order.profileId !== me.id || order.amount !== input.amount) throw invalid();
    if (order.status !== 'READY') {
      if (order.status === 'DONE' && order.paymentKey === input.paymentKey)
        return ok(c, OwnerItemsResponseSchema, await ownerItemsOf(db, me.id), 200, NO_STORE);
      throw invalid();
    }
    const r = await approved(c, input).catch((e: unknown) => {
      console.error(JSON.stringify({ job: 'web-pay-confirm', error: String(e).slice(0, 200) }));
      throw unavailable();
    });
    if (!r.ok) {
      console.error(JSON.stringify({ job: 'web-pay-confirm', code: r.code.slice(0, 60) }));
      throw invalid();
    }
    const p = r.payment;
    if (p.status !== 'DONE' || p.orderId !== order.orderId || p.totalAmount !== order.amount)
      throw invalid();
    const productId = order.productId as IapProductId;
    const product = IAP_PRODUCTS[productId];
    const test = tossTest(c.env);
    const now = nowIso();
    const alert = {
      store: WEB_PAY_STORE,
      transactionId: p.paymentKey,
      kind: 'purchase',
      productId,
      test,
    } as const;
    const alertId = c.env.BILLING_ALERTS_ENABLED === '1' ? await billingAlertId(alert) : undefined;
    const items = await grantIapPurchase(db, {
      store: WEB_PAY_STORE,
      transactionId: p.paymentKey,
      profileId: me.id,
      productId,
      item: product.item,
      qty: product.qty,
      test,
      now,
      metadata: {
        purchasedAt:
          p.approvedAt && !Number.isNaN(Date.parse(p.approvedAt))
            ? new Date(p.approvedAt).toISOString()
            : now,
        priceMilliunits: order.amount * 1000,
        currency: 'KRW',
        storefront: 'KOR',
      },
      acquisitionEnabled: c.env.ACQUISITION_ENABLED === '1',
      ...(alertId ? { alertId } : {}),
    });
    if (!items) throw invalid();
    await markWebPayDone(db, {
      orderId: order.orderId,
      paymentKey: p.paymentKey,
      method: p.method,
      test,
      now,
    });
    if (alertId && c.env.BILLING_QUEUE)
      waitUntil(
        c,
        c.env.BILLING_QUEUE.send({ version: 1, id: alertId }).catch(() => {
          console.error(JSON.stringify({ job: 'billing-enqueue', id: alertId }));
        }),
      );
    return ok(c, OwnerItemsResponseSchema, items, 200, NO_STORE);
  });

  // 토스 웹훅(결제 상태 변경). 본문은 믿지 않고 paymentKey로 토스에 다시 묻는다 — 우리가 승인한 결제가 취소됐으면 회수한다.
  // 처리했거나 다룰 일이 없으면 200(토스가 다시 보내지 않는다), 토스 조회가 실패하면 500(토스가 다시 보낸다).
  app.post(WEB_PAY_WEBHOOK_PATH, async (c) => {
    if (!c.env.TOSS_SECRET_KEY) return c.body(null, 200);
    const body = readJson(c) as { data?: { paymentKey?: unknown } } | null;
    const paymentKey = body?.data?.paymentKey;
    if (typeof paymentKey !== 'string' || !paymentKey || paymentKey.length > 200)
      return c.body(null, 200);
    const db = getDb(c);
    const order = await webPayOrderByPaymentKey(db, paymentKey);
    if (order?.status !== 'DONE') return c.body(null, 200);
    const r = await getTossPayment(c.env, paymentKey).catch(() => null);
    if (!r) return c.body(null, 500);
    if (r.ok && r.payment.status === 'CANCELED') {
      const now = nowIso();
      await revokeIapPurchase(db, WEB_PAY_STORE, paymentKey, now);
      await markWebPayCanceled(db, paymentKey, now);
    }
    return c.body(null, 200);
  });
}
