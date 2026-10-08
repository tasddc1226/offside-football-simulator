import { describe, it, expect, vi } from 'vitest';
import { inspectInfraHealth, checkProduction } from './infra-health.mjs';

const NOW = Date.parse('2026-10-08T01:17:00Z');
const healthy = { at: NOW - 17 * 60_000, sizeBytes: 1024 ** 3, issues: [] };
describe('read-only infrastructure monitoring', () => {
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
