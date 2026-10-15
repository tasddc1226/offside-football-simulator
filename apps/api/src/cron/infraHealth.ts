import type { Bindings } from '../env.js';
import { DAY_MS } from '../time.js';
import { BACKUP_LAST_KEY, BACKUP_STATE_KEY, chunkKey } from './backup.js';
import { DAILY_META_KEY } from './daily.js';
import { EVENT_ARCHIVE_META_KEY } from './seasonEventsArchive.js';

export const INFRA_HEALTH_META_KEY = 'cron:infra-health:last';
const HOUR_MS = 60 * 60_000;
export const D1_LIMIT_BYTES = 10_000_000_000;
type Sample = { at: number; sizeBytes: number };
/** T-11-269 끝난 백업(cron:backup:last)과 진행 중인 백업(cron:backup:state)에서 보는 것. */
export type BackupHealthInput = {
  last: { key?: string; chunks?: number; finishedAt?: number } | null;
  inProgress: { startedAt?: number } | null;
};
/** 하루 한 번 백업이 보통 KST 04시 뒤 1~3시간에 끝난다 — 이보다 오래 새 백업이 없으면 경보. */
export const BACKUP_STALE_MS = 30 * 60 * 60_000;
/** 조각 이어받기가 이만큼 끝나지 않으면 막힌 것으로 본다. */
export const BACKUP_STALL_MS = 6 * 60 * 60_000;
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
  daily: { ts?: string; level?: string } | null,
  archive: { at: number } | null,
  archiveEnabled: boolean,
  backup: BackupHealthInput = { last: null, inProgress: null },
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
  const finishedAt = backup.last?.finishedAt;
  if (
    !backup.last ||
    typeof backup.last.key !== 'string' ||
    !backup.last.key ||
    !Number.isFinite(finishedAt) ||
    finishedAt! > now + 60_000 ||
    now - finishedAt! > BACKUP_STALE_MS
  )
    issues.push('backup-not-completed');
  const startedAt = backup.inProgress?.startedAt;
  if (backup.inProgress && (!Number.isFinite(startedAt) || now - startedAt! > BACKUP_STALL_MS))
    issues.push('backup-stalled');
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
  if (env.ENVIRONMENT !== 'production' || !Number.isFinite(now) || now < 0) return null;
  const { results: stored, meta } = await env.DB.prepare(
    'SELECT key,value FROM app_meta WHERE key IN (?1,?2,?3,?4,?5)',
  )
    .bind(
      INFRA_HEALTH_META_KEY,
      DAILY_META_KEY,
      EVENT_ARCHIVE_META_KEY,
      BACKUP_LAST_KEY,
      BACKUP_STATE_KEY,
    )
    .all<{ key: string; value: string }>();
  const read = <T>(key: string): T | null => {
    const value = stored.find((r) => r.key === key)?.value;
    return typeof value === 'string' ? (JSON.parse(value) as T) : null;
  };
  const previousValue = stored.find((r) => r.key === INFRA_HEALTH_META_KEY)?.value ?? null;
  const previous = read<InfraHealth>(INFRA_HEALTH_META_KEY);
  // Cron timestamps include seconds. Use the last completed UTC hour, not exact alignment.
  // Older/delayed invocations must not replace a newer report.
  if (previous && Math.floor(previous.at / HOUR_MS) >= Math.floor(now / HOUR_MS)) return null;
  // page_count/freelist_count are not allowed by production D1. Read its supported
  // response metadata instead; this includes reusable pages, not just live payloads.
  if (!Number.isFinite(meta.size_after) || meta.size_after <= 0)
    throw new Error('D1 storage metadata unavailable');
  const daily = read<{ ts?: string; level?: string }>(DAILY_META_KEY);
  const backup: BackupHealthInput = {
    last: read(BACKUP_LAST_KEY),
    inProgress: read(BACKUP_STATE_KEY),
  };
  const result = assessInfraHealth(
    now,
    meta.size_after,
    previous?.samples ?? [],
    daily,
    read(EVENT_ARCHIVE_META_KEY),
    Boolean(env.BACKUP) && env.SEASON_EVENTS_ARCHIVE_DISABLED !== '1',
    backup,
  );
  // The completion record alone cannot prove the backup still exists in R2 — HEAD the
  // last chunk (T-11-269: a backup is a numbered chunk series under a day prefix).
  if (!env.BACKUP) result.issues.push('backup-binding-unavailable');
  if (!result.issues.includes('backup-not-completed') && env.BACKUP) {
    const key = backup.last!.key!;
    const chunks = backup.last!.chunks;
    if (
      !key.startsWith(`d1/${env.ENVIRONMENT}/`) ||
      !key.endsWith('/') ||
      !Number.isInteger(chunks) ||
      chunks! < 1
    ) {
      result.issues.push('backup-key-invalid');
    } else {
      const object = await env.BACKUP.head(chunkKey(key, chunks!)).catch(() => null);
      if (!object || object.size <= 0) result.issues.push('backup-object-missing-or-unavailable');
    }
  }
  // Compare-and-set the complete report, including samples. Concurrent triggers can
  // inspect R2, but only one commits; failed writes leave the hour retryable.
  const saved = await env.DB.prepare(
    'INSERT INTO app_meta(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE app_meta.value = ?3',
  )
    .bind(INFRA_HEALTH_META_KEY, JSON.stringify(result), previousValue)
    .run();
  if (!saved.meta.changes) return null;
  const log = { ...result, samples: undefined };
  console.log(
    JSON.stringify({ level: result.issues.length ? 'error' : 'info', job: 'infra-health', ...log }),
  );
  return result;
}
