import { NotificationContentSchema, type NotificationContent } from '@offside/contracts';
import type { Db } from '../db/client.js';
import { newId } from '../db/ids.js';

type Input = { profileId: string; sourceKey: string; content: NotificationContent; now: string };
/** 원본 쓰기와 같은 트랜잭션에 붙인다. guard는 서버가 정의한 SQL만 받는다. */
export function eventNotificationStatements(
  db: D1Database,
  input: Input,
  guard: { sql: string; params?: unknown[] } = { sql: 'changes() > 0' },
  opts: { push?: boolean } = {},
) {
  const content = NotificationContentSchema.parse(input.content);
  const id = newId('ntf');
  const stmts = [
    db
      .prepare(
        `INSERT OR IGNORE INTO notifications
      (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
      SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM profiles WHERE id = ? AND deleted_at IS NULL AND (${guard.sql})`,
      )
      .bind(
        id,
        input.sourceKey,
        content.kind,
        content.title,
        content.body,
        JSON.stringify(content.target),
        input.now,
        new Date(Date.parse(input.now) + 90 * 86400_000).toISOString(),
        input.profileId,
        ...(guard.params ?? []),
      ),
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
        input.now,
        new Date(Date.parse(input.now) + 86400_000).toISOString(),
        input.now,
        input.profileId,
        input.now,
        new Date(Date.parse(input.now) - 90 * 86400_000).toISOString(),
        content.kind,
      ),
  ];
  // push: false면 알림함에만 남긴다(같은 순간 다른 푸시와 겹쳐 예산에 밀리는 알림).
  return opts.push === false ? stmts.slice(0, 1) : stmts;
}

/** Drizzle 업무 쿼리를 D1으로 변환해 알림 원본·발송 큐와 원자적으로 커밋한다. */
export async function commitNotifiedEvent(
  db: Db,
  mutations: { toSQL(): { sql: string; params: unknown[] } }[],
  input: Input,
) {
  await db.$client.batch([
    ...mutations.map((query) => {
      const { sql, params } = query.toSQL();
      return db.$client.prepare(sql).bind(...params);
    }),
    ...eventNotificationStatements(db.$client, input),
  ]);
}
