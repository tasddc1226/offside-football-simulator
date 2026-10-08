import type { Bindings } from '../env.js';
import { DAY_MS } from '../time.js';
import { DAILY_META_KEY } from './daily.js';
import { EVENT_ARCHIVE_META_KEY } from './seasonEventsArchive.js';

export const INFRA_HEALTH_META_KEY = 'cron:infra-health:last';
export const D1_LIMIT_BYTES = 10_000_000_000;
type Sample = { at: number; sizeBytes: number };
export type InfraHealth = {
  at: number;
  sizeBytes: number;
  growthBytesPerDay: number | null;
  daysToLimit: number | null;
  issues: string[];
  samples: Sample[];
};

export function assessInfraHealth(
  now: number,
  sizeBytes: number,
  previous: Sample[],
  daily: { ts?: string; level?: string; backup?: unknown } | null,
  archive: { at: number } | null,
  archiveEnabled: boolean,
): InfraHealth {
  const samples = [
    ...previous.filter(
      (s) =>
        Number.isFinite(s.sizeBytes) && s.sizeBytes > 0 && s.at >= now - 7 * DAY_MS && s.at < now,
    ),
    { at: now, sizeBytes },
  ];
  // Hourly samples are bounded; compare only a full day's history, not an initial partial hour.
  const first = samples.find((s) => now - s.at >= DAY_MS);
  const growthBytesPerDay = first
    ? Math.max(0, ((sizeBytes - first.sizeBytes) * DAY_MS) / (now - first.at))
    : null;
  const daysToLimit =
    growthBytesPerDay && growthBytesPerDay > 0
      ? Math.max(0, D1_LIMIT_BYTES - sizeBytes) / growthBytesPerDay
      : null;
  const issues: string[] = [];
  if (sizeBytes >= D1_LIMIT_BYTES * 0.7) issues.push('d1-storage-70-percent');
  if (daysToLimit !== null && daysToLimit <= 30) issues.push('d1-storage-less-than-30-days');
  const dailyAt = daily?.ts ? Date.parse(daily.ts) : NaN;
  if (!Number.isFinite(dailyAt) || dailyAt > now + 60_000 || now - dailyAt > 26 * 60 * 60_000)
    issues.push('daily-job-missing-or-stale');
  if (daily?.level === 'error') issues.push('daily-job-failed');
  if (
    !daily ||
    !daily.backup ||
    typeof daily.backup !== 'object' ||
    !('key' in daily.backup) ||
    typeof daily.backup.key !== 'string' ||
    !daily.backup.key
  )
    issues.push('backup-not-completed');
  if (
    archiveEnabled &&
    (!archive ||
      !Number.isFinite(archive.at) ||
      archive.at > now + 60_000 ||
      now - archive.at > 2 * 60 * 60_000)
  )
    issues.push('season-events-archive-stale');
  return {
    at: now,
    sizeBytes,
    growthBytesPerDay,
    daysToLimit,
    issues,
    samples: samples.slice(-169),
  };
}

/** Once an hour on the existing scheduled tick. No user requests or per-request writes. */
export async function runInfraHealth(env: Bindings, now: number): Promise<InfraHealth | null> {
  if (env.ENVIRONMENT !== 'production' || now % (60 * 60_000) !== 0) return null;
  const { results: stored, meta } = await env.DB.prepare(
    'SELECT key,value FROM app_meta WHERE key IN (?1,?2,?3)',
  )
    .bind(INFRA_HEALTH_META_KEY, DAILY_META_KEY, EVENT_ARCHIVE_META_KEY)
    .all<{ key: string; value: string }>();
  const read = <T>(key: string): T | null => {
    const value = stored.find((r) => r.key === key)?.value;
    return typeof value === 'string' ? (JSON.parse(value) as T) : null;
  };
  // page_count/freelist_count are not allowed by production D1. Read its supported
  // response metadata instead; this includes reusable pages, not just live payloads.
  if (!Number.isFinite(meta.size_after) || meta.size_after <= 0)
    throw new Error('D1 storage metadata unavailable');
  const previous = read<InfraHealth>(INFRA_HEALTH_META_KEY);
  const daily = read<{ ts?: string; level?: string; backup?: { key?: string } }>(DAILY_META_KEY);
  const result = assessInfraHealth(
    now,
    meta.size_after,
    previous?.samples ?? [],
    daily,
    read(EVENT_ARCHIVE_META_KEY),
    Boolean(env.BACKUP) && env.SEASON_EVENTS_ARCHIVE_DISABLED !== '1',
  );
  // HEAD sees completed objects, never an unfinished multipart upload. The
  // daily result alone cannot prove that the last backup still exists in R2.
  if (!env.BACKUP) result.issues.push('backup-binding-unavailable');
  if (!result.issues.includes('backup-not-completed') && env.BACKUP) {
    const key = daily!.backup!.key!;
    if (!key.startsWith(`d1/${env.ENVIRONMENT}/`) || !key.endsWith('.sql.gz')) {
      result.issues.push('backup-key-invalid');
    } else {
      const object = await env.BACKUP.head(key).catch(() => null);
      if (!object || object.size <= 0) result.issues.push('backup-object-missing-or-unavailable');
    }
  }
  await env.DB.prepare(
    'INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  )
    .bind(INFRA_HEALTH_META_KEY, JSON.stringify(result))
    .run();
  const log = { ...result, samples: undefined };
  console.log(
    JSON.stringify({ level: result.issues.length ? 'error' : 'info', job: 'infra-health', ...log }),
  );
  return result;
}
