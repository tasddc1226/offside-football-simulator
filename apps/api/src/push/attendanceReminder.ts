import type { Bindings } from '../env.js';
import { kstDay } from '@offside/contracts/kst';
import { attendanceReminderText as text } from '../i18n/ko/attendanceReminder.js';

// T-11-378 출석 독려 푸시. 오늘(KST) 아직 출석하지 않은 로그인한 구단주에게 저녁(19시대) 한 번 앱 푸시를 보낸다. 앱 기기 등록이
// 최근 14일 안에 갱신된(앱을 쓰는) 사람만, 마지막 출석 뒤 독려를 3번 받고도 오지 않았으면 다음 출석 전까지 멈춘다. 알림 원본은
// 하루 · 사람마다 하나(source_key)라 19시대 5분 틱마다 다시 돌아도 한 번만 쌓인다. 보낼 때(personal.ts) 그 사이 출석했으면 보내지 않는다.

const DAY = 86400_000;
/** 마지막 출석 뒤 이만큼 보내고도 오지 않으면 멈춘다. */
export const ATTENDANCE_REMINDER_MAX = 3;
/** 한 틱에 쌓는 사람 수(19시대 틱 12번이면 2,400명). 보내기는 personal.ts가 틱마다 나눠 한다. */
const LIMIT = 200;
const iso = (time: number) => new Date(time).toISOString();

export const attendanceReminderEnabled = (env: Bindings) =>
  env.ENVIRONMENT === 'production' &&
  env.PERSONAL_PUSH_ENABLED === '1' &&
  env.ATTENDANCE_REMINDER_ENABLED === '1';
/** KST 19시대만(밤 알림 금지 시간 전, 저녁에 하루를 마무리할 때). */
export const attendanceReminderWindow = (time: number) =>
  new Date(time + 9 * 3600_000).getUTCHours() === 19;

/**
 * 알림 원본과 기기 전달을 한 batch로 쌓는다. 사람마다 따로 읽거나 쓰는 왕복은 없다. 후보는 최근 앱 기기 등록에서 고른다
 * (기기 표의 갱신 시각 인덱스를 타서 전체 프로필을 훑지 않는다).
 */
export async function queueAttendanceReminders(env: Bindings, time = Date.now()) {
  if (!attendanceReminderEnabled(env) || !attendanceReminderWindow(time)) return { created: 0 };
  const now = iso(time);
  const today = kstDay(now);
  const prefix = `attendance-reminder:${today}:`;
  const active = iso(time - 14 * DAY);
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
      SELECT 'ntf_' || lower(hex(randomblob(16))), p.id, ? || p.id, 'return', ?, ?,
        '{"type":"screen","screen":"home"}', ?, ?
      FROM (SELECT DISTINCT d.profile_id AS id FROM push_devices d JOIN sessions s ON s.id = d.session_id
          WHERE d.engagement_enabled IN (0, 1) AND d.updated_at >= ? AND s.profile_id = d.profile_id
            AND s.channel = 'app' AND s.revoked_at IS NULL AND s.expires_at > ?) c
      JOIN profiles p ON p.id = c.id LEFT JOIN owner_attendance o ON o.profile_id = p.id
      WHERE p.deleted_at IS NULL AND (p.google_sub IS NOT NULL OR p.apple_sub IS NOT NULL)
        AND (o.last_day IS NULL OR o.last_day <> ?)
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.profile_id = p.id AND n.source_key = ? || p.id)
        AND (SELECT COUNT(*) FROM notifications n WHERE n.profile_id = p.id
          AND n.source_key LIKE 'attendance-reminder:%' AND n.created_at > COALESCE(o.updated_at, '')) < ?
      LIMIT ${LIMIT}`,
    ).bind(
      prefix,
      text.title,
      text.body,
      now,
      iso(time + 7 * DAY),
      active,
      now,
      today,
      prefix,
      ATTENDANCE_REMINDER_MAX,
    ),
    // 사람마다 가장 최근 앱 기기 하나로만 보낸다(같은 사람이 여러 기기에서 같은 독려를 받지 않게). 21시(KST)가 지나면 보내지 않는다.
    env.DB.prepare(
      `INSERT OR IGNORE INTO push_deliveries
      (id, notification_id, installation_hash, session_id, profile_id, token, due_at, expires_at, updated_at)
      SELECT n.id || ':' || d.installation_hash, n.id, d.installation_hash, d.session_id, d.profile_id, d.token, ?, ?, ?
      FROM notifications n JOIN push_devices d ON d.installation_hash = (SELECT device.installation_hash
        FROM push_devices device JOIN sessions s ON s.id = device.session_id
        WHERE device.profile_id = n.profile_id AND s.profile_id = n.profile_id AND s.channel = 'app'
          AND s.revoked_at IS NULL AND s.expires_at > ? AND device.updated_at >= ?
        ORDER BY device.updated_at DESC, device.installation_hash LIMIT 1)
      WHERE n.kind = 'return' AND n.created_at = ? AND substr(n.source_key, 1, ${prefix.length}) = ?`,
    ).bind(now, iso(Date.parse(`${today}T21:00:00+09:00`)), now, now, active, now, prefix),
  ]);
  const created = results[0]!.meta.changes;
  console.log(JSON.stringify({ job: 'attendance-reminder-enqueue', created }));
  return { created };
}
