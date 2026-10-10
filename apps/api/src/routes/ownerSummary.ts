import { OwnerSummaryResponseSchema, OwnerRecapStatusSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { commentIdentity } from '../auth/admin.js';
import { listOwnSummary } from '../db/repos/careers.js';
import { getProfile, isLinked } from '../db/repos/profiles.js';
import { lastClosedSeason } from '@offside/contracts/service-seasons';
import { ownerTierOfProfile, ownerTierHistoryOfProfile } from '../db/repos/ownerTiers.js';
import { getDb, type AppEnv } from '../env.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { nowIso, ok } from './shared.js';

export function registerOwnerSummaryRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/owner/recap-status', requireProfile, async (c) => {
    const tier = await ownerTierOfProfile(getDb(c), getSessionOrThrow(c).profileId, nowIso());
    return ok(c, OwnerRecapStatusSchema, { tier }, 200, 'private, no-store');
  });
  app.get('/v1/owner/summary', requireProfile, async (c) => {
    const db = getDb(c);
    const { profileId } = getSessionOrThrow(c);
    const profile = await getProfile(db, profileId);
    const linked = !!profile && isLinked(profile);
    const now = nowIso();
    const [entries, tiers] = linked
      ? await Promise.all([
          listOwnSummary(db, profileId),
          ownerTierHistoryOfProfile(db, profileId, now),
        ])
      : [[], []];
    return ok(
      c,
      OwnerSummaryResponseSchema,
      {
        linked,
        entries,
        tier: tiers.find((t) => t.season === lastClosedSeason(now)) ?? null,
        tiers,
        admin: commentIdentity(profile, c.env.ADMIN_EMAILS).admin,
      },
      200,
      'private, no-store',
    );
  });
}
