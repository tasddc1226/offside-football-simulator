import { IAP_PRODUCTS, IapClaimBodySchema, OwnerItemsResponseSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import { grantIapPurchase, iapOwnerOf, ownerItemsOf } from '../db/repos/iap.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { iapAccount, iapStores, verifyIapClaim, type IapRejection } from '../iap/verify.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, nowIso, ok, readBody } from './shared.js';

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
  app.post('/v1/items/iap', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const input = readBody(c, IapClaimBodySchema);
    if (!iapStores(c.env).includes(input.store)) throw unavailable();
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
      now: nowIso(),
    });
    if (!items) throw reject('OTHER_ACCOUNT');
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
