import { afterEach, expect, it, vi } from 'vitest';
import { ScheduleDashboard } from './scheduleDashboard.ts';
import type { Env } from './env.ts';

afterEach(() => vi.unstubAllGlobals());

it('keeps registered schedules and recorded outcomes separate when logs are unavailable', async () => {
  const fetcher = vi.fn(async (input: string) => {
    if (input.endsWith('/graphql'))
      return Response.json({
        data: {
          repository: {
            object: {
              entries: [
                {
                  name: 'checks.yml',
                  object: { text: "on:\n  schedule:\n    - cron: '17 * * * *'" },
                },
              ],
            },
          },
        },
      });
    if (input.includes('/actions/workflows?'))
      return Response.json({
        workflows: [
          { id: 1, name: 'Checks', path: '.github/workflows/checks.yml', state: 'active' },
          { id: 2, name: 'Deleted', path: '.github/workflows/deleted.yml', state: 'active' },
        ],
      });
    if (input.includes('/actions/runs?'))
      return Response.json({
        workflow_runs: [
          {
            workflow_id: 1,
            created_at: '2026-11-18T00:00:00Z',
            status: 'completed',
            conclusion: 'failure',
          },
        ],
      });
    if (input.endsWith('/schedules'))
      return Response.json({ success: true, result: { schedules: [{ cron: '*/5 * * * *' }] } });
    return Response.json({ success: false }, { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  const env = {
    GITHUB_REPO: 'example/repo',
    GITHUB_TOKEN: 'test',
    CF_MCP_TOKEN: 'test',
    CF_ACCOUNT_ID: 'test',
  } as Env;
  const r = await new ScheduleDashboard({} as ExecutionContext, env).snapshot();
  expect(r.actions).toHaveLength(1);
  expect(r.actions?.[0]?.recent).toEqual([{ at: '2026-11-18 09:00', result: 'failure' }]);
  expect(r.workers?.map((w) => w.available)).toEqual([true, true]);
  expect(r.errors.every((w) => w.total === null && w.jobs === null)).toBe(true);
  expect(r.activity.every((w) => w.events === null)).toBe(true);
  expect(fetcher.mock.calls.filter(([url]) => url.includes('github')).length).toBe(3);
});
