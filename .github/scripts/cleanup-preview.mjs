import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const PR_NUMBER_PATTERN = /^[1-9][0-9]*$/;
const DELETE_TIMEOUT_MS = 30_000;

export function previewWorkerNames(prNumber) {
  if (typeof prNumber !== 'string' || !PR_NUMBER_PATTERN.test(prNumber)) {
    throw new Error('PR_NUMBER must be a positive decimal integer');
  }
  return [`offside-api-pr-${prNumber}`, `offside-web-pr-${prNumber}`];
}

function workerDeleteUrl(accountId, workerName, apiBase = CLOUDFLARE_API_BASE) {
  return `${apiBase}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}`;
}

function errorCodes(envelope) {
  if (!Array.isArray(envelope?.errors)) return [];
  return envelope.errors
    .map((error) => error?.code)
    .filter((code) => typeof code === 'number' || (typeof code === 'string' && /^[0-9]+$/.test(code)))
    .map(String);
}

export async function deletePreviewWorker({ accountId, token, workerName, fetchImpl = fetch, apiBase }) {
  if (!accountId || !token) throw new Error('Cloudflare account and token are required');
  const response = await fetchImpl(workerDeleteUrl(accountId, workerName, apiBase), {
    method: 'DELETE',
    signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const bodyText = await response.text();
  let envelope = null;
  if (bodyText.trim()) {
    try {
      envelope = JSON.parse(bodyText);
    } catch {
      envelope = null;
    }
  }

  if (response.status === 404) return { workerName, status: 'already-absent', statusCode: 404 };
  // The delete endpoint documents both an empty success response and a JSON envelope.
  if ((response.status === 200 || response.status === 204) && !bodyText.trim()) {
    return { workerName, status: 'deleted', statusCode: response.status };
  }
  if (response.status >= 200 && response.status < 300 && envelope?.success === true) {
    return { workerName, status: 'deleted', statusCode: response.status };
  }

  const codes = errorCodes(envelope);
  const detail = codes.length > 0 ? ` CF error codes: ${codes.join(', ')}` : '';
  const reason = response.status >= 200 && response.status < 300
    ? 'missing or unsuccessful JSON envelope'
    : 'HTTP error';
  throw new Error(`Cloudflare refused ${workerName}: ${reason} HTTP ${response.status}${detail}`);
}

export async function cleanupPreview({ accountId, token, prNumber, fetchImpl = fetch, apiBase }) {
  const workerNames = previewWorkerNames(prNumber);
  const results = [];
  let failed = false;

  for (const workerName of workerNames) {
    try {
      results.push(await deletePreviewWorker({ accountId, token, workerName, fetchImpl, apiBase }));
    } catch (error) {
      failed = true;
      results.push({ workerName, status: 'failed', error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { results, ok: !failed };
}

export async function main(env = process.env) {
  const outcome = await cleanupPreview({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    token: env.CLOUDFLARE_API_TOKEN,
    prNumber: env.PR_NUMBER,
  });
  for (const result of outcome.results) console.log(JSON.stringify(result));
  if (!outcome.ok) throw new Error('One or more preview Worker deletions failed');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
