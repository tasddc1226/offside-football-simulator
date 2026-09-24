import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ORIGINS = new Set([
  'https://offside-web-staging.tasddc1569.workers.dev',
  'https://offside-lab.com',
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function candidatePaths(html) {
  const paths = [];
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const script = /^<script\b/i.test(tag) && /\btype=["']module["']/i.test(tag);
    const link = /^<link\b/i.test(tag) && /\brel=["'](?:modulepreload|stylesheet)["']/i.test(tag);
    if (!script && !link) continue;
    const value = tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
    // 외부 https 스타일시트(예: Google Fonts)는 배포 산출물이 아니므로 비교에서 뺀다. 외부 스크립트는 계속 거부한다.
    if (link && /\brel=["']stylesheet["']/i.test(tag) && value && /^https:\/\//i.test(value)) continue;
    if (!value || !/^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(value))
      throw new Error('INVALID_CANDIDATE_ASSET_PATH');
    paths.push(value);
  }
  const result = [...new Set(paths)].sort();
  if (!result.some((path) => path.endsWith('.js')) || !result.some((path) => path.endsWith('.css')))
    throw new Error('MISSING_CANDIDATE_ASSETS');
  return result;
}

export async function loadCandidate(dist) {
  const html = await readFile(resolve(dist, 'app-shell.html'), 'utf8');
  return new Map(await Promise.all(candidatePaths(html).map(async (path) => [
    path, digest(await readFile(resolve(dist, `.${path}`))),
  ])));
}

/** Read-only, bounded propagation check. It does not prove every CDN edge or upgrade open tabs. */
export async function waitForWebCandidate({
  origin, candidate, fetchImpl = fetch, timeoutMs = 180_000, requestTimeoutMs = 10_000,
  intervalMs = 3_000, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!ORIGINS.has(origin)) throw new Error('UNAPPROVED_WEB_ORIGIN');
  if (!(candidate instanceof Map) || candidate.size === 0) throw new Error('EMPTY_CANDIDATE');
  for (const [path, hash] of candidate) {
    if (!/^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(path) || !/^[a-f0-9]{64}$/.test(hash))
      throw new Error('INVALID_CANDIDATE');
  }
  const deadline = now() + timeoutMs;
  let consecutive = 0;
  let attempts = 0;
  let lastFailure = 'NOT_OBSERVED';
  async function get(path) {
    const remaining = Math.min(requestTimeoutMs, deadline - now());
    if (remaining <= 0) throw new Error('READINESS_TIMEOUT');
    const abort = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl(`${origin}${path}`, {
            method: 'GET', redirect: 'error', cache: 'no-store', signal: abort.signal,
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          });
          if (response.status !== 200 || response.redirected || response.url !== `${origin}${path}`)
            throw new Error('UNEXPECTED_WEB_RESPONSE');
          return new Uint8Array(await response.arrayBuffer());
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => { abort.abort(); reject(new Error('REQUEST_TIMEOUT')); }, remaining);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  while (now() < deadline) {
    attempts++;
    try {
      const paths = candidatePaths(new TextDecoder().decode(await get('/onboarding')));
      if (JSON.stringify(paths) !== JSON.stringify([...candidate.keys()].sort()))
        throw new Error('OLD_OR_DIFFERENT_SHELL');
      // Sequential requests bound network pressure and share the same overall deadline.
      for (const [path, expected] of candidate) {
        if (digest(await get(path)) !== expected) throw new Error('ASSET_HASH_MISMATCH');
      }
      consecutive++;
      if (consecutive === 2 && now() < deadline) return { attempts, assets: candidate.size, consecutive };
    } catch (error) {
      consecutive = 0;
      lastFailure = ['OLD_OR_DIFFERENT_SHELL', 'ASSET_HASH_MISMATCH', 'REQUEST_TIMEOUT', 'READINESS_TIMEOUT', 'UNEXPECTED_WEB_RESPONSE']
        .includes(error.message) ? error.message : 'WEB_FETCH_OR_PARSE_FAILED';
    }
    const remaining = deadline - now();
    if (remaining > 0) await sleep(Math.min(intervalMs, remaining));
  }
  throw new Error(`WEB_CANDIDATE_NOT_READY:${lastFailure}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [origin, dist] = process.argv.slice(2);
    if (!origin || !dist) throw new Error('USAGE: web-readiness.mjs approved-origin dist-directory');
    const result = await waitForWebCandidate({ origin, candidate: await loadCandidate(dist) });
    console.log(JSON.stringify({ webReadiness: 'verified', origin, ...result }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
