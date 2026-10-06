/** Unregister removes token copies even while a transport request is in flight.
 * Record its eventual answer without recreating the queue, device or deleted account history. */
export function latePushResult(
  db: D1Database,
  table: 'push_deliveries' | 'push_news_deliveries',
  id: string,
  state: string,
  now: string,
) {
  return db
    .prepare(
      `UPDATE push_results SET state = CASE WHEN ? = 'accepted' THEN 'unknown' ELSE ? END,
    accepted_at = COALESCE(accepted_at, CASE WHEN ? IN ('accepted','confirmed') THEN ? END),
    confirmed_at = COALESCE(confirmed_at, CASE WHEN ? = 'confirmed' THEN ? END), updated_at = ?
    WHERE id = ? AND state IN ('unknown','cancelled') AND ? IN ('accepted','confirmed','failed')
    AND NOT EXISTS (SELECT 1 FROM ${table} q WHERE q.id = push_results.id)`,
    )
    .bind(state, state, state, now, state, now, now, id, state);
}
