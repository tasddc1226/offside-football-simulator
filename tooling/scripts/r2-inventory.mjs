import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

/** Accounting only. No deletion policy can be inferred from object age: archives may have DB references. */
export function classifyObject(object, now = Date.now()) {
  if (typeof object?.key !== 'string' || !Number.isSafeInteger(object.size) || object.size < 0)
    throw new Error('R2 object observation malformed.');
  const match = /^d1\/(production|staging)\/(\d{4}-\d{2}-\d{2})(?:\/|\.sql\.gz$)/.exec(object.key);
  if (match) {
    const day = Date.parse(`${match[2]}T00:00:00Z`);
    if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== match[2])
      throw new Error('R2 backup date malformed.');
    const monthly = match[2].endsWith('-01');
    return {
      group: `d1/${match[1]}`,
      retention: monthly
        ? 'monthly-kept'
        : now - day > 30 * 86400000
          ? 'daily-over-30d-review'
          : 'daily-kept',
    };
  }
  return { group: object.key.split('/')[0] || 'other', retention: 'reference-review-required' };
}

export async function inventory(
  env = process.env,
  fetcher = fetch,
  { maxPages = 20, prefix = '', now = Date.now() } = {},
) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN)
    throw new Error('Cloudflare inventory credentials unavailable.');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100)
    throw new Error('Invalid inventory page bound.');
  const groups = new Map();
  let cursor;
  let complete = false;
  let pages = 0;
  const seen = new Set();
  for (; pages < maxPages;) {
    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/r2/buckets/offside-d1-backup/objects`,
    );
    url.searchParams.set('per_page', '1000');
    if (prefix) url.searchParams.set('prefix', prefix);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`R2 inventory unavailable (HTTP ${response.status}).`);
    const value = await response.json();
    if (
      value.success !== true ||
      value.errors?.length ||
      !Array.isArray(value.result) ||
      !(
        typeof value.result_info?.is_truncated === 'boolean' ||
        (value.result_info === undefined && value.result.length < 1000)
      )
    )
      throw new Error('R2 inventory response incomplete.');
    for (const object of value.result) {
      const { group, retention } = classifyObject(object, now);
      const key = `${group}:${retention}`;
      const row = groups.get(key) ?? { group, retention, objects: 0, bytes: 0 };
      row.objects++;
      row.bytes += object.size;
      groups.set(key, row);
    }
    pages++;
    // Cloudflare omits result_info on a terminal short page (verified live).
    if (value.result_info === undefined || !value.result_info.is_truncated) {
      complete = true;
      break;
    }
    const next = value.result_info.cursor;
    if (typeof next !== 'string' || !next || seen.has(next))
      throw new Error('R2 inventory pagination unavailable.');
    seen.add(next);
    cursor = next;
  }
  return {
    at: now,
    prefix,
    complete,
    pages,
    groups: [...groups.values()],
    note: 'Current payload bytes, not GB-month charges. Age buckets are review candidates, never deletion authorization. A live paginated scan is not a snapshot.',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      prefix: { type: 'string', default: '' },
      'max-pages': { type: 'string', default: '20' },
    },
  });
  inventory(process.env, fetch, { prefix: values.prefix, maxPages: Number(values['max-pages']) })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.complete) process.exitCode = 1;
    })
    .catch(() => {
      console.error('R2 inventory unavailable; no objects changed.');
      process.exitCode = 1;
    });
}
