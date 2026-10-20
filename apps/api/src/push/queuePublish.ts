import type { Bindings } from '../env.js';
import type { Lang } from '../lang.js';

export type PushWork =
  | { version: 1; kind: 'news' | 'personal'; ids: string[] }
  | { version: 1; kind: 'test'; id: string; lang: Lang };
export const pushTable = (kind: 'news' | 'personal') =>
  kind === 'news' ? 'push_news_deliveries' : 'push_deliveries';

/** D1 is a transactional delivery ledger. Only Queue consumers contact Expo.
 * Recovery republishes committed work after a missed/failed Queue publish. No tokens in messages.
 * Existing (state,due_at) indexes bound each scan; at most 300 records per state per tick.
 */
export async function publishPushWork(
  env: Bindings,
  kind: 'news' | 'personal',
  now = Date.now(),
  source?: { key: string; prefix?: boolean },
) {
  if (env.ENVIRONMENT !== 'production') return;
  if ((kind === 'news' ? env.NEWS_PUSH_ENABLED : env.PERSONAL_PUSH_ENABLED) !== '1') return;
  if (!env.PUSH_QUEUE) throw new Error('PUSH_QUEUE binding missing');
  const table = pushTable(kind);
  for (const state of ['pending', 'accepted', 'sending', 'checking']) {
    const sourceFilter = source?.prefix ? 'n.source_key>=? AND n.source_key<?' : 'n.source_key=?';
    const records = await env.DB.prepare(
      source
        ? `SELECT q.id FROM notifications n INDEXED BY notifications_source_key_idx
         JOIN push_deliveries q ON q.notification_id=n.id
         WHERE ${sourceFilter} AND q.state=? AND q.due_at<=? ORDER BY q.due_at LIMIT 300`
        : `SELECT q.id FROM ${table} q WHERE q.state=? AND q.due_at<=?
         ${kind === 'personal' && state === 'pending' ? "AND q.id NOT LIKE 'test:%'" : ''}
         ORDER BY q.due_at LIMIT 300`,
    )
      .bind(
        ...(source ? [source.key, ...(source.prefix ? [source.key + '\uffff'] : [])] : []),
        state,
        new Date(now).toISOString(),
      )
      .all<{ id: string }>();
    const messages = [];
    for (let i = 0; i < records.results.length; i += 80)
      messages.push({
        body: { version: 1 as const, kind, ids: records.results.slice(i, i + 80).map((r) => r.id) },
        contentType: 'json' as const,
      });
    if (messages.length) await env.PUSH_QUEUE.sendBatch(messages);
  }
}
