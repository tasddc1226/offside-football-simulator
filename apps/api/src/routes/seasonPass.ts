import {
  SeasonPassClaimBodySchema,
  SeasonPassClaimResponseSchema,
  SeasonPassIapBodySchema,
  SeasonPassResponseSchema,
  type SeasonPassResponse,
} from '@offside/contracts';
import { SEASON_PASS_PRODUCT_ID } from '@offside/contracts/season-pass';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import {
  claimSeasonPass,
  openSeasonPass,
  passOfTransaction,
  seasonPassesOf,
} from '../db/repos/seasonPass.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv, type Bindings } from '../env.js';
import { AppError } from '../errors.js';
import { recordBillingAlert } from '../iap/alerts.js';
import { iapAccount, iapStores, verifyIapClaim, type IapRejection } from '../iap/verify.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-511 시즌 패스. 로그인한 구단주만(아니면 403 GOOGLE_LOGIN_REQUIRED). 화면을 열 때 한 번 읽고(구단주마다 달라 캐시하지
// 않는다), 앱이 산 거래를 보내면 스토어 기준으로 확인해 패스를 연다 — 같은 거래를 다시 보내면 같은 결과다(앱은 이 응답을 받은
// 뒤에만 스토어 거래를 마무리한다). 보상은 '받기'를 누를 때 열린 단계를 한꺼번에 준다.

const unavailable = () =>
  new AppError({ code: 'SERVICE_UNAVAILABLE', message: cupKo('iapUnavailable') });

const REJECT = {
  PENDING: ['iapPending', 'IAP_PENDING'],
  OTHER_ACCOUNT: ['iapOtherAccount', 'IAP_OTHER_ACCOUNT'],
  INVALID: ['iapInvalid', 'IAP_INVALID'],
} as const;
const reject = (r: IapRejection) => conflictError(cupKo(REJECT[r][0]), REJECT[r][1]);

/** 새로 파는지: 스위치가 켜져 있고 이 구단주가 살 수 있는 스토어가 있을 때. */
const storesFor = (env: Bindings, profileId: string) =>
  env.SEASON_PASS_ENABLED === '1' ? iapStores(env, profileId) : [];

async function passView(env: Bindings, db: Db, profileId: string): Promise<SeasonPassResponse> {
  const stores = storesFor(env, profileId);
  return {
    onSale: stores.length > 0,
    stores,
    ...(stores.length ? { account: iapAccount(profileId) } : {}),
    seasons: await seasonPassesOf(db, profileId, nowIso()),
  };
}

export function registerSeasonPassRoutes(app: Hono<AppEnv>) {
  app.get('/v1/season-pass', requireProfile, async (c) => {
    const me = await requireOwner(c);
    return ok(c, SeasonPassResponseSchema, await passView(c.env, getDb(c), me.id), 200, NO_STORE);
  });

  app.post('/v1/season-pass/iap', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const input = readBody(c, SeasonPassIapBodySchema);
    const db = getDb(c);
    // 이미 연 거래의 재전송은 스토어를 부르지 않는다(Google은 거래 id가 purchaseToken이다). 판매를 닫아도 산 거래는 받는다.
    if (input.store === 'google') {
      const seen = await passOfTransaction(db, 'google', input.token);
      if (seen?.profileId === me.id)
        return ok(c, SeasonPassResponseSchema, await passView(c.env, db, me.id), 200, NO_STORE);
      if (seen) throw reject('OTHER_ACCOUNT');
    }
    if (!iapStores(c.env, me.id).includes(input.store)) throw unavailable();
    const verdict = await verifyIapClaim(
      c.env,
      { ...input, productId: SEASON_PASS_PRODUCT_ID },
      iapAccount(me.id),
      { nowS: Math.floor(Date.now() / 1000) },
    ).catch((e: unknown) => {
      console.error(
        JSON.stringify({ job: 'pass-verify', store: input.store, error: String(e).slice(0, 200) }),
      );
      throw unavailable();
    });
    if (!verdict.ok) throw reject(verdict.reason);
    const now = nowIso();
    const opened = await openSeasonPass(db, {
      profileId: me.id,
      store: input.store,
      transactionId: verdict.transactionId,
      test: verdict.test,
      purchasedAt: verdict.metadata.purchasedAt,
      now,
    });
    if (!opened) throw reject('OTHER_ACCOUNT');
    waitUntil(
      c,
      recordBillingAlert(
        c.env,
        {
          store: input.store,
          transactionId: verdict.transactionId,
          kind: 'purchase',
          productId: SEASON_PASS_PRODUCT_ID,
          test: verdict.test,
        },
        now,
      ).catch(() => {}),
    );
    if (verdict.after)
      waitUntil(
        c,
        verdict
          .after()
          .catch((e: unknown) =>
            console.error(JSON.stringify({ job: 'pass-ack', error: String(e).slice(0, 200) })),
          ),
      );
    return ok(c, SeasonPassResponseSchema, await passView(c.env, db, me.id), 200, NO_STORE);
  });

  app.post('/v1/season-pass/claim', requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const { season } = readBody(c, SeasonPassClaimBodySchema);
    const db = getDb(c);
    const granted = await claimSeasonPass(db, me.id, season, nowIso());
    if (!granted) throw notFoundError(cupKo('passMissing'), 'PASS_MISSING');
    return ok(
      c,
      SeasonPassClaimResponseSchema,
      { pass: await passView(c.env, db, me.id), granted },
      200,
      NO_STORE,
    );
  });
}
