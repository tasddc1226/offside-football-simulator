import { describe, expect, it, vi } from 'vitest';
import { publishInfraWorkflow, HEARTBEAT_KEY } from './publish-infra-workflow.mjs';

const now = Date.parse('2026-11-03T01:33:34Z');
const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'tasddc1226/offside-football-simulator',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'schedule',
  GITHUB_RUN_ID: '123',
  GITHUB_TOKEN: 'github-private',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  CLOUDFLARE_API_TOKEN: 'cloudflare-private',
  RESOURCE_OUTCOME: 'failure',
};
const run = {
  id: 123,
  event: 'schedule',
  head_branch: 'main',
  repository: { full_name: env.GITHUB_REPOSITORY },
  path: '.github/workflows/infra-health.yml',
  created_at: new Date(now - 60_000).toISOString(),
};
describe('scheduled resource heartbeat', () => {
  it('authenticates each host separately and publishes the actual resource failure, never the DB result', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(run))
      .mockResolvedValueOnce(Response.json({ success: true }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await publishInfraWorkflow(env, fetcher, now);
      expect(fetcher).toHaveBeenCalledTimes(2);
      const [[github, auth], [storage, put]] = fetcher.mock.calls;
      expect(github).toBe(
        'https://api.github.com/repos/tasddc1226/offside-football-simulator/actions/runs/123',
      );
      expect(auth.headers.Authorization).toBe('Bearer github-private');
      expect(storage).toContain(encodeURIComponent(HEARTBEAT_KEY));
      expect(put.headers.Authorization).toBe('Bearer cloudflare-private');
      expect(JSON.parse(put.body)).toMatchObject({
        event: 'schedule',
        branch: 'main',
        runId: '123',
        conclusion: 'failure',
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain('private');
    } finally {
      log.mockRestore();
    }
  });
  it('refuses manual, PR, foreign, stale and malformed publication before any write', async () => {
    for (const change of [
      { GITHUB_ACTIONS: 'false' },
      { GITHUB_EVENT_NAME: 'workflow_dispatch' },
      { GITHUB_REF: 'refs/heads/feature' },
      { RESOURCE_OUTCOME: '' },
      { GITHUB_TOKEN: '' },
    ]) {
      const fetcher = vi.fn();
      await expect(publishInfraWorkflow({ ...env, ...change }, fetcher, now)).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    }
    for (const change of [
      { event: 'workflow_dispatch' },
      { head_branch: 'feature' },
      { id: 999 },
      { path: '.github/workflows/other.yml' },
      { repository: { full_name: 'other/repo' } },
      { created_at: 'bad' },
      { created_at: new Date(now - 4 * 3600000).toISOString() },
      { created_at: new Date(now + 1).toISOString() },
    ]) {
      const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...run, ...change }));
      await expect(publishInfraWorkflow(env, fetcher, now)).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('never prints private error bodies and rejects failed or ambiguous uploads', async () => {
    for (const failure of [
      new Response('private body', { status: 403 }),
      Response.json({ success: false }),
      Response.json({ success: true, errors: [{ message: 'private' }] }),
    ]) {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(Response.json(run))
        .mockResolvedValueOnce(failure);
      await expect(publishInfraWorkflow(env, fetcher, now)).rejects.toThrow(
        /^Workflow heartbeat publication/,
      );
    }
  });
});
