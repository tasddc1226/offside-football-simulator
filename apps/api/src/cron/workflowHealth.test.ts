import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  inspectWorkflowRuns,
  readWorkflowHealth,
  WORKFLOW_STALE_MS,
  WORKFLOW_HEARTBEAT_KEY,
} from './workflowHealth.js';
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
  let ctx: TestD1;
  beforeAll(async () => {
    ctx = await createTestD1();
  });
  afterAll(async () => {
    await ctx.dispose();
  });
  const marker = {
    version: 1,
    repository: 'tasddc1226/offside-football-simulator',
    event: 'schedule',
    branch: 'main',
    runId: '123',
    createdAt: new Date(NOW - 60_000).toISOString(),
    completedAt: new Date(NOW).toISOString(),
    conclusion: 'success',
  };
  it('reads a bounded real R2 heartbeat without public GitHub access', async () => {
    await ctx.env.BACKUP!.put(WORKFLOW_HEARTBEAT_KEY, JSON.stringify(marker));
    expect(await readWorkflowHealth(NOW, ctx.env.BACKUP)).toMatchObject({
      observation: { conclusion: 'success', source: 'r2-resource-step' },
      issues: [],
    });
    await ctx.env.BACKUP!.put(
      WORKFLOW_HEARTBEAT_KEY,
      JSON.stringify({ ...marker, conclusion: 'failure' }),
    );
    expect((await readWorkflowHealth(NOW, ctx.env.BACKUP)).issues).toContain(
      'resource-workflow-failed',
    );
    expect(
      (await readWorkflowHealth(NOW + WORKFLOW_STALE_MS + 1, ctx.env.BACKUP)).issues,
    ).toContain('resource-workflow-missing-or-stale');
  });
  it('fails closed for missing, malformed, wrong-source, future, oversized and inaccessible markers', async () => {
    await ctx.env.BACKUP!.delete(WORKFLOW_HEARTBEAT_KEY);
    expect((await readWorkflowHealth(NOW, ctx.env.BACKUP)).observation.error).toBe('missing');
    for (const value of [
      null,
      { ...marker, event: 'workflow_dispatch' },
      { ...marker, branch: 'feature' },
      { ...marker, repository: 'other/repo' },
      { ...marker, runId: '' },
      { ...marker, conclusion: 'in_progress' },
      { ...marker, createdAt: 'bad' },
      { ...marker, completedAt: new Date(NOW - 120_000).toISOString() },
      'x'.repeat(5000),
    ]) {
      await ctx.env.BACKUP!.put(WORKFLOW_HEARTBEAT_KEY, JSON.stringify(value));
      expect((await readWorkflowHealth(NOW, ctx.env.BACKUP)).issues).toContain(
        'resource-workflow-observation-unavailable',
      );
    }
    await ctx.env.BACKUP!.put(
      WORKFLOW_HEARTBEAT_KEY,
      JSON.stringify({ ...marker, completedAt: new Date(NOW + 120_000).toISOString() }),
    );
    expect((await readWorkflowHealth(NOW, ctx.env.BACKUP)).issues).toContain(
      'resource-workflow-completion-stale',
    );
    expect((await readWorkflowHealth(NOW)).observation.error).toBe('unavailable');
  });
});
