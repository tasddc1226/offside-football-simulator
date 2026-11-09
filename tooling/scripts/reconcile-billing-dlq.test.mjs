import { expect, it } from 'vitest';
import { reconcileBillingDlq, ACK_CONFIRMATION } from './reconcile-billing-dlq.mjs';
const id = 'a'.repeat(64),
  other = 'b'.repeat(64);
const message = (id, lease_id = 'lease') => ({
  body: JSON.stringify({ version: 1, id }),
  lease_id,
});
function fake({
  consumers = [{ type: 'http_pull' }],
  before = 1,
  after = 1,
  pulled = [message(id)],
  fail = false,
  ack = { ackCount: 1, retryCount: 0 },
} = {}) {
  const calls = [];
  let queries = 0;
  const api = async (path, body) => {
    calls.push({ path, body });
    if (path.startsWith('/queues?'))
      return [{ queue_name: 'offside-billing-production-dlq', queue_id: 'queue', consumers }];
    if (path.startsWith('/d1/database?')) return [{ name: 'offside-production', uuid: 'db' }];
    if (path.endsWith('/peek')) return { messages: [message(id)] };
    if (path.endsWith('/pull')) return { messages: pulled };
    if (path.endsWith('/query')) {
      queries++;
      if (fail && queries === 2) throw Error('private database failure');
      return [{ success: true, results: [{ id, sent: queries === 1 ? before : after }] }];
    }
    if (path.endsWith('/ack')) return ack;
    throw Error('unexpected call');
  };
  return { api, calls };
}
it('defaults to read-only and requires an explicit confirmation before any leasing', async () => {
  const { api, calls } = fake();
  expect(await reconcileBillingDlq(api)).toMatchObject({ mode: 'dry-run', sent: 1 });
  expect(calls.some((c) => c.path.endsWith('/pull') || c.path.endsWith('/ack'))).toBe(false);
  await expect(reconcileBillingDlq(api, { apply: true })).rejects.toThrow('confirmation');
});
it('acknowledges only freshly rechecked sent alerts, without D1 writes, replay, purge or raw IDs in the result', async () => {
  const { api, calls } = fake();
  const result = await reconcileBillingDlq(api, { apply: true, confirmation: ACK_CONFIRMATION });
  expect(result).toEqual({ mode: 'apply', acknowledged: 1, retained: 0 });
  expect(calls.at(-1).body).toEqual({ acks: [{ lease_id: 'lease' }], retries: [] });
  expect(calls.filter((c) => c.body?.sql).every((c) => c.body.sql.startsWith('SELECT '))).toBe(
    true,
  );
  expect(JSON.stringify(result)).not.toContain(id);
});
it('does not lease a batch containing unresolved messages', async () => {
  const { api, calls } = fake({ before: 0 });
  await expect(
    reconcileBillingDlq(api, { apply: true, confirmation: ACK_CONFIRMATION }),
  ).rejects.toThrow('unresolved');
  expect(calls.some((c) => c.path.endsWith('/pull'))).toBe(false);
});
it('returns new/unknown, invalid and unsent pulled messages to the DLQ instead of acknowledging them', async () => {
  for (const pulled of [[message(other)], [{ body: 'bad', lease_id: 'lease' }], [message(id)]]) {
    const { api, calls } = fake({ pulled, after: 0, ack: { ackCount: 0, retryCount: 1 } });
    expect(
      await reconcileBillingDlq(api, { apply: true, confirmation: ACK_CONFIRMATION }),
    ).toMatchObject({ acknowledged: 0, retained: 1 });
    expect(calls.at(-1).body.acks).toEqual([]);
  }
});
it('releases leases without ACK on a failed ledger recheck and rejects ambiguous ACK results', async () => {
  const { api, calls } = fake({ fail: true });
  await expect(
    reconcileBillingDlq(api, { apply: true, confirmation: ACK_CONFIRMATION }),
  ).rejects.toThrow('recheck');
  expect(calls.at(-1).body.acks).toEqual([]);
  await expect(
    reconcileBillingDlq(fake({ ack: { ackCount: 0, retryCount: 0 } }).api, {
      apply: true,
      confirmation: ACK_CONFIRMATION,
    }),
  ).rejects.toThrow('uncertain');
});
it('T-11-677 http_pull 소비자가 없으면 pull 전에 이유를 밝히고 멈춘다', async () => {
  const { api, calls } = fake({ consumers: [] });
  await expect(
    reconcileBillingDlq(api, { apply: true, confirmation: ACK_CONFIRMATION }),
  ).rejects.toThrow('http_pull');
  expect(calls.some((c) => c.path.endsWith('/pull') || c.path.endsWith('/ack'))).toBe(false);
});
