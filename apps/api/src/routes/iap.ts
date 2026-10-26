import { REMOVE_ADS_PRODUCT_ID } from '@offside/contracts/cup';
import { recordAdFreePurchase } from '../db/repos/adFreePurchases.js';
import { getSessionOrThrow } from '../middleware/requireProfile.js';
import { IAP_PRODUCTS, IapClaimBodySchema, OwnerItemsResponseSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import { grantIapPurchase, iapOwnerOf, ownerItemsOf } from '../db/repos/iap.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { verifyPubsubToken } from '../iap/pubsub.js';
import { handleGoogleRtdn } from '../iap/rtdn.js';
import { billingAlertId } from '../iap/alerts.js';
import { handleAppleNotification } from '../iap/refunds.js';
import { iapAccount, iapStores, verifyIapClaim, type IapRejection } from '../iap/verify.js';
import { APPLE_IAP_NOTIFY_PATH } from '../middleware/originGuard.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, nowIso, ok, readBody, readJson, enforceLimit } from './shared.js';

// T-11-174 인앱 상품(소모성): 리롤권 · 잠재력 강화권 묶음. 앱이 스토어에서 산 거래를 보내면 스토어 기준으로 확인하고
// 거래마다 한 번만 아이템을 준다. 앱은 이 응답을 받은 뒤에만 스토어 거래를 마무리(소비)한다 — 응답을 못 받으면 다음 실행 때
// 같은 거래를 다시 보내고, 이미 받은 거래면 같은 결과를 돌려받는다.

const unavailable = () =>
  new AppError({ code: 'SERVICE_UNAVAILABLE', message: cupKo('iapUnavailable') });

const REJECT = {
  PENDING: ['iapPending', 'IAP_PENDING'],
  OTHER_ACCOUNT: ['iapOtherAccount', 'IAP_OTHER_ACCOUNT'],
  INVALID: ['iapInvalid', 'IAP_INVALID'],
} as const;
const reject = (r: IapRejection) => conflictError(cupKo(REJECT[r][0]), REJECT[r][1]);

export function registerIapRoutes(app: Hono<AppEnv>) {
  app.post('/v1/iap/ad-free/record', requireProfile, async (c) => {
    c.header('Cache-Control', NO_STORE);
    if (c.env.ACQUISITION_ENABLED !== '1') return c.body(null, 503);
    let body: { store?: unknown; token?: unknown; profileId?: unknown };
    try {
      body = JSON.parse(c.get('rawBody') ?? '{}') as typeof body;
    } catch {
      return c.body(null, 400);
    }
    if (
      !body ||
      (body.store !== 'apple' && body.store !== 'google') ||
      typeof body.token !== 'string' ||
      !body.token ||
      body.token.length > 16384
    )
      return c.body(null, 400);
    const profileId = getSessionOrThrow(c).profileId;
    if (body.profileId !== undefined && body.profileId !== profileId) return c.body(null, 409);
    const consent = await c.env.DB.prepare(
      'SELECT version FROM acquisition_consents WHERE profile_id=?',
    )
      .bind(profileId)
      .first<{ version: string }>();
    if (consent?.version !== 'account-acquisition-v1') return c.body(null, 204);
    await enforceLimit(getDb(c), 'ACQUISITION', profileId, 60, nowIso(), 'RATE_LIMITED');
    const verdict = await verifyIapClaim(
      c.env,
      { store: body.store, token: body.token, productId: REMOVE_ADS_PRODUCT_ID },
      iapAccount(profileId),
      { nowS: Math.floor(Date.now() / 1000), allowUnbound: true },
    ).catch(() => null);
    if (!verdict) throw unavailable();
    if (!verdict.ok) throw reject(verdict.reason);
    if (verdict.inherited) return c.body(null, 204);
    await recordAdFreePurchase(c.env.DB, {
      store: body.store,
      transactionId: verdict.transactionId,
      profileId: verdict.accountMatched ? profileId : null,
      consentProfileId: profileId,
      test: verdict.test,
      now: nowIso(),
      metadata: verdict.metadata,
    });
    // Store entitlement/acknowledgement remains owned by the existing native purchase path.
    return c.body(null, 204);
  });
  app.post('/v1/iap/google/notifications', async (c) => {
    if (c.env.BILLING_ALERTS_ENABLED !== '1') return c.body(null, 503);
    if (!(await verifyPubsubToken(c.env, c.req.header('Authorization')))) return c.body(null, 401);
    const status = await handleGoogleRtdn(c.env, readJson(c), nowIso());
    return c.body(null, status as 204 | 400 | 503);
  });
  // T-11-215 App Store 서버 알림(V2). Apple 서버가 보낸다 — 세션 없이 본문의 Apple 서명으로 확인하고, 환불이면 아이템을 회수한다.
  // 처리했거나 다룰 일이 없으면 200(Apple이 다시 보내지 않는다), 서명이 틀리면 400.
  app.post(APPLE_IAP_NOTIFY_PATH, async (c) => {
    const body = readJson(c) as { signedPayload?: unknown } | null;
    const payload = typeof body?.signedPayload === 'string' ? body.signedPayload : '';
    const r = await handleAppleNotification(c.env, getDb(c), payload, nowIso());
    return c.body(null, r === 'invalid' ? 400 : 200);
  });

  app.post('/v1/items/iap', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const input = readBody(c, IapClaimBodySchema);
    if (!iapStores(c.env, me.id).includes(input.store)) throw unavailable();
    const db = getDb(c);
    // Google은 거래 id가 purchaseToken이라 확인 전에 원장을 본다 — 이미 받은 거래의 재전송은 Google을 부르지 않는다.
    if (input.store === 'google') {
      const owner = await iapOwnerOf(db, 'google', input.token);
      if (owner === me.id)
        return ok(c, OwnerItemsResponseSchema, await ownerItemsOf(db, me.id), 200, NO_STORE);
      if (owner) throw reject('OTHER_ACCOUNT');
    }
    const verdict = await verifyIapClaim(c.env, input, iapAccount(me.id), {
      nowS: Math.floor(Date.now() / 1000),
    }).catch((e: unknown) => {
      console.error(
        JSON.stringify({ job: 'iap-verify', store: input.store, error: String(e).slice(0, 200) }),
      );
      throw unavailable();
    });
    if (!verdict.ok) throw reject(verdict.reason);
    const product = IAP_PRODUCTS[input.productId];
    const items = await grantIapPurchase(db, {
      store: input.store,
      transactionId: verdict.transactionId,
      profileId: me.id,
      productId: input.productId,
      item: product.item,
      qty: product.qty * verdict.quantity,
      test: verdict.test,
      metadata: verdict.metadata,
      acquisitionEnabled: c.env.ACQUISITION_ENABLED === '1',
      now: nowIso(),
      ...(c.env.BILLING_ALERTS_ENABLED === '1'
        ? {
            alertId: await billingAlertId({
              store: input.store,
              transactionId: verdict.transactionId,
              kind: 'purchase',
              productId: input.productId,
              test: verdict.test,
            }),
          }
        : {}),
    });
    if (!items) throw reject('OTHER_ACCOUNT');
    if (c.env.BILLING_ALERTS_ENABLED === '1' && c.env.BILLING_QUEUE) {
      const id = await billingAlertId({
        store: input.store,
        transactionId: verdict.transactionId,
        kind: 'purchase',
        productId: input.productId,
        test: verdict.test,
      });
      waitUntil(
        c,
        c.env.BILLING_QUEUE.send({ version: 1, id }).catch(() => {
          console.error(JSON.stringify({ job: 'billing-enqueue', id }));
        }),
      );
    }
    if (verdict.after)
      waitUntil(
        c,
        verdict
          .after()
          .catch((e: unknown) =>
            console.error(JSON.stringify({ job: 'iap-ack', error: String(e).slice(0, 200) })),
          ),
      );
    return ok(c, OwnerItemsResponseSchema, items, 200, NO_STORE);
  });
}
