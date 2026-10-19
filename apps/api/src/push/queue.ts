import type { Bindings } from '../env.js';
import { runNewsPush } from './dispatch.js';
import { runPersonalPush } from './personal.js';
import { pushTable, type PushWork } from './queuePublish.js';
import { runQueuedPushTest } from './queuedTest.js';

const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 400;
function validWork(body: unknown): body is PushWork {
  if (!body || typeof body !== 'object') return false;
  const value = body as Partial<PushWork>;
  if (value.version !== 1) return false;
  if (value.kind === 'test')
    return (
      validId(value.id) &&
      value.id.startsWith('test:ntf_') &&
      ['ko', 'en', 'ja'].includes(value.lang ?? '')
    );
  return (
    (value.kind === 'news' || value.kind === 'personal') &&
    Array.isArray(value.ids) &&
    value.ids.length > 0 &&
    value.ids.length <= 80 &&
    value.ids.every(validId)
  );
}

/** Queue owns sends, retries and receipt polling. Ack only after follow-up work is durable.
 * A duplicate wakeup cannot repeat a send: D1 claims and leases remain authoritative.
 */
export async function consumePushWork(
  batch: MessageBatch<unknown>,
  env: Bindings,
  now = Date.now(),
  transport: typeof fetch = fetch,
) {
  for (const message of batch.messages) {
    const work = message.body;
    if (!validWork(work)) {
      console.warn(JSON.stringify({ job: 'push-queue', invalid: true }));
      message.ack();
      continue;
    }
    try {
      let processed = 0;
      if (work.kind === 'test') {
        processed = Number(await runQueuedPushTest(env, work, now, transport));
        if (env.PUSH_TEST_ENABLED === '1') {
          const result = await runPersonalPush(
            { ...env, PERSONAL_PUSH_ENABLED: '1' },
            now,
            transport,
            undefined,
            [work.id],
          );
          processed += Object.values(result.states ?? {}).reduce((sum, n) => sum + n, 0);
        }
      } else {
        const result =
          work.kind === 'news'
            ? await runNewsPush(env, now, transport, 1, work.ids)
            : await runPersonalPush(env, now, transport, undefined, work.ids);
        processed = Object.values(result.states ?? {}).reduce((sum, n) => sum + n, 0);
      }
      // Duplicate/future wakeups must not multiply delayed jobs. The recovery publisher repairs
      // missed continuations and retries quiet-hour records without contacting Expo itself.
      if (!processed) {
        message.ack();
        continue;
      }
      const kind = work.kind === 'test' ? 'personal' : work.kind;
      const enabled =
        work.kind === 'test'
          ? env.PUSH_TEST_ENABLED
          : kind === 'news'
            ? env.NEWS_PUSH_ENABLED
            : env.PERSONAL_PUSH_ENABLED;
      if (env.ENVIRONMENT !== 'production' || enabled !== '1') {
        message.ack();
        continue;
      }
      const ids = work.kind === 'test' ? [work.id] : [...new Set(work.ids)];
      const table = pushTable(kind);
      const outstanding = await env.DB.prepare(
        `SELECT id, state, due_at FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')}) AND state IN ('pending','accepted','sending','checking')`,
      )
        .bind(...ids)
        .all<{ id: string; state: string; due_at: string }>();
      if (outstanding.results.length) {
        if (!env.PUSH_QUEUE) throw new Error('PUSH_QUEUE binding missing');
        // Quiet-hour work stays pending. Avoid hot-looping it; the next consumer rechecks policy.
        const due = Math.min(...outstanding.results.map((r) => Date.parse(r.due_at)));
        const delaySeconds = Math.max(
          due <= now ? 300 : 1,
          Math.min(86400, Math.ceil((due - now) / 1000)),
        );
        await env.PUSH_QUEUE.send(
          work.kind === 'test'
            ? work
            : { version: 1, kind, ids: outstanding.results.map((r) => r.id) },
          { delaySeconds },
        );
      }
      message.ack();
    } catch {
      console.error(JSON.stringify({ job: 'push-queue', retry: true }));
      message.retry({ delaySeconds: 60 });
    }
  }
}
