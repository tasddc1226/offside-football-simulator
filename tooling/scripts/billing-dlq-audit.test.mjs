import { expect, it } from 'vitest';
import { auditBillingDlq } from './billing-dlq-audit.mjs';
it('peeks a bounded sample and correlates sent/unsent/missing/invalid messages without leasing or deleting', async () => {
  const calls = [];
  const ids = ['a', 'b', 'c'].map((c) => c.repeat(64));
  const result = await auditBillingDlq(async (path, body) => {
    calls.push({ path, body });
    if (path.startsWith('/d1/database?')) return [{ name: 'offside-production', uuid: 'db' }];
    if (path.endsWith('/peek'))
      return {
        messages: [
          { body: JSON.stringify({ version: 1, id: ids[0] }) },
          { body: Buffer.from(JSON.stringify({ version: 1, id: ids[1] })).toString('base64') },
          { body: JSON.stringify({ version: 1, id: ids[2] }) },
          { body: 'invalid' },
        ],
      };
    return [
      {
        success: true,
        results: [
          { id: ids[0], sent: 1 },
          { id: ids[1], sent: 0 },
        ],
      },
    ];
  }, 'queue');
  expect(result).toEqual({ sampled: 4, sent: 1, unsent: 1, missing: 1, invalid: 1 });
  expect(calls).toHaveLength(3);
  expect(calls.filter((c) => c.path.includes('/messages/')).map((c) => c.path)).toEqual([
    '/queues/queue/messages/peek',
  ]);
  expect(calls.filter((c) => c.body?.sql).every((c) => c.body.sql.startsWith('SELECT '))).toBe(
    true,
  );
  expect(JSON.stringify(result)).not.toContain(ids[0]);
});
