import {
  MembershipIapBodySchema,
  MembershipResponseSchema,
  type MembershipResponse,
} from '@offside/contracts';
import { memberActive } from '@offside/contracts/membership';
import type { Hono } from 'hono';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import { bindMembership, membershipOf } from '../db/repos/memberships.js';
import { waitUntil } from '../edgeCache.js';
import { getDb, type AppEnv, type Bindings } from '../env.js';
import { AppError } from '../errors.js';
import { verifyMembershipClaim, type MembershipRejection } from '../iap/membership.js';
import { iapAccount, iapStores } from '../iap/verify.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, NO_STORE, nowIso, ok, readBody } from './shared.js';

// T-11-512 클럽 멤버십. 로그인한 구단주만(아니면 403 GOOGLE_LOGIN_REQUIRED). 멤버십 화면을 열 때 · 앱이 구독 거래를 보낼 때만
// 부른다. 앱은 산 거래 · 앱 시작 때 스토어에 남은 구독을 보내고, 서버가 스토어 기준으로 확인해 구독 기간을 고친다(같은 거래를
// 다시 보내도 같은 결과). 갱신 · 만료 · 환불은 스토어 서버 알림으로도 고친다. 결제 알림 슬랙은 서버 알림이 남긴다.

const unavailable = () =>
  new AppError({ code: 'SERVICE_UNAVAILABLE', message: cupKo('iapUnavailable') });

const REJECT = {
  PENDING: ['iapPending', 'IAP_PENDING'],
  OTHER_ACCOUNT: ['iapOtherAccount', 'IAP_OTHER_ACCOUNT'],
  INVALID: ['iapInvalid', 'IAP_INVALID'],
} as const;
const reject = (r: MembershipRejection) => conflictError(cupKo(REJECT[r][0]), REJECT[r][1]);

/** 새로 가입받는지: 스위치가 켜져 있고 이 구단주가 살 수 있는 스토어가 있을 때. 이미 가입한 구독의 확인은 스위치와 상관없다. */
const storesFor = (env: Bindings, profileId: string) =>
  env.MEMBERSHIP_ENABLED === '1' ? iapStores(env, profileId) : [];

async function memberView(env: Bindings, db: Db, profileId: string): Promise<MembershipResponse> {
  const row = await membershipOf(db, profileId);
  const stores = storesFor(env, profileId);
  return {
    active: memberActive(row?.until, nowIso()),
    until: row?.until ?? null,
    autoRenew: row?.autoRenew ?? null,
    store: row?.store === 'apple' || row?.store === 'google' ? row.store : null,
    stores,
    ...(stores.length ? { account: iapAccount(profileId) } : {}),
  };
}

export function registerMembershipRoutes(app: Hono<AppEnv>) {
  app.get('/v1/membership', requireProfile, async (c) => {
    const me = await requireOwner(c);
    return ok(c, MembershipResponseSchema, await memberView(c.env, getDb(c), me.id), 200, NO_STORE);
  });

  app.post('/v1/membership/iap', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const input = readBody(c, MembershipIapBodySchema);
    if (input.store === 'google' && !c.env.GOOGLE_PLAY_SA_JSON) throw unavailable();
    const now = nowIso();
    const verdict = await verifyMembershipClaim(c.env, input, iapAccount(me.id), now).catch(
      (e: unknown) => {
        console.error(
          JSON.stringify({
            job: 'member-verify',
            store: input.store,
            error: String(e).slice(0, 200),
          }),
        );
        throw unavailable();
      },
    );
    if (!verdict.ok) throw reject(verdict.reason);
    const db = getDb(c);
    if (!(await bindMembership(db, me.id, verdict.chain, now))) throw reject('OTHER_ACCOUNT');
    if (verdict.after)
      waitUntil(
        c,
        verdict
          .after()
          .catch((e: unknown) =>
            console.error(JSON.stringify({ job: 'member-ack', error: String(e).slice(0, 200) })),
          ),
      );
    return ok(c, MembershipResponseSchema, await memberView(c.env, db, me.id), 200, NO_STORE);
  });
}
