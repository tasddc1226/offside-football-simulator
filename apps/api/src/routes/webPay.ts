import {
  IAP_PRODUCTS,
  WEB_PAY_ORDER_ID,
  WEB_PAY_PRODUCTS,
  WEB_PAY_STORE,
  WebPayConfigResponseSchema,
  WebPayOrderBodySchema,
  WebPayOrderResponseSchema,
  WebPayOrderStatusResponseSchema,
  type IapProductId,
} from '@offside/contracts';
import type { Context, Hono } from 'hono';
import { cupKo } from '../cupText.js';
import { grantIapPurchase, revokeIapPurchase } from '../db/repos/iap.js';
import {
  createWebPayOrder,
  markWebPayCanceled,
  markWebPayPaid,
  webPayOrderByXsollaId,
  webPayOrderOf,
} from '../db/repos/webPay.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { billingAlertId, recordBillingAlert } from '../iap/alerts.js';
import {
  createXsollaToken,
  webPayEnabled,
  xsollaPayUrl,
  xsollaSandbox,
  xsollaSignatureOk,
} from '../iap/xsolla.js';
import { reqLang } from '../lang.js';
import { WEB_PAY_WEBHOOK_PATH } from '../middleware/originGuard.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { enforceLimit, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-454 웹 결제(엑솔라 Pay Station). 웹이 주문을 부탁하면 서버가 엑솔라 결제 토큰을 만들어 결제창 주소를 돌려준다. 나라별
// 가격 · 통화 · 세금 · 결제 수단(해외 카드 · PayPal 등)은 엑솔라가 정한다. 결제가 끝나면 엑솔라 웹훅(order_paid)으로 인앱 구매와
// 같은 원장(iap_purchases, store 'xsolla')에 아이템을 주고, 환불 · 차지백(order_canceled)이면 회수한다.
// 문서: docs/operations/web-pay.md.

const unavailable = () =>
  new AppError({ code: 'SERVICE_UNAVAILABLE', message: cupKo('webPayUnavailable') });

type XsollaHook = {
  notification_type?: unknown;
  user?: { id?: unknown; external_id?: unknown };
  order?: { id?: unknown; mode?: unknown };
  items?: { sku?: unknown; quantity?: unknown }[];
  billing?: {
    purchase?: { total?: { currency?: unknown; amount?: unknown } };
    transaction?: { payment_date?: unknown; dry_run?: unknown };
  };
};

/** 엑솔라가 알아듣는 오류 응답(400이면 다시 보내지 않는다). */
const hookError = (
  c: Context<AppEnv>,
  code: 'INVALID_SIGNATURE' | 'INVALID_USER' | 'INVALID_PARAMETER',
) => c.json({ error: { code, message: code } }, 400);

const profileExists = async (c: Context<AppEnv>, id: string) =>
  (await c.env.DB.prepare('SELECT 1 AS x FROM profiles WHERE id = ?').bind(id).first()) !== null;

/** 결제 웹훅의 금액(엑솔라 billing.purchase.total, 사용자가 낸 통화). */
function paidMetadata(hook: XsollaHook, now: string) {
  const total = hook.billing?.purchase?.total;
  const amount = Number(total?.amount);
  const currency = typeof total?.currency === 'string' ? total.currency : '';
  const money = Number.isFinite(amount) && amount >= 0 && /^[A-Z]{3}$/.test(currency);
  const date = hook.billing?.transaction?.payment_date;
  const ms = typeof date === 'string' ? Date.parse(date) : Number.NaN;
  return {
    purchasedAt: Number.isNaN(ms) ? now : new Date(ms).toISOString(),
    priceMilliunits: money ? Math.round(amount * 1000) : null,
    currency: money ? currency : null,
    storefront: null,
  };
}

export function registerWebPayRoutes(app: Hono<AppEnv>) {
  app.get('/v1/web-pay/config', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const enabled = webPayEnabled(c.env, me.id);
    return ok(
      c,
      WebPayConfigResponseSchema,
      enabled ? { enabled, products: WEB_PAY_PRODUCTS } : { enabled },
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
    const orderId = `wp_${crypto.randomUUID().replaceAll('-', '')}`;
    // Origin은 originGuard가 허용한 웹 주소다. 결제창이 끝나면 이 주소의 `/?webpay=<주문>`으로 돌아온다.
    const origin = c.req.header('Origin') ?? new URL(c.req.url).origin;
    const cf = (c.req.raw as { cf?: { country?: unknown } }).cf;
    const country =
      typeof cf?.country === 'string' && /^[A-Z]{2}$/.test(cf.country) && cf.country !== 'XX'
        ? cf.country
        : null;
    const token = await createXsollaToken(c.env, {
      profileId: me.id,
      sku: productId,
      orderId,
      country,
      ip: c.req.header('CF-Connecting-IP') ?? null,
      language: reqLang(c),
      returnUrl: `${origin}/?webpay=${orderId}`,
    }).catch((e: unknown) => {
      console.error(JSON.stringify({ job: 'web-pay-token', error: String(e).slice(0, 200) }));
      throw unavailable();
    });
    await createWebPayOrder(db, {
      orderId,
      profileId: me.id,
      productId,
      xsollaOrderId: token.xsollaOrderId,
      test: xsollaSandbox(c.env),
      now,
    });
    return ok(
      c,
      WebPayOrderResponseSchema,
      { orderId, payUrl: xsollaPayUrl(c.env, token.token) },
      201,
      NO_STORE,
    );
  });

  app.get('/v1/web-pay/orders/:orderId', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const orderId = c.req.param('orderId');
    const order = WEB_PAY_ORDER_ID.test(orderId) ? await webPayOrderOf(getDb(c), orderId) : null;
    if (order?.profileId !== me.id)
      throw notFoundError(cupKo('iapInvalid'), 'WEB_PAY_ORDER_NOT_FOUND');
    return ok(c, WebPayOrderStatusResponseSchema, { status: order.status }, 200, NO_STORE);
  });

  // 엑솔라 웹훅. 서명이 맞는 것만 읽는다. 처리했거나 다룰 일이 없으면 204, 우리 쪽 일시 오류는 5xx(엑솔라가 12시간 안에
  // 다시 보낸다), 받을 수 없는 요청(서명 · 사용자 · 상품)은 400.
  app.post(WEB_PAY_WEBHOOK_PATH, async (c) => {
    const raw = c.get('rawBody') ?? '';
    if (!(await xsollaSignatureOk(c.env, raw, c.req.header('Authorization'))))
      return hookError(c, 'INVALID_SIGNATURE');
    let hook: XsollaHook;
    try {
      hook = JSON.parse(raw) as XsollaHook;
    } catch {
      return hookError(c, 'INVALID_PARAMETER');
    }
    const type = hook.notification_type;
    if (type === 'user_validation') {
      const id = hook.user?.id;
      return typeof id === 'string' && (await profileExists(c, id))
        ? c.body(null, 204)
        : hookError(c, 'INVALID_USER');
    }
    if (type !== 'order_paid' && type !== 'order_canceled') return c.body(null, 204);
    const xsollaOrderId =
      typeof hook.order?.id === 'number' || typeof hook.order?.id === 'string'
        ? String(hook.order.id)
        : '';
    if (!xsollaOrderId) return hookError(c, 'INVALID_PARAMETER');
    const db = getDb(c);
    const now = nowIso();

    if (type === 'order_canceled') {
      await markWebPayCanceled(db, WEB_PAY_STORE, xsollaOrderId, now);
      const r = await revokeIapPurchase(db, WEB_PAY_STORE, xsollaOrderId, now);
      console.log(
        JSON.stringify({
          job: 'iap-refund',
          store: WEB_PAY_STORE,
          found: r.found,
          ...(r.found ? { revoked: r.revoked } : {}),
        }),
      );
      if (r.found && !r.already) {
        const row = await webPayOrderByXsollaId(db, xsollaOrderId);
        if (row)
          await recordBillingAlert(
            c.env,
            {
              store: WEB_PAY_STORE,
              transactionId: xsollaOrderId,
              kind: 'refund',
              productId: row.productId,
              test: hook.order?.mode === 'sandbox',
            },
            now,
          );
      }
      return c.body(null, 204);
    }

    // order_paid: 우리 상품 하나(수량 1 이상)만 판다. 주문을 만든 구단주에게 준다.
    const profileId = hook.user?.external_id;
    const lines = (hook.items ?? []).filter(
      (i) => typeof i.sku === 'string' && Object.hasOwn(IAP_PRODUCTS, i.sku),
    );
    const sku = lines[0]?.sku as IapProductId | undefined;
    const quantity = lines.reduce(
      (n, i) => n + (Number.isInteger(i.quantity) ? Number(i.quantity) : 0),
      0,
    );
    if (!sku || lines.some((i) => i.sku !== sku) || quantity < 1)
      return hookError(c, 'INVALID_PARAMETER');
    if (typeof profileId !== 'string' || !(await profileExists(c, profileId)))
      return hookError(c, 'INVALID_USER');
    const order = await webPayOrderByXsollaId(db, xsollaOrderId);
    if (order && (order.profileId !== profileId || order.productId !== sku))
      return hookError(c, 'INVALID_PARAMETER');
    const product = IAP_PRODUCTS[sku];
    const test = hook.order?.mode === 'sandbox' || Number(hook.billing?.transaction?.dry_run) === 1;
    const alert = {
      store: WEB_PAY_STORE,
      transactionId: xsollaOrderId,
      kind: 'purchase',
      productId: sku,
      test,
    } as const;
    const alertId = c.env.BILLING_ALERTS_ENABLED === '1' ? await billingAlertId(alert) : undefined;
    const items = await grantIapPurchase(db, {
      store: WEB_PAY_STORE,
      transactionId: xsollaOrderId,
      profileId,
      productId: sku,
      item: product.item,
      qty: product.qty * quantity,
      test,
      now,
      metadata: paidMetadata(hook, now),
      acquisitionEnabled: c.env.ACQUISITION_ENABLED === '1',
      ...(alertId ? { alertId } : {}),
    });
    if (!items) {
      // 같은 엑솔라 주문을 다른 구단주가 이미 받았다(있을 수 없는 일). 다시 보내도 같으니 받았다고 답한다.
      console.error(JSON.stringify({ job: 'web-pay-paid', conflict: xsollaOrderId.slice(-6) }));
      return c.body(null, 204);
    }
    await markWebPayPaid(db, xsollaOrderId, now);
    if (alertId && c.env.BILLING_QUEUE)
      waitUntil(
        c,
        c.env.BILLING_QUEUE.send({ version: 1, id: alertId }).catch(() => {
          console.error(JSON.stringify({ job: 'billing-enqueue', id: alertId }));
        }),
      );
    return c.body(null, 204);
  });
}
