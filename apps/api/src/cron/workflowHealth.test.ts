import { describe, expect, it, vi } from 'vitest';
import { inspectWorkflowRuns, readWorkflowHealth, WORKFLOW_STALE_MS } from './workflowHealth.js';
const NOW = Date.parse('2026-11-02T01:00:00Z');
const run = (age = 0, conclusion = 'success') => ({
  event: 'schedule',
  head_branch: 'main',
  created_at: new Date(NOW - age).toISOString(),
  updated_at: new Date(NOW - age).toISOString(),
  status: 'completed',
  conclusion,
});
describe('independent scheduled-workflow health', () => {
  it('requires recent scheduled runs and recent completion; manual runs cannot mask missing schedules', () => {
    expect(inspectWorkflowRuns({ workflow_runs: [run()] }, NOW).issues).toEqual([]);
    expect(
      inspectWorkflowRuns(
        { workflow_runs: [{ ...run(), event: 'workflow_dispatch' }, run(WORKFLOW_STALE_MS + 1)] },
        NOW,
      ).issues,
    ).toContain('resource-workflow-missing-or-stale');
    expect(
      inspectWorkflowRuns(
        { workflow_runs: [{ ...run(), status: 'queued' }, run(WORKFLOW_STALE_MS + 1)] },
        NOW,
      ).issues,
    ).toContain('resource-workflow-completion-stale');
    expect(inspectWorkflowRuns({ workflow_runs: [run(0, 'failure')] }, NOW).issues).toContain(
      'resource-workflow-failed',
    );
    expect(inspectWorkflowRuns({ workflow_runs: [run(-120_000)] }, NOW).issues).toContain(
      'resource-workflow-missing-or-stale',
    );
  });
  it('reports permission/rate-limit/network and malformed results as unknown, using one bounded public GET', async () => {
    for (const response of [
      new Response('', { status: 403 }),
      Response.json({}),
      Response.json({ workflow_runs: [] }),
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      const result = await readWorkflowHealth(NOW, fetcher);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = fetcher.mock.calls[0]!;
      expect(String(url)).toContain('event=schedule');
      expect(init?.headers).not.toHaveProperty('Authorization');
      expect(init?.signal).toBeDefined();
    }
  });
});
