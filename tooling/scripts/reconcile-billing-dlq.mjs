import { pathToFileURL } from 'node:url';
import { client } from './d1-snapshot.mjs';
import { auditBillingDlq } from './billing-dlq-audit.mjs';

export const ACK_CONFIRMATION = 'ACK_SENT_BILLING_NOTIFICATIONS';
const alertId = (message) => {
  try {
    let body;
    try {
      body = JSON.parse(message.body);
    } catch {
      body = JSON.parse(Buffer.from(message.body, 'base64').toString('utf8'));
    }
    return body?.version === 1 && typeof body.id === 'string' && /^[a-f0-9]{64}$/.test(body.id)
      ? body.id
      : null;
  } catch {
    return null;
  }
};

/** One bounded, explicit reconciliation. Never replay, purge, send Slack, or change D1. */
export async function reconcileBillingDlq(api, { apply = false, confirmation } = {}) {
  if (apply && confirmation !== ACK_CONFIRMATION)
    throw new Error('Explicit sent-notification ACK confirmation required');
  const queues = await api('/queues?per_page=100');
  const queue = queues.find((q) => q.queue_name === 'offside-billing-production-dlq');
  if (!queue?.queue_id) throw new Error('Production billing DLQ unavailable');
  const base = `/queues/${encodeURIComponent(queue.queue_id)}/messages`;
  const audit = await auditBillingDlq(api, queue.queue_id);
  if (!apply) return { mode: 'dry-run', ...audit };
  if (audit.sampled === 0) return { mode: 'apply', acknowledged: 0, retained: 0 };
  if (audit.sampled !== audit.sent || audit.invalid || audit.unsent || audit.missing)
    throw new Error('DLQ contains unresolved notifications; no messages leased or acknowledged');
  // HTTP pull은 큐에 http_pull 소비자가 있어야 한다. 소비자 설정은 자동으로 바꾸지 않는다(런북).
  if (!queue.consumers?.some((c) => c?.type === 'http_pull'))
    throw new Error(
      'DLQ has no http_pull consumer; nothing leased. Wait for retention expiry or add a pull consumer by hand',
    );
  const databases = await api('/d1/database?per_page=100');
  const db = databases.find((d) => d.name === 'offside-production');
  if (!db?.uuid) throw new Error('Billing ledger unavailable');
  const batch = await api(`${base}/pull`, {
    batch_size: audit.sampled,
    visibility_timeout_ms: 60_000,
  });
  if (!Array.isArray(batch?.messages) || batch.messages.length > audit.sampled)
    throw new Error('Billing DLQ pull response malformed; leases must expire before retry');
  const messages = batch.messages;
  if (!messages.length) return { mode: 'apply', acknowledged: 0, retained: 0 };
  if (
    messages.some((m) => typeof m.lease_id !== 'string' || !m.lease_id) ||
    new Set(messages.map((m) => m.lease_id)).size !== messages.length
  )
    throw new Error('Billing DLQ leases malformed; leases must expire before retry');
  const release = () =>
    api(`${base}/ack`, {
      acks: [],
      retries: messages.map((m) => ({ lease_id: m.lease_id, delay_seconds: 0 })),
    });
  const ids = [...new Set(messages.map(alertId).filter(Boolean))];
  let sent;
  try {
    const blocks = ids.length
      ? await api(`/d1/database/${encodeURIComponent(db.uuid)}/query`, {
          sql: `SELECT id, sent_at IS NOT NULL AS sent FROM billing_alerts WHERE id IN (${ids.map(() => '?').join(',')})`,
          params: ids,
        })
      : [{ success: true, results: [] }];
    if (
      !Array.isArray(blocks) ||
      blocks.some((b) => b.success !== true) ||
      !Array.isArray(blocks[0]?.results)
    )
      throw new Error('Ledger recheck unavailable');
    sent = new Set(blocks[0].results.filter((r) => r.sent === 1).map((r) => r.id));
  } catch {
    await release();
    throw new Error('Billing ledger recheck failed; messages were not acknowledged');
  }
  const acks = [],
    retries = [];
  for (const m of messages) {
    if (sent.has(alertId(m))) acks.push({ lease_id: m.lease_id });
    else retries.push({ lease_id: m.lease_id, delay_seconds: 0 });
  }
  const result = await api(`${base}/ack`, { acks, retries });
  if (
    result?.ackCount !== acks.length ||
    result?.retryCount !== retries.length ||
    Object.keys(result.warnings ?? {}).length
  )
    throw new Error(
      'Billing ACK result uncertain; inspect queue metrics and ledger before any retry',
    );
  return { mode: 'apply', acknowledged: acks.length, retained: retries.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes('--ack-sent');
  const confirmation = process.argv
    .find((a) => a.startsWith('--confirm='))
    ?.slice('--confirm='.length);
  reconcileBillingDlq(client(), { apply, confirmation })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((e) => {
      // 메시지는 이 파일이 만든 고정 문구뿐이다(ID · 본문 · 토큰 없음). 다른 오류는 원문을 내지 않는다.
      const reason = /^[A-Za-z ;,._()/-]+$/.test(e?.message ?? '') ? ` (${e.message})` : '';
      console.error(
        `Billing DLQ reconciliation failed${reason}. Do not retry writes without a fresh queue/ledger inspection.`,
      );
      process.exitCode = 1;
    });
}
