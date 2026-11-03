/** Read-only peek does not lease/retry messages. Never return refs, IDs or raw payloads. */
export async function auditBillingDlq(api, queueId) {
  const databases = await api('/d1/database?per_page=100');
  const db = databases.find((d) => d.name === 'offside-production');
  if (!db?.uuid) throw new Error('Billing ledger unavailable.');
  const batch = await api(`/queues/${encodeURIComponent(queueId)}/messages/peek`, {
    batch_size: 10,
  });
  if (!Array.isArray(batch?.messages) || batch.messages.length > 10)
    throw new Error('Billing DLQ peek unavailable.');
  const counts = { sampled: batch.messages.length, sent: 0, unsent: 0, missing: 0, invalid: 0 };
  const ids = [];
  for (const message of batch.messages) {
    let body;
    try {
      try {
        body = JSON.parse(message.body);
      } catch {
        body = JSON.parse(Buffer.from(message.body, 'base64').toString('utf8'));
      }
    } catch {
      counts.invalid++;
      continue;
    }
    if (body?.version !== 1 || typeof body.id !== 'string' || !/^[a-f0-9]{64}$/.test(body.id)) {
      counts.invalid++;
      continue;
    }
    ids.push(body.id);
  }
  if (ids.length) {
    // One indexed batch read, including duplicate message IDs without duplicate DB reads.
    const unique = [...new Set(ids)];
    const blocks = await api(`/d1/database/${encodeURIComponent(db.uuid)}/query`, {
      sql: `SELECT id, sent_at IS NOT NULL AS sent FROM billing_alerts WHERE id IN (${unique.map(() => '?').join(',')})`,
      params: unique,
    });
    if (!Array.isArray(blocks) || blocks.some((b) => b.success !== true))
      throw new Error('Billing ledger observation unavailable.');
    const rows = blocks[0]?.results;
    if (!Array.isArray(rows)) throw new Error('Billing ledger observation malformed.');
    const byId = new Map(rows.map((r) => [r.id, r.sent]));
    for (const id of ids) {
      if (!byId.has(id)) counts.missing++;
      else if (byId.get(id) === 1) counts.sent++;
      else if (byId.get(id) === 0) counts.unsent++;
      else throw new Error('Billing ledger observation malformed.');
    }
  }
  return counts;
}
