import type { Bindings } from '../env.js';
import { communityOwnerEmail } from './community.js';
import { runPersonalPush } from './personal.js';
import { publishPushWork } from './queuePublish.js';

type CommunityPushJob = { version: 1; sourceKey: string };
const validSource = (key: unknown): key is string =>
  typeof key === 'string' && /^admin-community-(comment|chat):[A-Za-z0-9_-]{1,100}$/.test(key);
const enabled = (env: Bindings) =>
  env.ENVIRONMENT === 'production' &&
  env.ADMIN_COMMUNITY_QUEUE_ENABLED === '1' &&
  env.PERSONAL_PUSH_ENABLED === '1' &&
  !!communityOwnerEmail(env);

/** Call only after the D1 commit. D1 remains the durable outbox if publishing fails. */
export async function publishCommunityPush(env: Bindings, sourceKeys: string[]) {
  if (!enabled(env)) return;
  if (env.PUSH_QUEUE) {
    for (const key of [...new Set(sourceKeys)].filter(validSource)) {
      try {
        await publishPushWork(env, 'personal', Date.now(), { key });
      } catch {
        console.error(JSON.stringify({ job: 'community-queue-publish', fallback: 'cron' }));
      }
    }
    return;
  }
  if (!env.ADMIN_PUSH_QUEUE) return;
  const keys = [...new Set(sourceKeys)].filter(validSource);
  if (!keys.length) return;
  try {
    for (let i = 0; i < keys.length; i += 100) {
      await env.ADMIN_PUSH_QUEUE.sendBatch(
        keys.slice(i, i + 100).map((sourceKey) => ({
          body: { version: 1 as const, sourceKey },
          contentType: 'json' as const,
        })),
      );
    }
    console.log(JSON.stringify({ job: 'community-queue-publish', count: keys.length }));
  } catch {
    // Do not fail a saved comment/chat or log its body, token or recipient.
    console.error(JSON.stringify({ job: 'community-queue-publish', fallback: 'cron' }));
  }
}

/** At-least-once wakeups are safe: the existing D1 lease owns each Expo send. */
export async function consumeCommunityPush(
  batch: MessageBatch<unknown>,
  env: Bindings,
  now = Date.now(),
  transport: typeof fetch = fetch,
) {
  if (!enabled(env)) {
    // The original cron dispatcher remains available when the pilot is disabled.
    batch.ackAll();
    return;
  }
  for (const message of batch.messages) {
    const body = message.body as Partial<CommunityPushJob> | null;
    if (!body || body.version !== 1 || !validSource(body.sourceKey)) {
      console.warn(JSON.stringify({ job: 'community-queue', invalid: true }));
      message.ack();
      continue;
    }
    try {
      await runPersonalPush(env, now, transport, body.sourceKey);
      const pending = await env.DB.prepare(
        `SELECT MIN(q.due_at) AS due FROM push_deliveries q
         JOIN notifications n ON n.id = q.notification_id
         WHERE n.kind = 'community' AND n.source_key = ? AND q.state = 'pending'`,
      )
        .bind(body.sourceKey)
        .first<{ due: string | null }>();
      if (pending?.due) {
        // Respect D1 backoff (429/5xx). Repeated Queue/DB failures go to the configured DLQ.
        message.retry({
          delaySeconds: Math.max(
            1,
            Math.min(86400, Math.ceil((Date.parse(pending.due) - now) / 1000)),
          ),
        });
      } else {
        // Accepted/terminal/in-flight sends must never be blindly repeated, including timeouts.
        message.ack();
      }
    } catch {
      console.error(JSON.stringify({ job: 'community-queue', retry: true }));
      message.retry({ delaySeconds: 60 });
    }
  }
}
