import {
  AdminCupPredictionsSchema,
  AdminCupPredictionRowsSchema,
  AdminCupPredictionRecoverySchema,
  AdminCupPredictionRecoveryResultSchema,
} from '@offside/contracts';
import { and, eq } from 'drizzle-orm';
import type { Hono, Context } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import { getDb, type AppEnv } from '../env.js';
import { cups, cupEntries, cupMatches } from '../db/schema.js';
import { newId } from '../db/ids.js';
import { cupMatchesOf } from '../team/cup.js';
import { predictionSettlementStatements } from '../team/cupPredictions.js';
import { toCupMatch } from './cup.js';
import { cupKo } from '../cupText.js';
import { conflictError, notFoundError, NO_STORE, nowIso, ok, readBody } from './shared.js';

async function cupExists(c: Context<AppEnv>) {
  const db = getDb(c);
  const [cup] = await db
    .select({ id: cups.id })
    .from(cups)
    .where(eq(cups.id, c.req.param('cupId')!));
  if (!cup) throw notFoundError(cupKo('notFound'), 'CUP_NOT_FOUND');
  return cup.id;
}
async function matchOf(c: Context<AppEnv>) {
  const [match] = await getDb(c)
    .select()
    .from(cupMatches)
    .where(
      and(eq(cupMatches.cupId, c.req.param('cupId')!), eq(cupMatches.id, c.req.param('matchId')!)),
    );
  if (!match) throw notFoundError(cupKo('notFound'), 'CUP_MATCH_NOT_FOUND');
  return match;
}
export function registerAdminCupPredictionRoutes(app: Hono<AppEnv>) {
  app.get('/v1/admin/cups/:cupId/predictions', async (c) => {
    await requireAdmin(c);
    const cupId = await cupExists(c);
    const db = getDb(c);
    const [matches, entries, aggregates, people] = await Promise.all([
      cupMatchesOf(db, cupId),
      db
        .select({ teamId: cupEntries.teamId, name: cupEntries.name })
        .from(cupEntries)
        .where(eq(cupEntries.cupId, cupId)),
      db.$client
        .prepare(
          `SELECT match_id AS matchId, count(*) AS total,
        sum(pick='home') AS home, sum(pick='draw') AS draw, sum(pick='away') AS away,
        sum(correct=1) AS hits, sum(rewarded_at IS NOT NULL) AS granted,
        sum(settled_at IS NULL) AS pending,
        sum(correct=1 AND rewarded_at IS NULL) AS unpaid
        FROM cup_predictions WHERE cup_id=? GROUP BY match_id`,
        )
        .bind(cupId)
        .all<{
          matchId: string;
          total: number;
          home: number;
          draw: number;
          away: number;
          hits: number;
          granted: number;
          pending: number;
          unpaid: number;
        }>(),
      db.$client
        .prepare('SELECT count(DISTINCT profile_id) AS n FROM cup_predictions WHERE cup_id=?')
        .bind(cupId)
        .first<{ n: number }>(),
    ]);
    const names = new Map(entries.map((e) => [e.teamId, e.name]));
    const counts = new Map(aggregates.results.map((r) => [r.matchId, r]));
    return ok(
      c,
      AdminCupPredictionsSchema,
      {
        cupId,
        participants: people?.n ?? 0,
        items: matches
          .sort((a, b) => a.at.localeCompare(b.at) || a.grp - b.grp || a.slot - b.slot)
          .map((m) => {
            const r = counts.get(m.id);
            return {
              match: toCupMatch(m),
              homeName: names.get(m.homeTeamId ?? '') ?? m.homeTeamId ?? '',
              awayName: names.get(m.awayTeamId ?? '') ?? m.awayTeamId ?? '',
              total: r?.total ?? 0,
              home: r?.home ?? 0,
              draw: r?.draw ?? 0,
              away: r?.away ?? 0,
              hits: r?.hits ?? 0,
              granted: r?.granted ?? 0,
              pending: r?.pending ?? 0,
              unpaid: r?.unpaid ?? 0,
            };
          }),
      },
      200,
      NO_STORE,
    );
  });
  app.get('/v1/admin/cups/:cupId/matches/:matchId/predictions', async (c) => {
    await requireAdmin(c);
    const m = await matchOf(c);
    // PK(match_id, profile_id) provides stable, indexed cursor pagination.
    const after = (c.req.query('after') ?? '').slice(0, 100);
    const { results } = await getDb(c)
      .$client.prepare(
        `SELECT p.profile_id AS profileId,
      coalesce(u.nickname, p.profile_id) AS nickname, p.pick, p.correct,
      p.settled_at AS settledAt, p.rewarded_at AS rewardedAt, p.updated_at AS updatedAt
      FROM cup_predictions p JOIN profiles u ON u.id=p.profile_id
      WHERE p.match_id=? AND p.cup_id=? AND p.profile_id>? ORDER BY p.profile_id LIMIT 51`,
      )
      .bind(m.id, m.cupId, after)
      .all<{
        profileId: string;
        nickname: string;
        pick: 'home' | 'draw' | 'away';
        correct: number | null;
        settledAt: string | null;
        rewardedAt: string | null;
        updatedAt: string;
      }>();
    return ok(
      c,
      AdminCupPredictionRowsSchema,
      {
        items: results
          .slice(0, 50)
          .map((r) => ({ ...r, correct: r.correct === null ? null : !!r.correct })),
        next: results.length > 50 ? results[49]!.profileId : null,
      },
      200,
      NO_STORE,
    );
  });
  app.post('/v1/admin/cups/:cupId/matches/:matchId/predictions/settle', async (c) => {
    const actor = await requireAdmin(c);
    const { reason } = readBody(c, AdminCupPredictionRecoverySchema);
    const m = await matchOf(c);
    if (!m.playedAt) throw conflictError(cupKo('predictionNotFinished'), 'CUP_MATCH_NOT_FINISHED');
    const now = nowIso();
    const d1 = getDb(c).$client;
    // Same atomic settlement as the match runner; prior grant markers prevent duplicate inventory.
    const results = await d1.batch([
      ...predictionSettlementStatements(d1, m.id, now),
      d1
        .prepare(
          'INSERT INTO audit_log (id,kind,profile_id,payload_json,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(
          newId('aud'),
          'CUP_PREDICTIONS_RECOVERED',
          actor.profileId,
          JSON.stringify({ cupId: m.cupId, matchId: m.id, reason }),
          now,
        ),
    ]);
    return ok(
      c,
      AdminCupPredictionRecoveryResultSchema,
      { settled: results[0]!.meta.changes, rewarded: results[2]!.meta.changes },
      200,
      NO_STORE,
    );
  });
}
