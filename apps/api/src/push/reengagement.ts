import type { Bindings } from '../env.js';

/** 새 소식 알림을 켜 등록된 기기를 사용한다. 하루 최대 1회 갱신하는 기기 등록을 방문의 보수적 근거로 삼는다. */
export async function queueReengagement(env: Bindings, time = Date.now()) {
  if (
    env.ENVIRONMENT !== 'production' ||
    env.REENGAGEMENT_PUSH_ENABLED !== '1' ||
    env.PERSONAL_PUSH_ENABLED !== '1'
  )
    return { enabled: false };
  const hour = new Date(time + 9 * 3600_000).getUTCHours();
  if (hour < 9 || hour >= 20) return { enabled: true, created: 0 };
  const iso = (at: number) => new Date(at).toISOString();
  const now = iso(time),
    cutoff = iso(time - 7 * 86400_000),
    oldest = iso(time - 90 * 86400_000);
  // 후보 최대 100명과 해당 기기를 한 트랜잭션으로 저장한다. 프로필별 추가 조회·쓰기 왕복 없음.
  const results = await env.DB.batch([
    env.DB.prepare(
      `WITH inactive AS (
      SELECT d.profile_id, MAX(d.updated_at) AS last_active
      FROM push_devices d JOIN sessions s ON s.id = d.session_id JOIN profiles p ON p.id = d.profile_id
      WHERE d.updated_at <= ? AND d.updated_at >= ?
        AND s.channel = 'app' AND s.profile_id = d.profile_id AND s.revoked_at IS NULL AND s.expires_at > ? AND p.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM push_devices active WHERE active.profile_id = d.profile_id AND active.updated_at > ?)
      GROUP BY d.profile_id), candidates AS (
      SELECT i.* FROM inactive i WHERE NOT EXISTS (
        SELECT 1 FROM notifications n WHERE n.profile_id = i.profile_id AND n.kind = 'return'
        AND (n.source_key = 'return:' || i.last_active OR n.created_at > ?)) LIMIT 100)
      INSERT OR IGNORE INTO notifications (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
      SELECT 'ntf_' || lower(hex(randomblob(16))), profile_id, 'return:' || last_active, 'return',
        '다시 킥오프할까요?', '오프사이드에서 이어갈 커리어와 새 소식을 확인해요.',
        '{"type":"screen","screen":"home"}', ?, ? FROM candidates`,
    ).bind(cutoff, oldest, now, cutoff, cutoff, now, iso(time + 90 * 86400_000)),
    env.DB.prepare(
      `INSERT OR IGNORE INTO push_deliveries
      (id, notification_id, installation_hash, session_id, profile_id, token, due_at, expires_at, updated_at)
      SELECT n.id || ':' || d.installation_hash, n.id, d.installation_hash, d.session_id, d.profile_id, d.token, ?, ?, ?
      FROM notifications n JOIN push_devices d ON d.profile_id = n.profile_id JOIN sessions s ON s.id = d.session_id
      WHERE changes() > 0 AND n.kind = 'return' AND n.created_at = ? AND n.read_at IS NULL
        AND d.updated_at >= ? AND s.channel = 'app' AND s.profile_id = d.profile_id
        AND s.revoked_at IS NULL AND s.expires_at > ?`,
    ).bind(now, iso(time + 86400_000), now, now, oldest, now),
  ]);
  return { enabled: true, created: results[0]!.meta.changes };
}
