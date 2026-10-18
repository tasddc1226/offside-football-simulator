import type { Bindings } from '../env.js';
import { careerReminderText as text } from '../i18n/ko/careerReminder.js';
import { runPersonalPush } from './personal.js';
import { publishPushWork } from './queuePublish.js';

const DAY = 86400_000;
const iso = (time: number) => new Date(time).toISOString();
export const careerReminderEnabled = (env: Bindings) =>
  env.ENVIRONMENT === 'production' &&
  env.PERSONAL_PUSH_ENABLED === '1' &&
  env.CAREER_REMINDER_ENABLED === '1';
export function careerReminderWindow(time: number) {
  const hour = new Date(time + 9 * 3600_000).getUTCHours();
  return hour >= 11 && hour < 19;
}

/** One atomic cohort reservation and two set-based inserts. Never read local save contents. */
export async function queueCareerReminders(env: Bindings, time = Date.now()) {
  if (!careerReminderEnabled(env) || !careerReminderWindow(time)) return { created: 0 };
  const batchId = crypto.randomUUID();
  const now = iso(time),
    d3 = iso(time - 3 * DAY),
    d7 = iso(time - 7 * DAY),
    d14 = iso(time - 14 * DAY);
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE career_activity SET reminder_batch = ?, last_reminder_at = ?,
      reminder_stage = CASE WHEN last_active_at <= ? THEN 3 WHEN last_active_at <= ? THEN 2 ELSE 1 END
      WHERE profile_id IN (SELECT a.profile_id FROM career_activity a JOIN profiles p ON p.id=a.profile_id
        WHERE a.state='active' AND a.retired_at IS NULL AND p.deleted_at IS NULL
        AND a.last_active_at <= ? AND a.last_active_at >= ?
        AND a.reminder_stage < CASE WHEN a.last_active_at <= ? THEN 3 WHEN a.last_active_at <= ? THEN 2 ELSE 1 END
        AND (a.last_reminder_at IS NULL OR a.last_reminder_at <= ?)
        AND NOT EXISTS (SELECT 1 FROM careers c WHERE c.profile_id=a.profile_id AND (c.status='retired' OR c.updated_at > ?))
        AND NOT EXISTS (SELECT 1 FROM push_devices d WHERE d.profile_id=a.profile_id AND d.updated_at > ?)
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.profile_id=a.profile_id AND n.created_at > ?)
        AND EXISTS (SELECT 1 FROM push_devices d JOIN sessions s ON s.id=d.session_id
          WHERE d.profile_id=a.profile_id AND s.profile_id=a.profile_id AND s.channel='app'
            AND s.revoked_at IS NULL AND s.expires_at > ? AND d.updated_at >= ?)
        ORDER BY a.last_active_at DESC, a.profile_id LIMIT 100)`,
    ).bind(
      batchId,
      now,
      d14,
      d7,
      d3,
      iso(time - 30 * DAY),
      d14,
      d7,
      iso(time - 4 * DAY),
      d3,
      d3,
      iso(time - DAY),
      now,
      iso(time - 90 * DAY),
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications
      (id,profile_id,source_key,kind,title,body,target_json,created_at,expires_at)
      SELECT 'ntf_' || lower(hex(randomblob(16))),profile_id,'career-reminder:' || ? || ':' || profile_id,'return',
        CASE reminder_stage WHEN 1 THEN ? WHEN 2 THEN ? ELSE ? END,
        CASE reminder_stage WHEN 1 THEN ? WHEN 2 THEN ? ELSE ? END,
        '{"type":"screen","screen":"home"}',?,? FROM career_activity WHERE reminder_batch=?`,
    ).bind(
      batchId,
      text[0].title,
      text[1].title,
      text[2].title,
      text[0].body,
      text[1].body,
      text[2].body,
      now,
      iso(time + 90 * DAY),
      batchId,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO career_reminder_outcomes (notification_id,stage)
      SELECT n.id,a.reminder_stage FROM career_activity a JOIN notifications n
      ON n.profile_id=a.profile_id AND n.source_key='career-reminder:' || ? || ':' || a.profile_id
      WHERE a.reminder_batch=?`,
    ).bind(batchId, batchId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO push_deliveries
      (id,notification_id,installation_hash,session_id,profile_id,token,due_at,expires_at,updated_at)
      SELECT n.id || ':' || d.installation_hash,n.id,d.installation_hash,d.session_id,d.profile_id,d.token,?,?,?
      FROM career_activity a JOIN notifications n ON n.profile_id=a.profile_id AND n.source_key='career-reminder:' || ? || ':' || a.profile_id
      JOIN push_devices d ON d.installation_hash=(SELECT device.installation_hash FROM push_devices device
        JOIN sessions s ON s.id=device.session_id WHERE device.profile_id=a.profile_id AND s.profile_id=a.profile_id
        AND s.channel='app' AND s.revoked_at IS NULL AND s.expires_at > ? AND device.updated_at >= ?
        ORDER BY device.updated_at DESC,device.installation_hash LIMIT 1)
      WHERE a.reminder_batch=?`,
    ).bind(now, iso(time + DAY), now, batchId, now, iso(time - 90 * DAY), batchId),
  ]);
  const created = results[1]!.meta.changes;
  if (created && (env.PUSH_QUEUE || env.CAREER_PUSH_QUEUE)) {
    try {
      if (env.PUSH_QUEUE)
        await publishPushWork(env, 'personal', time, {
          key: `career-reminder:${batchId}:`,
          prefix: true,
        });
      else await env.CAREER_PUSH_QUEUE!.send({ version: 1, batchId });
    } catch {
      console.error(JSON.stringify({ job: 'career-reminder-publish', fallback: 'cron' }));
    }
  }
  console.log(JSON.stringify({ job: 'career-reminder-enqueue', created }));
  return { created };
}

export async function consumeCareerReminders(
  batch: MessageBatch<unknown>,
  env: Bindings,
  time = Date.now(),
  transport: typeof fetch = fetch,
) {
  if (!careerReminderEnabled(env)) {
    batch.ackAll();
    return;
  }
  for (const message of batch.messages) {
    const body = message.body as { version?: unknown; batchId?: unknown } | null;
    if (
      !body ||
      body.version !== 1 ||
      typeof body.batchId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(body.batchId)
    ) {
      message.ack();
      continue;
    }
    if (!careerReminderWindow(time)) {
      const kst = new Date(time + 9 * 3600_000);
      const next = Date.UTC(
        kst.getUTCFullYear(),
        kst.getUTCMonth(),
        kst.getUTCDate() + (kst.getUTCHours() >= 19 ? 1 : 0),
        2,
      );
      message.retry({ delaySeconds: Math.max(1, Math.ceil((next - time) / 1000)) });
      continue;
    }
    try {
      await runPersonalPush(env, time, transport, { retentionBatch: body.batchId });
      const pending = await env.DB.prepare(
        `SELECT MIN(q.due_at) AS due FROM push_deliveries q
        JOIN notifications n ON n.id=q.notification_id WHERE q.state='pending' AND n.kind='return' AND substr(n.source_key,1,53) = ?`,
      )
        .bind(`career-reminder:${body.batchId}:`)
        .first<{ due: string | null }>();
      if (pending?.due)
        message.retry({
          delaySeconds: Math.max(
            1,
            Math.min(86400, Math.ceil((Date.parse(pending.due) - time) / 1000)),
          ),
        });
      else message.ack();
    } catch {
      console.error(JSON.stringify({ job: 'career-reminder-consume', retry: true }));
      message.retry({ delaySeconds: 60 });
    }
  }
}
