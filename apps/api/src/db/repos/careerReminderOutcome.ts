/** Observed activity within seven days of the latest accepted reminder, not causal lift.
 * Server time, authenticated account, immutable first timestamps; no click is required.
 */
export async function recordCareerReminderOutcome(
  db: D1Database,
  profileId: string,
  retired: boolean,
  now: string,
) {
  await db
    .prepare(
      `UPDATE career_reminder_outcomes SET
    returned_at=COALESCE(returned_at,?),
    retired_at=CASE WHEN ?=1 THEN COALESCE(retired_at,?) ELSE retired_at END
    WHERE notification_id=(SELECT n.id FROM notifications n
      JOIN career_reminder_outcomes o ON o.notification_id=n.id
      WHERE n.profile_id=? AND n.created_at>=? AND n.created_at<=?
      AND EXISTS (SELECT 1 FROM push_results r WHERE r.notification_id=n.id AND r.accepted_at>=? AND r.accepted_at<=?)
      ORDER BY n.created_at DESC,n.id DESC LIMIT 1)`,
    )
    .bind(
      now,
      retired ? 1 : 0,
      now,
      profileId,
      new Date(Date.parse(now) - 8 * 86400_000).toISOString(),
      now,
      new Date(Date.parse(now) - 7 * 86400_000).toISOString(),
      now,
    )
    .run();
}
