import {
  OWNER_ITEMS,
  StarterPackIapBodySchema,
  StarterPackIapResponseSchema,
  StarterPackResponseSchema,
  type OwnerItem,
  type StarterPackResponse,
} from '@offside/contracts';
import {
  STARTER_PACK_PRODUCT_ID,
  STARTER_PACK_VERSION,
  starterPackItems,
} from '@offside/contracts/starter-pack';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import {
  grantStarterPack,
  starterEligibilityOf,
  starterOfTransaction,
} from '../db/repos/starterPack.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv, type Bindings } from '../env.js';
import { AppError } from '../errors.js';
import { recordBillingAlert } from '../iap/alerts.js';
import { acknowledgeAfterGrant } from '../iap/acknowledgement.js';
import { iapAccount, iapStores, verifyIapClaim, type IapRejection } from '../iap/verify.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from '../middleware/requireOwner.js';
import { conflictError, NO_STORE, nowIso, ok, readBody } from './shared.js';

// T-11-770d 첫 구매 묶음(기획 T-11-747 R2). 로그인한 구단주만. 화면(상점 · 은퇴 뒤 카드)이 열릴 때 한 번 자격을 읽고(구단주마다
// 달라 캐시하지 않는다), 앱이 산 거래를 보내면 스토어 기준으로 확인해 세 가지 아이템을 한 번에 준다. 같은 거래를 다시 보내면
// 같은 결과다(앱은 이 응답을 받은 뒤에만 스토어 거래를 마무리한다). 판매를 닫아도(STARTER_PACK_ENABLED) 이미 승인된 거래는
// 받는다: 스위치는 새 노출 · 새 결제만 멈춘다.

const unavailable = () =>
  new AppError({ code: 'SERVICE_UNAVAILABLE', message: cupKo('iapUnavailable') });

const REJECT = {
  PENDING: ['iapPending', 'IAP_PENDING'],
  OTHER_ACCOUNT: ['iapOtherAccount', 'IAP_OTHER_ACCOUNT'],
  INVALID: ['iapInvalid', 'IAP_INVALID'],
} as const;
const reject = (r: IapRejection) => conflictError(cupKo(REJECT[r][0]), REJECT[r][1]);

const itemsOf = (version: string): Record<OwnerItem, number> => {
  const reward = starterPackItems(version);
  return Object.fromEntries(OWNER_ITEMS.map((k) => [k, reward[k] ?? 0])) as Record<
    OwnerItem,
    number
  >;
};

async function packView(env: Bindings, db: Db, profileId: string): Promise<StarterPackResponse> {
  const base = { version: STARTER_PACK_VERSION, items: itemsOf(STARTER_PACK_VERSION) };
  const eligibility = await starterEligibilityOf(db, profileId);
  if (eligibility === 'owned') return { ...base, state: 'owned', stores: [] };
  const stores = env.STARTER_PACK_ENABLED === '1' ? iapStores(env, profileId) : [];
  if (!stores.length) return { ...base, state: 'off', stores: [] };
  if (eligibility !== 'eligible') return { ...base, state: 'ineligible', stores: [] };
  return { ...base, state: 'eligible', stores, account: iapAccount(profileId) };
}

export function registerStarterPackRoutes(app: Hono<AppEnv>) {
  app.get('/v1/starter-pack', requireProfile, async (c) => {
    const me = await requireOwner(c);
    return ok(c, StarterPackResponseSchema, await packView(c.env, getDb(c), me.id), 200, NO_STORE);
  });

  app.post('/v1/starter-pack/iap', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const input = readBody(c, StarterPackIapBodySchema);
    const db = getDb(c);
    const done = async (have: Record<OwnerItem, number>) =>
      ok(
        c,
        StarterPackIapResponseSchema,
        { pack: await packView(c.env, db, me.id), have },
        200,
        NO_STORE,
      );
    if (!iapStores(c.env, me.id).includes(input.store)) throw unavailable();
    // Google은 거래 id가 purchaseToken이라 확인 전에 원장을 본다. 다른 구단주가 받은 거래는 스토어를 부르지 않고 거절한다.
    if (input.store === 'google') {
      const seen = await starterOfTransaction(db, 'google', input.token);
      if (seen && seen.profileId !== me.id) throw reject('OTHER_ACCOUNT');
    }
    const verdict = await verifyIapClaim(
      c.env,
      { ...input, productId: STARTER_PACK_PRODUCT_ID },
      iapAccount(me.id),
      { nowS: Math.floor(Date.now() / 1000) },
    ).catch((e: unknown) => {
      console.error(
        JSON.stringify({
          job: 'starter-verify',
          store: input.store,
          error: String(e).slice(0, 200),
        }),
      );
      throw unavailable();
    });
    if (!verdict.ok) throw reject(verdict.reason);
    const now = nowIso();
    const have = await grantStarterPack(db, {
      store: input.store,
      transactionId: verdict.transactionId,
      profileId: me.id,
      version: STARTER_PACK_VERSION,
      test: verdict.test,
      now,
      grantId: crypto.randomUUID(),
      metadata: verdict.metadata,
    });
    if (!have) throw reject('OTHER_ACCOUNT');
    const alert = {
      store: input.store,
      transactionId: verdict.transactionId,
      kind: 'purchase' as const,
      productId: STARTER_PACK_PRODUCT_ID,
      test: verdict.test,
    };
    waitUntil(
      c,
      recordBillingAlert(c.env, alert, now).catch(() => {}),
    );
    if (verdict.after)
      waitUntil(c, acknowledgeAfterGrant(verdict.after, { job: 'starter-ack', ...alert }));
    return done(have);
  });
}
