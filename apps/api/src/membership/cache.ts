import type { Db } from '../db/client.js';
import type { Bindings } from '../env.js';
import { EDGE } from '../edgeKeys.js';
import { purgeEdgeOrigin } from '../edgeCache.js';
/** Match title-selection invalidation; other rank pages expire within their existing short TTL. */
export async function purgeMemberRanks(env: Bindings, db: Db, profileId: string) {
  if (!env.GOOGLE_REDIRECT_URI) return;
  const { results } = await db.$client
    .prepare('SELECT season FROM owner_teams WHERE profile_id=?')
    .bind(profileId)
    .all<{ season: number }>();
  await purgeEdgeOrigin(
    new URL(env.GOOGLE_REDIRECT_URI).origin,
    results.flatMap(({ season }) => [
      ...['rating', 'ovr', 'value'].map((sort) => EDGE.teamRank(season, sort, 1)),
      EDGE.achRank(season, 1),
    ]),
  );
}
