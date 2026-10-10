/** Append to the match result batch: outcome, inventory and grant marker commit together. */
export function predictionSettlementStatements(d1: D1Database, matchId: string, now: string) {
  return [
    d1
      .prepare(
        `UPDATE cup_predictions SET correct = (pick = (
      SELECT CASE
        WHEN round IN ('g1', 'g2', 'g3') AND home_goals = away_goals THEN 'draw'
        WHEN winner_team_id = home_team_id THEN 'home'
        ELSE 'away' END
      FROM cup_matches WHERE id = ? AND played_at IS NOT NULL
    )), settled_at = ?
    WHERE match_id = ? AND settled_at IS NULL
      AND EXISTS (SELECT 1 FROM cup_matches WHERE id = ? AND played_at IS NOT NULL)`,
      )
      .bind(matchId, now, matchId, matchId),
    d1
      .prepare(
        `INSERT INTO owner_items (profile_id, item, qty, updated_at)
      SELECT profile_id, 'reroll', count(*), ? FROM cup_predictions
      WHERE match_id = ? AND correct = 1 AND rewarded_at IS NULL
        AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = cup_predictions.profile_id AND p.deleted_at IS NULL)
      GROUP BY profile_id
      ON CONFLICT (profile_id, item) DO UPDATE SET qty = qty + excluded.qty, updated_at = excluded.updated_at`,
      )
      .bind(now, matchId),
    d1
      .prepare(
        `UPDATE cup_predictions SET rewarded_at = ?
      WHERE match_id = ? AND correct = 1 AND rewarded_at IS NULL
        AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = cup_predictions.profile_id AND p.deleted_at IS NULL)`,
      )
      .bind(now, matchId),
  ];
}
