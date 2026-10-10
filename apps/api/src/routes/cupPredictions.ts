import {
  CupPredictionsResponseSchema,
  CupPredictionMeResponseSchema,
  PutCupPredictionBodySchema,
  CupPredictionCountsSchema,
  type CupPredictionCounts,
} from '@offside/contracts';
import type { CupDef } from '@offside/contracts/cup';
import { and, eq } from 'drizzle-orm';
import type { Context, Hono } from 'hono';
import { cupPredictions } from '../db/schema.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { cupKo } from '../cupText.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { requireOwner } from './ownerTeam.js';
import { conflictError, nowIso, ok, readBody, NO_STORE } from './shared.js';

export function registerCupPredictionRoutes(
  app: Hono<AppEnv>,
  cupOf: (c: Context<AppEnv>) => Promise<CupDef>,
) {
  app.get('/v1/cups/:cupId/predictions', async (c) => {
    const cup = await cupOf(c);
    const data = await edgeCached(c, `/v1/cups/${cup.id}/predictions`, 30, async () => {
      const { results } = await getDb(c)
        .$client.prepare(
          `SELECT match_id AS matchId,
        sum(pick = 'home') AS home, sum(pick = 'draw') AS draw, sum(pick = 'away') AS away
        FROM cup_predictions WHERE cup_id = ? GROUP BY match_id`,
        )
        .bind(cup.id)
        .all<CupPredictionCounts>();
      return { items: results };
    });
    return ok(c, CupPredictionsResponseSchema, data, 200, 'public, max-age=0, s-maxage=30');
  });

  app.get('/v1/cups/:cupId/predictions/me', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const cup = await cupOf(c);
    const rows = await getDb(c)
      .select()
      .from(cupPredictions)
      .where(and(eq(cupPredictions.cupId, cup.id), eq(cupPredictions.profileId, me.id)));
    return ok(
      c,
      CupPredictionMeResponseSchema,
      {
        items: rows.map((r) => ({
          matchId: r.matchId,
          pick: r.pick,
          correct: r.correct,
          rewarded: r.rewardedAt !== null,
        })),
      },
      200,
      NO_STORE,
    );
  });

  app.put('/v1/cups/:cupId/matches/:matchId/prediction', requireProfile, async (c) => {
    const me = await requireOwner(c);
    const cup = await cupOf(c);
    const { pick } = readBody(c, PutCupPredictionBodySchema);
    const now = nowIso();
    // Deadline and editable-state checks are in the write itself, including ON CONFLICT.
    const r = await getDb(c)
      .$client.prepare(
        `INSERT INTO cup_predictions
      (cup_id, match_id, profile_id, pick, created_at, updated_at)
      SELECT cup_id, id, ?, ?, ?, ? FROM cup_matches
      WHERE cup_id = ? AND id = ? AND played_at IS NULL AND at > ?
        AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
        AND (? <> 'draw' OR round IN ('g1', 'g2', 'g3'))
        AND EXISTS (SELECT 1 FROM profiles WHERE id = ? AND deleted_at IS NULL)
      ON CONFLICT (match_id, profile_id) DO UPDATE SET pick = excluded.pick, updated_at = excluded.updated_at
      WHERE cup_predictions.settled_at IS NULL`,
      )
      .bind(me.id, pick, now, now, cup.id, c.req.param('matchId'), now, pick, me.id)
      .run();
    if (!r.meta.changes) throw conflictError(cupKo('predictionClosed'), 'CUP_PREDICTION_CLOSED');
    purgeEdge(c, [`/v1/cups/${cup.id}/predictions`]);
    const counts = await getDb(c)
      .$client.prepare(
        `SELECT ? AS matchId,
      coalesce(sum(pick = 'home'), 0) AS home, coalesce(sum(pick = 'draw'), 0) AS draw,
      coalesce(sum(pick = 'away'), 0) AS away FROM cup_predictions WHERE cup_id = ? AND match_id = ?`,
      )
      .bind(c.req.param('matchId'), cup.id, c.req.param('matchId'))
      .first<CupPredictionCounts>();
    return ok(c, CupPredictionCountsSchema, counts!, 200, NO_STORE);
  });
}
