/** Independent of Actions scheduling: read public workflow metadata once per infra-health hour.
 * No token, dispatch, polling loop or notification delivery from the Worker. */
export const WORKFLOW_STALE_MS = 3 * 60 * 60_000;
const REPO = 'tasddc1226/offside-football-simulator';
export type WorkflowObservation = {
  at: number | null;
  completedAt: number | null;
  conclusion: string | null;
};
export function inspectWorkflowRuns(
  value: unknown,
  now: number,
): {
  observation: WorkflowObservation;
  issues: string[];
} {
  const runs = (value as { workflow_runs?: unknown[] } | null)?.workflow_runs;
  if (!Array.isArray(runs)) throw new Error('Workflow observation malformed');
  const scheduled = runs.filter(
    (r): r is Record<string, unknown> =>
      !!r &&
      typeof r === 'object' &&
      (r as Record<string, unknown>).event === 'schedule' &&
      (r as Record<string, unknown>).head_branch === 'main',
  );
  const latest = scheduled[0];
  const completed = scheduled.find((r) => r.status === 'completed');
  const at = typeof latest?.created_at === 'string' ? Date.parse(latest.created_at) : NaN;
  const completedAt =
    typeof completed?.updated_at === 'string' ? Date.parse(completed.updated_at) : NaN;
  const issues: string[] = [];
  if (!Number.isFinite(at) || at > now + 60_000 || now - at > WORKFLOW_STALE_MS)
    issues.push('resource-workflow-missing-or-stale');
  if (
    !Number.isFinite(completedAt) ||
    completedAt > now + 60_000 ||
    now - completedAt > WORKFLOW_STALE_MS
  )
    issues.push('resource-workflow-completion-stale');
  if (completed && completed.conclusion !== 'success') issues.push('resource-workflow-failed');
  return {
    observation: {
      at: Number.isFinite(at) ? at : null,
      completedAt: Number.isFinite(completedAt) ? completedAt : null,
      conclusion: typeof completed?.conclusion === 'string' ? completed.conclusion : null,
    },
    issues,
  };
}
export async function readWorkflowHealth(now: number, fetcher: typeof fetch = fetch) {
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${REPO}/actions/workflows/infra-health.yml/runs?branch=main&event=schedule&per_page=10`,
      {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'offside-infra-health' },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error('Workflow observation unavailable');
    return inspectWorkflowRuns(await response.json(), now);
  } catch {
    return {
      observation: { at: null, completedAt: null, conclusion: null },
      issues: ['resource-workflow-observation-unavailable'],
    };
  }
}
