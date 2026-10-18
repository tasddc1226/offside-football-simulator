import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const policy = JSON.parse(
  readFileSync(new URL('../cloudflare-infra-policy.json', import.meta.url)),
);

/** Missing observations are failures, never an empty/healthy queue. */
export function inspectQueueHealth(queues) {
  const issues = [];
  const lines = [];
  for (const name of policy.deadLetterQueues) {
    const queue = queues.find((q) => q.name === name);
    if (
      !queue ||
      !Number.isFinite(queue.backlog) ||
      queue.backlog < 0 ||
      !Number.isFinite(queue.retention)
    ) {
      issues.push('dlq-observation-missing');
      continue;
    }
    lines.push(`${name}: ${queue.backlog} pending, retention ${queue.retention / 86400} days.`);
    if (queue.backlog > 0) issues.push('dlq-backlog');
    if (queue.retention !== policy.dlqRetentionSeconds) issues.push('dlq-retention-drift');
  }
  return {
    failed: issues.length > 0,
    summary: `${lines.join('\n')}\nIssues: ${[...new Set(issues)].join(', ') || 'none'}.\n`,
  };
}

export function inspectR2Storage(row, now = Date.now()) {
  const at = Date.parse(row?.dimensions?.datetime);
  const bytes = row?.max?.payloadSize;
  if (
    !Number.isFinite(at) ||
    now - at > 2 * 60 * 60_000 ||
    at > now + 60_000 ||
    !Number.isFinite(bytes) ||
    bytes < 0
  )
    throw new Error('R2 storage observation missing or stale.');
  // Current bytes are an early warning, not this month's GB-month invoice.
  const fraction = bytes / policy.r2StandardIncludedStorageBytes;
  return {
    failed: false,
    warning: fraction >= policy.storageWarningFraction,
    summary: `R2 current payload: ${(bytes / 1e9).toFixed(3)} GB (${(fraction * 100).toFixed(1)}% of 10 GB reference; not GB-month usage).${fraction >= policy.storageWarningFraction ? ' STORAGE REVIEW DUE.' : ''}\n`,
  };
}

export function inspectDnssec(ds, address) {
  const validated =
    ds?.Status === 0 &&
    ds?.Answer?.some((a) => a.type === 43) &&
    address?.Status === 0 &&
    address?.AD === true;
  return {
    warning: !validated,
    summary: `DNSSEC parent DS and signed address: ${validated ? 'validated' : 'pending or unavailable'}.\n`,
  };
}

export async function checkResourceHealth(env = process.env, fetcher = fetch) {
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error('Cloudflare monitoring credentials unavailable.');
  const api = async (path, body) => {
    const response = await fetcher(`https://api.cloudflare.com/client/v4${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(`Cloudflare resource monitoring failed (HTTP ${response.status}).`);
    const envelope = await response.json();
    if (envelope.errors?.length || envelope.success === false)
      throw new Error('Cloudflare resource monitoring response unsuccessful.');
    // GraphQL uses data; Code Mode MCP uses result. This CLI calls HTTP directly.
    return body?.query ? envelope.data : envelope.result;
  };
  const base = `/accounts/${encodeURIComponent(account)}/queues`;
  const queues = await api(`${base}?per_page=100`);
  if (!Array.isArray(queues)) throw new Error('Queue inventory unavailable.');
  const observations = await Promise.all(
    policy.deadLetterQueues.map(async (name) => {
      const queue = queues.find((q) => q.queue_name === name);
      if (!queue?.queue_id) return { name };
      const metrics = await api(`${base}/${encodeURIComponent(queue.queue_id)}/metrics`);
      return {
        name,
        backlog: metrics?.backlog_count,
        retention: queue.settings?.message_retention_period,
      };
    }),
  );
  const report = inspectQueueHealth(observations);
  // Keep DLQ failures visible even if R2 analytics permission is unavailable.
  let r2;
  try {
    const since = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    const data = await api('/graphql', {
      query: `query($account: string!, $since: Time!) { viewer { accounts(filter: {accountTag: $account}) { r2StorageAdaptiveGroups(limit: 1, orderBy: [datetime_DESC], filter: {bucketName: "offside-d1-backup", storageClass: "Standard", datetime_geq: $since}) { dimensions { datetime } max { payloadSize } } } } }`,
      variables: { account, since },
    });
    r2 = inspectR2Storage(data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0]);
  } catch {
    r2 = {
      summary: 'R2 current storage: unknown (analytics permission, freshness or API failure).\n',
      warning: true,
    };
  }
  let dnssec;
  try {
    const readDns = async (type) => {
      // Public resolver requests must never receive the Cloudflare account token.
      const response = await fetcher(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(policy.zone)}&type=${type}`,
        { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok) throw new Error('DNS observation unavailable.');
      return response.json();
    };
    const [ds, address] = await Promise.all([readDns('DS'), readDns('A')]);
    dnssec = inspectDnssec(ds, address);
  } catch {
    dnssec = inspectDnssec(null, null);
  }
  const summary = `${report.summary}${r2.summary}${dnssec.summary}`;
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
  if (r2.warning && env.GITHUB_ACTIONS === 'true')
    console.log('::warning::R2 storage review required; see infrastructure summary.');
  if (dnssec.warning && env.GITHUB_ACTIONS === 'true')
    console.log(
      '::warning::DNSSEC DS propagation or validation pending; see infrastructure summary.',
    );
  if (report.failed) throw new Error('Dead-letter queue check failed; see job summary.');
}

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
    warning: state.sizeBytes >= policy.d1IncludedStorageBytes * policy.storageWarningFraction,
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
  if (report.warning && env.GITHUB_ACTIONS === 'true')
    console.log(
      '::warning::D1 storage exceeds 90% of the 5 GB included-storage reference; inspect account usage.',
    );
  if (report.failed) throw new Error('Infrastructure health thresholds exceeded; see job summary.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--resources') ? checkResourceHealth : checkProduction;
  check().catch((error) => {
    // Never output fetch bodies/headers or error stacks containing credentials.
    console.error(error instanceof Error ? error.message : 'Infrastructure monitoring failed.');
    process.exitCode = 1;
  });
}
