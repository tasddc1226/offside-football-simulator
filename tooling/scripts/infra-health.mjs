import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Only aggregate operational state is read; never print raw DB/API envelopes. */
export function inspectInfraHealth(state, now = Date.now()) {
  if (
    !state ||
    !Number.isFinite(state.at) ||
    !Number.isFinite(state.sizeBytes) ||
    state.sizeBytes <= 0 ||
    now - state.at > 2 * 60 * 60_000 ||
    state.at > now + 60_000
  )
    throw new Error('Infrastructure health report missing or stale.');
  if (
    !Array.isArray(state.issues) ||
    !state.issues.every((s) => typeof s === 'string' && /^[a-z0-9-]+$/.test(s))
  )
    throw new Error('Infrastructure health report malformed.');
  const gib = (v) => (Number.isFinite(v) ? (v / 1024 ** 3).toFixed(2) : 'unknown');
  return {
    failed: state.issues.length > 0,
    summary: `D1 storage (including reusable pages): ${gib(state.sizeBytes)} GiB.\nIssues: ${state.issues.join(', ') || 'none'}.\n`,
  };
}

export async function checkProduction(env = process.env, fetcher = fetch) {
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error('Cloudflare monitoring credentials unavailable.');
  const api = async (suffix, body) => {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database${suffix}`,
      {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new Error(`Cloudflare D1 monitoring request failed (HTTP ${response.status}).`);
    const envelope = await response.json();
    if (!envelope.success || !envelope.result)
      throw new Error('Cloudflare D1 monitoring response unsuccessful.');
    return envelope.result;
  };
  const databases = await api('?per_page=100');
  const db = databases.find((d) => d.name === 'offside-production');
  if (!db?.uuid) throw new Error('Production database not found.');
  const blocks = await api(`/${encodeURIComponent(db.uuid)}/query`, {
    sql: "SELECT value FROM app_meta WHERE key='cron:infra-health:last'",
  });
  if (blocks.some((b) => !b.success)) throw new Error('Infrastructure health query failed.');
  const value = blocks[0]?.results?.[0]?.value;
  const report = inspectInfraHealth(value ? JSON.parse(value) : null);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, report.summary);
  console.log(report.summary);
  if (report.failed) throw new Error('Infrastructure health thresholds exceeded; see job summary.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkProduction().catch((error) => {
    // Never output fetch bodies/headers or error stacks containing credentials.
    console.error(error instanceof Error ? error.message : 'Infrastructure monitoring failed.');
    process.exitCode = 1;
  });
}
