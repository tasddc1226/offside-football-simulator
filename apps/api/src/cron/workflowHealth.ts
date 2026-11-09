/** The Worker checks the scheduled resource step independently, even when Actions stops.
 * Read one private R2 heartbeat; no GitHub token or public API request from the Worker. */
export const WORKFLOW_HEARTBEAT_KEY = 'operations/production/infra-resource-workflow.json';
/** T-11-677 GitHub 예약 실행은 매시간 cron이어도 실제로는 4~8시간 간격으로 돈다(11-06~09 실측). 3시간 기준은
 * 정상 운영에서도 stale 경보를 냈다. Actions가 멈춘 걸 잡는 게 목적이라 12시간으로 둔다. */
export const WORKFLOW_STALE_MS = 12 * 60 * 60_000;
export type WorkflowObservation = {
  at: number | null;
  completedAt: number | null;
  conclusion: string | null;
  source?: 'r2-resource-step';
  error?: 'missing' | 'invalid' | 'unavailable';
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
export async function readWorkflowHealth(
  now: number,
  bucket?: R2Bucket,
): Promise<{ observation: WorkflowObservation; issues: string[] }> {
  const unavailable = (error: 'missing' | 'invalid' | 'unavailable') => ({
    observation: {
      at: null,
      completedAt: null,
      conclusion: null,
      source: 'r2-resource-step' as const,
      error,
    },
    issues: ['resource-workflow-observation-unavailable'],
  });
  try {
    if (!bucket) return unavailable('unavailable');
    const object = await bucket.get(WORKFLOW_HEARTBEAT_KEY);
    if (!object) return unavailable('missing');
    if (object.size > 4096) {
      await object.body.cancel();
      return unavailable('invalid');
    }
    const value = (await object.json()) as Record<string, unknown> | null;
    if (
      !value ||
      value.version !== 1 ||
      value.repository !== 'tasddc1226/offside-football-simulator' ||
      value.event !== 'schedule' ||
      value.branch !== 'main' ||
      typeof value.runId !== 'string' ||
      !/^[1-9][0-9]*$/.test(value.runId) ||
      typeof value.createdAt !== 'string' ||
      typeof value.completedAt !== 'string' ||
      !['success', 'failure', 'cancelled', 'skipped'].includes(String(value.conclusion)) ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      !Number.isFinite(Date.parse(value.completedAt)) ||
      Date.parse(value.completedAt) < Date.parse(value.createdAt)
    )
      return unavailable('invalid');
    const result = inspectWorkflowRuns(
      {
        workflow_runs: [
          {
            event: value.event,
            head_branch: value.branch,
            created_at: value.createdAt,
            updated_at: value.completedAt,
            status: 'completed',
            conclusion: value.conclusion,
          },
        ],
      },
      now,
    );
    return {
      ...result,
      observation: { ...result.observation, source: 'r2-resource-step' as const },
    };
  } catch {
    return unavailable('unavailable');
  }
}
