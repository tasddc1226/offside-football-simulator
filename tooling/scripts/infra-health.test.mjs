import { describe, it, expect, vi } from 'vitest';
import {
  inspectInfraHealth,
  checkProduction,
  inspectQueueHealth,
  inspectR2Storage,
  checkResourceHealth,
} from './infra-health.mjs';

const NOW = Date.parse('2026-10-08T01:17:00Z');
const healthy = { at: NOW - 17 * 60_000, sizeBytes: 1024 ** 3, issues: [] };
const queues = ['admin-push', 'billing', 'career-push', 'cup-push'].map((kind) => ({
  name: `offside-${kind}-production-dlq`,
  backlog: 0,
  retention: 1209600,
}));
describe('read-only infrastructure monitoring', () => {
  it('fails on missing DLQ observations, retention drift and any backlog', () => {
    expect(inspectQueueHealth(queues).failed).toBe(false);
    expect(inspectQueueHealth(queues.slice(1)).failed).toBe(true);
    for (const change of [{ backlog: 1 }, { backlog: undefined }, { retention: 86400 }])
      expect(inspectQueueHealth([{ ...queues[0], ...change }, ...queues.slice(1)]).failed).toBe(
        true,
      );
  });
  it('distinguishes current R2 capacity warnings from missing data and monthly billing', () => {
    const row = {
      dimensions: { datetime: new Date(NOW).toISOString() },
      max: { payloadSize: 9e9 },
    };
    expect(inspectR2Storage(row, NOW)).toMatchObject({ failed: false, warning: true });
    expect(inspectR2Storage(row, NOW).summary).toContain('not GB-month');
    expect(() => inspectR2Storage(row, NOW + 3 * 3600000)).toThrow();
    expect(() => inspectR2Storage(undefined, NOW)).toThrow();
  });
  it('reads queue metrics and GraphQL only; missing analytics is explicitly unknown', async () => {
    const calls = [];
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/graphql')) return Response.json({ errors: [{ message: 'private body' }] });
      if (url.endsWith('/metrics'))
        return Response.json({ success: true, result: { backlog_count: 0 } });
      return Response.json({
        success: true,
        result: queues.map((q, i) => ({
          queue_id: String(i),
          queue_name: q.name,
          settings: { message_retention_period: q.retention },
        })),
      });
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await checkResourceHealth(
        { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_API_TOKEN: 'private-token' },
        fetcher,
      );
      expect(calls).toHaveLength(6);
      expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
      expect(JSON.parse(calls.at(-1).init.body).query).not.toContain('mutation');
      const output = log.mock.calls.flat().join('');
      expect(output).toContain('unknown');
      expect(output).not.toContain('private');
    } finally {
      log.mockRestore();
    }
  });
  it('rejects missing, stale, future and malformed observations instead of reporting healthy', () => {
    for (const value of [
      null,
      { ...healthy, sizeBytes: 0 },
      { ...healthy, at: NOW - 3 * 60 * 60_000 },
      { ...healthy, at: NOW + 120_000 },
      { ...healthy, issues: ['private text'] },
    ])
      expect(() => inspectInfraHealth(value, NOW)).toThrow();
    expect(inspectInfraHealth(healthy, NOW)).toMatchObject({ failed: false });
    expect(inspectInfraHealth({ ...healthy, issues: ['backup-not-completed'] }, NOW).failed).toBe(
      true,
    );
  });
  it('uses only database lookup and SELECT, and never includes API error bodies in failures', async () => {
    const calls = [];
    const report = { ...healthy, at: Date.now() };
    const fetcher = async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        success: true,
        result:
          calls.length === 1
            ? [{ name: 'offside-production', uuid: 'test-db' }]
            : [{ success: true, results: [{ value: JSON.stringify(report) }] }],
      });
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await checkProduction(
        { CLOUDFLARE_ACCOUNT_ID: 'test-account', CLOUDFLARE_API_TOKEN: 'never-print-token' },
        fetcher,
      );
      expect(calls).toHaveLength(2);
      expect(JSON.parse(calls[1].init.body).sql).toBe(
        "SELECT value FROM app_meta WHERE key='cron:infra-health:last'",
      );
      expect(log.mock.calls.flat().join('')).not.toContain('never-print-token');
      await expect(
        checkProduction(
          { CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_API_TOKEN: 'token' },
          async () => new Response('private-api-body', { status: 403 }),
        ),
      ).rejects.toThrow('HTTP 403');
    } finally {
      log.mockRestore();
    }
  });
});
