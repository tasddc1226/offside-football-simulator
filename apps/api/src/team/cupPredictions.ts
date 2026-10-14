// T-11-249 대회 상한(cap): 이미 리롤권을 받은 예측이 cap개면 더 주지 않고 rewarded_at도 비워 둔다(받지 않은 것으로 보인다).
// 한 사람은 경기마다 예측이 하나라 정산 한 번에 한 장까지 늘어난다. null이면 상한 없음(제1회).
const UNDER_CAP = `(?3 IS NULL OR (SELECT count(*) FROM cup_predictions q
  WHERE q.cup_id = cup_predictions.cup_id AND q.profile_id = cup_predictions.profile_id
    AND q.rewarded_at IS NOT NULL) < ?3)`;

/** Append to the match result batch: outcome, inventory and grant marker commit together. */
export function predictionSettlementStatements(
  d1: D1Database,
  matchId: string,
  now: string,
  cap: number | null,
) {
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
      SELECT profile_id, 'reroll', count(*), ?1 FROM cup_predictions
      WHERE match_id = ?2 AND correct = 1 AND rewarded_at IS NULL
        AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = cup_predictions.profile_id AND p.deleted_at IS NULL)
        AND ${UNDER_CAP}
      GROUP BY profile_id
      ON CONFLICT (profile_id, item) DO UPDATE SET qty = qty + excluded.qty, updated_at = excluded.updated_at`,
      )
      .bind(now, matchId, cap),
    d1
      .prepare(
        `UPDATE cup_predictions SET rewarded_at = ?1
      WHERE match_id = ?2 AND correct = 1 AND rewarded_at IS NULL
        AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = cup_predictions.profile_id AND p.deleted_at IS NULL)
        AND ${UNDER_CAP}`,
      )
      .bind(now, matchId, cap),
  ];
}
