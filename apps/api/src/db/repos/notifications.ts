import {
  NotificationContentSchema,
  NotificationCursorSchema,
  NotificationSchema,
  type NotificationContent,
  type AppNotification,
} from '@offside/contracts';
import { parseWithAppError } from '../../errors.js';
import { newId } from '../ids.js';

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  target_json: string;
  created_at: string;
  read_at: string | null;
};
const dto = (r: Row): AppNotification =>
  NotificationSchema.parse({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    target: JSON.parse(r.target_json),
    createdAt: r.created_at,
    readAt: r.read_at,
  });
const COLUMNS = 'id, kind, title, body, target_json, created_at, read_at';
const RETENTION_MS = 90 * 86400_000;

export async function listNotifications(
  db: D1Database,
  profileId: string,
  now: string,
  query: { cursor?: string | undefined; unread?: '1' | undefined },
) {
  let cursor: { createdAt: string; id: string } | undefined;
  if (query.cursor) {
    let raw: unknown;
    try {
      raw = JSON.parse(atob(query.cursor));
    } catch {
      raw = null;
    }
    cursor = parseWithAppError(NotificationCursorSchema, raw);
  }
  const values: string[] = [profileId, now];
  let where = 'profile_id = ? AND expires_at > ?';
  if (query.unread) where += ' AND read_at IS NULL';
  if (cursor) {
    where += ' AND (created_at < ? OR (created_at = ? AND id < ?))';
    values.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const results = await db.batch([
    db
      .prepare(
        `SELECT ${COLUMNS} FROM notifications WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 21`,
      )
      .bind(...values),
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM notifications WHERE profile_id = ? AND read_at IS NULL AND expires_at > ?',
      )
      .bind(profileId, now),
  ]);
  const rows = results[0]!.results as Row[];
  const page = rows.slice(0, 20);
  const last = page.at(-1);
  return {
    items: page.map(dto),
    nextCursor:
      rows.length > 20 && last
        ? btoa(JSON.stringify({ createdAt: last.created_at, id: last.id }))
        : null,
    unreadCount: (results[1]!.results[0] as { count: number }).count,
  };
}
export async function ownNotification(db: D1Database, profileId: string, id: string, now: string) {
  const row = await db
    .prepare(
      `SELECT ${COLUMNS} FROM notifications WHERE id = ? AND profile_id = ? AND expires_at > ?`,
    )
    .bind(id, profileId, now)
    .first<Row>();
  return row ? dto(row) : null;
}
export async function readNotification(db: D1Database, profileId: string, id: string, now: string) {
  return db
    .prepare(
      'UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND profile_id = ? AND expires_at > ? RETURNING read_at',
    )
    .bind(now, id, profileId, now)
    .first<{ read_at: string }>();
}
export async function readAllNotifications(
  db: D1Database,
  profileId: string,
  through: string,
  now: string,
) {
  const r = await db
    .prepare(
      'UPDATE notifications SET read_at = ? WHERE profile_id = ? AND read_at IS NULL AND created_at <= ? AND expires_at > ?',
    )
    .bind(now, profileId, through, now)
    .run();
  return r.meta.changes;
}

/** 서버 이벤트만 호출한다. 동일한 원본 이벤트는 알림함·발송 모두 한 번만 생성한다. */
export async function queueNotification(
  db: D1Database,
  input: {
    profileId: string;
    sourceKey: string;
    content: NotificationContent;
    now: string;
    push?: boolean;
    dueAt?: string;
  },
) {
  const content = NotificationContentSchema.parse(input.content);
  const id = newId('ntf');
  const statements = [
    db
      .prepare(
        `INSERT OR IGNORE INTO notifications
    (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
    SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM profiles WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(
        id,
        input.sourceKey,
        content.kind,
        content.title,
        content.body,
        JSON.stringify(content.target),
        input.now,
        new Date(Date.parse(input.now) + RETENTION_MS).toISOString(),
        input.profileId,
      ),
  ];
  if (input.push)
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO push_deliveries
    (id, notification_id, installation_hash, session_id, profile_id, token, due_at, expires_at, updated_at)
    SELECT ? || ':' || d.installation_hash, ?, d.installation_hash, d.session_id, d.profile_id, d.token, ?, ?, ?
    FROM push_devices d JOIN sessions s ON s.id = d.session_id LEFT JOIN push_preferences pref ON pref.profile_id = d.profile_id
    WHERE changes() = 1 AND d.profile_id = ? AND s.channel = 'app' AND s.profile_id = d.profile_id
    AND s.revoked_at IS NULL AND s.expires_at > ? AND d.updated_at >= ?
    AND CASE ? WHEN 'team' THEN COALESCE(pref.team, 1) WHEN 'market' THEN COALESCE(pref.market, 1)
      WHEN 'social' THEN COALESCE(pref.social, 1) ELSE 1 END = 1`,
        )
        .bind(
          id,
          id,
          input.dueAt ?? input.now,
          new Date(Date.parse(input.now) + 86400_000).toISOString(),
          input.now,
          input.profileId,
          input.now,
          new Date(Date.parse(input.now) - RETENTION_MS).toISOString(),
          content.kind,
        ),
    );
  statements.push(
    db
      .prepare('SELECT id FROM notifications WHERE profile_id = ? AND source_key = ?')
      .bind(input.profileId, input.sourceKey),
  );
  const results = await db.batch(statements);
  const row = results.at(-1)!.results[0] as { id: string } | undefined;
  return { id: row?.id ?? null, created: results[0]!.meta.changes === 1 };
}
