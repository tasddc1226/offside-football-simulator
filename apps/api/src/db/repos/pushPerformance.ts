import type { PushPerformanceQuery, PushPerformance } from '@offside/contracts';
import { kstDay } from '@offside/contracts/kst';

/** The app reports OS responses only. Inbox read/detail never records a push click. */
export async function recordPushInteraction(
  db: D1Database,
  profileId: string,
  id: string,
  event: 'click' | 'target_open',
  now: string,
) {
  if (event === 'click') {
    await db
      .prepare(
        `INSERT OR IGNORE INTO push_interactions (notification_id, clicked_at)
      SELECT n.id, ? FROM notifications n WHERE n.id = ? AND n.profile_id = ? AND n.expires_at > ?
      AND EXISTS (SELECT 1 FROM push_results r WHERE r.notification_id = n.id
        AND (r.accepted_at IS NOT NULL OR r.state IN ('sending','unknown')))`,
      )
      .bind(now, id, profileId, now)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE push_interactions SET target_opened_at = ?
      WHERE notification_id = ? AND target_opened_at IS NULL AND clicked_at >= ? AND clicked_at <= ?
      AND EXISTS (SELECT 1 FROM notifications n WHERE n.id = notification_id AND n.profile_id = ? AND n.expires_at > ?)`,
      )
      .bind(now, id, new Date(Date.parse(now) - 86400_000).toISOString(), now, profileId, now)
      .run();
  }
}

// One row per notification/recipient, then aggregate delivery counts separately from unique clicks.
const CTE = `WITH cohort AS (
  SELECT n.*,
    CASE WHEN n.kind = 'news' THEN json_extract(n.target_json, '$.board')
      WHEN n.source_key LIKE 'friend-request:%' THEN 'friend-request'
      WHEN n.source_key LIKE 'friend-accepted:%' THEN 'friend-accepted'
      WHEN n.source_key LIKE 'friendly:%' THEN 'friendly' ELSE n.kind END AS category,
    CASE WHEN n.kind = 'news' THEN n.source_key ELSE n.id END AS campaign
  FROM notifications n WHERE n.created_at >= ? AND n.created_at <= ? AND (? = 1 OR n.kind <> 'test')
), facts AS (
  SELECT n.id, n.category, n.campaign, n.title, n.created_at,
    COUNT(r.id) AS queued,
    SUM(CASE WHEN r.state IN ('pending','sending','accepted','checking') THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN r.accepted_at IS NOT NULL THEN 1 ELSE 0 END) AS accepted,
    SUM(CASE WHEN r.confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS confirmed,
    SUM(CASE WHEN r.state = 'failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN r.state = 'unknown' THEN 1 ELSE 0 END) AS unknown,
    SUM(CASE WHEN r.state = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
    1 AS recipients,
    MAX(CASE WHEN r.accepted_at IS NOT NULL THEN 1 ELSE 0 END) AS acceptedRecipients,
    MAX(CASE WHEN r.accepted_at IS NOT NULL AND i.clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS clicked,
    MAX(CASE WHEN r.accepted_at IS NOT NULL AND i.target_opened_at IS NOT NULL THEN 1 ELSE 0 END) AS targetOpened
  FROM cohort n JOIN push_results r ON r.notification_id = n.id
  LEFT JOIN push_interactions i ON i.notification_id = n.id GROUP BY n.id
)`;
const KEYS = [
  'queued',
  'pending',
  'accepted',
  'confirmed',
  'failed',
  'unknown',
  'cancelled',
  'recipients',
  'acceptedRecipients',
  'clicked',
  'targetOpened',
] as const;
const COUNTS = KEYS.map((key) => `COALESCE(SUM(${key}), 0) AS ${key}`).join(', ');

/** Indexed, bounded cohort (KST calendar days). Open-on-demand, four aggregate queries, no N+1. */
export async function getPushPerformance(
  db: D1Database,
  query: PushPerformanceQuery,
  at = new Date(),
): Promise<PushPerformance> {
  const now = at.toISOString();
  const through = query.through && query.through < now ? query.through : now;
  const today = `${kstDay(through)}T00:00:00+09:00`;
  const from = new Date(Date.parse(today) - (Number(query.days) - 1) * 86400_000).toISOString();
  const statement = (sql: string) =>
    db.prepare(`${CTE} ${sql}`).bind(from, through, query.tests === '1' ? 1 : 0);
  const [totals, categories, daily, campaigns, start] = await db.batch([
    statement(`SELECT ${COUNTS} FROM facts`),
    statement(`SELECT category, ${COUNTS} FROM facts GROUP BY category ORDER BY category`),
    statement(
      `SELECT substr(datetime(created_at, '+9 hours'), 1, 10) AS day, ${COUNTS} FROM facts GROUP BY day ORDER BY day`,
    ),
    statement(`SELECT campaign AS id, category, MIN(title) AS title, MAX(created_at) AS createdAt, ${COUNTS}
      FROM facts GROUP BY campaign, category ORDER BY createdAt DESC, id DESC LIMIT 21 OFFSET ${query.page * 20}`),
    db.prepare("SELECT value FROM app_meta WHERE key = 'push_tracking_started_at'"),
  ]);
  return {
    generatedAt: now,
    trackingStartedAt: String((start!.results[0] as { value?: string } | undefined)?.value ?? now),
    from,
    cohortThrough: through,
    totals: totals!.results[0] as PushPerformance['totals'],
    categories: categories!.results as PushPerformance['categories'],
    daily: daily!.results as PushPerformance['daily'],
    campaigns: campaigns!.results.slice(0, 20) as PushPerformance['campaigns'],
    hasMore: campaigns!.results.length > 20,
  };
}
