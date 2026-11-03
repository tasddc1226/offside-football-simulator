import { pathToFileURL } from 'node:url';

export const HEARTBEAT_KEY = 'operations/production/infra-resource-workflow.json';
const REPOSITORY = 'tasddc1226/offside-football-simulator';
const json = async (response) => {
  try {
    return await response.json();
  } catch {
    throw new Error('Workflow response malformed');
  }
};

/** Only the scheduled resource step writes this marker. Never bless the whole monitoring job:
 * its backup check also reads this marker, which would create a permanent failure cycle. */
export async function publishInfraWorkflow(env = process.env, fetcher = fetch, now = Date.now()) {
  if (
    env.GITHUB_ACTIONS !== 'true' ||
    env.GITHUB_REPOSITORY !== REPOSITORY ||
    env.GITHUB_REF !== 'refs/heads/main' ||
    env.GITHUB_EVENT_NAME !== 'schedule' ||
    !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '') ||
    !['success', 'failure', 'cancelled', 'skipped'].includes(env.RESOURCE_OUTCOME) ||
    !env.GITHUB_TOKEN ||
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.CLOUDFLARE_API_TOKEN
  )
    throw new Error('Scheduled infrastructure publication context unavailable');
  const response = await fetcher(
    `https://api.github.com/repos/${REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'offside-infra-health',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    },
  );
  if (!response.ok) throw new Error(`Workflow identity request failed (HTTP ${response.status})`);
  const run = await json(response);
  const createdAt = Date.parse(run.created_at);
  if (
    String(run.id) !== env.GITHUB_RUN_ID ||
    run.event !== 'schedule' ||
    run.head_branch !== 'main' ||
    run.repository?.full_name !== REPOSITORY ||
    run.path !== '.github/workflows/infra-health.yml' ||
    !Number.isFinite(createdAt) ||
    createdAt > now ||
    now - createdAt > 3 * 60 * 60_000
  )
    throw new Error('Scheduled workflow identity or freshness mismatch');
  const body = JSON.stringify({
    version: 1,
    repository: REPOSITORY,
    event: 'schedule',
    branch: 'main',
    runId: env.GITHUB_RUN_ID,
    createdAt: new Date(createdAt).toISOString(),
    completedAt: new Date(now).toISOString(),
    conclusion: env.RESOURCE_OUTCOME,
  });
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/r2/buckets/offside-d1-backup/objects/${encodeURIComponent(HEARTBEAT_KEY)}`;
  const put = await fetcher(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/octet-stream',
    },
    body,
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  });
  if (!put.ok) throw new Error(`Workflow heartbeat publication failed (HTTP ${put.status})`);
  const result = await json(put);
  if (result.success !== true || result.errors?.length)
    throw new Error('Workflow heartbeat publication unsuccessful');
  console.log(`Scheduled resource check recorded: ${env.RESOURCE_OUTCOME}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  publishInfraWorkflow().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Workflow publication failed');
    process.exitCode = 1;
  });
}
