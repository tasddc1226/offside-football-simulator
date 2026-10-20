import type { Bindings } from '../env.js';
import { kstDay } from '@offside/contracts/kst';
import { HOME_GIFT } from '@offside/contracts/cup';
import { giftReminderText as text } from '../i18n/ko/giftReminder.js';

// T-11-388 홈 선물 안내 푸시(일회성). 홈 선물(T-11-275)을 아직 받지 않은 로그인한 구단주에게 정한 날 낮(12시대) 한 번 앱 푸시를
// 보낸다. 앱 기기 등록이 최근 14일 안에 갱신된 사람만이다. 알림 원본은 선물 · 사람마다 하나(source_key)라 그날 5분 틱마다 다시
// 돌아도, 다른 날 다시 켜도 한 사람이 두 번 받지 않는다. 보낼 때(personal.ts) 그 사이 선물을 받았으면 보내지 않는다.

const DAY = 86400_000;
/** 보내는 날(KST). 이날 12시대에만 쌓는다. */
export const GIFT_REMINDER_DAY = '2026-10-19';
/** 한 틱에 쌓는 사람 수(12시대 틱 12번이면 2,400명). 보내기는 personal.ts가 틱마다 나눠 한다. */
const LIMIT = 200;
const iso = (time: number) => new Date(time).toISOString();

export const giftReminderEnabled = (env: Bindings) =>
  env.ENVIRONMENT === 'production' &&
  env.PERSONAL_PUSH_ENABLED === '1' &&
  env.GIFT_REMINDER_ENABLED === '1';
/** 보내는 날 KST 12시대만. */
export const giftReminderWindow = (time: number) =>
  kstDay(iso(time)) === GIFT_REMINDER_DAY && new Date(time + 9 * 3600_000).getUTCHours() === 12;

/** 알림 원본과 기기 전달을 한 batch로 쌓는다(출석 독려 attendanceReminder.ts와 같은 모양). 사람마다 따로 읽거나 쓰는 왕복은 없다. */
export async function queueGiftReminders(env: Bindings, time = Date.now()) {
  if (!giftReminderEnabled(env) || !giftReminderWindow(time)) return { created: 0 };
  const now = iso(time);
  const prefix = `gift-reminder:${HOME_GIFT.id}:`;
  const active = iso(time - 14 * DAY);
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (id, profile_id, source_key, kind, title, body, target_json, created_at, expires_at)
      SELECT 'ntf_' || lower(hex(randomblob(16))), p.id, ? || p.id, 'return', ?, ?,
        '{"type":"screen","screen":"home"}', ?, ?
      FROM (SELECT DISTINCT d.profile_id AS id FROM push_devices d JOIN sessions s ON s.id = d.session_id
          WHERE d.updated_at >= ? AND s.profile_id = d.profile_id
            AND s.channel = 'app' AND s.revoked_at IS NULL AND s.expires_at > ?) c
      JOIN profiles p ON p.id = c.id
      WHERE p.deleted_at IS NULL AND (p.google_sub IS NOT NULL OR p.apple_sub IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM gift_claims g WHERE g.profile_id = p.id AND g.gift_id = ?)
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.profile_id = p.id AND n.source_key = ? || p.id)
      LIMIT ${LIMIT}`,
    ).bind(
      prefix,
      text.title,
      text.body,
      now,
      iso(time + 7 * DAY),
      active,
      now,
      HOME_GIFT.id,
      prefix,
    ),
    // 사람마다 가장 최근 앱 기기 하나로만 보낸다. 15시(KST)가 지나면 보내지 않는다.
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
    ).bind(
      now,
      iso(Date.parse(`${GIFT_REMINDER_DAY}T15:00:00+09:00`)),
      now,
      now,
      active,
      now,
      prefix,
    ),
  ]);
  const created = results[0]!.meta.changes;
  console.log(JSON.stringify({ job: 'gift-reminder-enqueue', created }));
  return { created };
}
