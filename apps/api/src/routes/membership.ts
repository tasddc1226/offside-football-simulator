import {
  MembershipClaimSchema,
  MembershipResponseSchema,
  MemberAppearanceSchema,
} from '@offside/contracts/membership';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { getDb, type AppEnv } from '../env.js';
import { ownerMemberships } from '../db/schema.js';
import { membershipOf } from '../db/repos/membership.js';
import { ownerItemsOf } from '../db/repos/iap.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { NO_STORE, nowIso, ok, readBody, conflictError } from './shared.js';
import { claimMembership, memberStores } from '../membership/service.js';
import { MemberVerificationError } from '../membership/types.js';
import { AppError } from '../errors.js';
import { iapAccount } from '../iap/verify.js';
import { verifyGooglePush } from '../membership/googlePushAuth.js';
import { handleGoogleMemberNotification } from '../membership/googleNotifications.js';
import { cupKo } from '../cupText.js';

export function registerMembershipRoutes(app: Hono<AppEnv>) {
  app.post('/v1/membership/google/notifications', async (c) => {
    if (!c.env.GOOGLE_MEMBERSHIP_PUSH_AUDIENCE || !c.env.GOOGLE_MEMBERSHIP_PUSH_EMAIL)
      return c.body(null, 503);
    const authorization = c.req.header('authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return c.body(null, 401);
    try {
      await verifyGooglePush(authorization.slice(7), {
        audience: c.env.GOOGLE_MEMBERSHIP_PUSH_AUDIENCE,
        email: c.env.GOOGLE_MEMBERSHIP_PUSH_EMAIL,
        now: Date.now(),
      });
    } catch {
      return c.body(null, 401);
    }
    const result = await handleGoogleMemberNotification(
      c.env,
      getDb(c),
      await c.req.json().catch(() => null),
      nowIso(),
    );
    return c.body(null, result === 'invalid' ? 400 : 204);
  });
  app.get('/v1/membership', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const [membership, items] = await Promise.all([
      membershipOf(db, me.id, nowIso()),
      ownerItemsOf(db, me.id),
    ]);
    const stores = memberStores(c.env, me.id);
    return ok(
      c,
      MembershipResponseSchema,
      {
        membership: { ...membership, salesEnabled: stores.length > 0 },
        account: iapAccount(me.id),
        stores,
        items,
      },
      200,
      NO_STORE,
    );
  });
  app.post('/v1/membership/claim', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const input = readBody(c, MembershipClaimSchema);
    const db = getDb(c);
    try {
      await claimMembership(c.env, db, me.id, input.store, input.token, nowIso());
    } catch (e) {
      if (
        e instanceof MemberVerificationError &&
        ['INVALID', 'OTHER_ACCOUNT', 'PENDING'].includes(e.reason)
      )
        throw conflictError(
          cupKo(
            e.reason === 'OTHER_ACCOUNT'
              ? 'iapOtherAccount'
              : e.reason === 'PENDING'
                ? 'iapPending'
                : 'iapInvalid',
          ),
          `MEMBERSHIP_${e.reason}`,
        );
      // Never serialize upstream exceptions: their URLs can include a purchase token.
      console.error(
        JSON.stringify({
          job: 'membership-claim',
          store: input.store,
          code: e instanceof MemberVerificationError ? e.reason : 'INTERNAL',
        }),
      );
      throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: cupKo('iapUnavailable') });
    }
    const [membership, items] = await Promise.all([
      membershipOf(db, me.id, nowIso()),
      ownerItemsOf(db, me.id),
    ]);
    const stores = memberStores(c.env, me.id);
    return ok(
      c,
      MembershipResponseSchema,
      {
        membership: { ...membership, salesEnabled: stores.length > 0 },
        account: iapAccount(me.id),
        stores,
        items,
      },
      200,
      NO_STORE,
    );
  });
  app.put('/v1/membership/appearance', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const input = readBody(c, MemberAppearanceSchema.omit({ supporterTitle: true }));
    if (!(await membershipOf(db, me.id, nowIso())).active)
      throw conflictError(cupKo('titleNotOwned'), 'MEMBERSHIP_INACTIVE');
    await db.update(ownerMemberships).set(input).where(eq(ownerMemberships.profileId, me.id));
    const membership = await membershipOf(db, me.id, nowIso());
    const stores = memberStores(c.env, me.id);
    return ok(
      c,
      MembershipResponseSchema,
      {
        membership: { ...membership, salesEnabled: stores.length > 0 },
        account: iapAccount(me.id),
        stores,
        items: await ownerItemsOf(db, me.id),
      },
      200,
      NO_STORE,
    );
  });
}
