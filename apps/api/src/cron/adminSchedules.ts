import { AdminSchedulesSchema, ScheduleSourcesSchema } from '@offside/contracts';
import type { Bindings } from '../env.js';
import { BACKUP_LAST_KEY, BACKUP_STATE_KEY } from './backup.js';
import { DAILY_STATE_KEY } from './dailyRunner.js';
import { INFRA_HEALTH_META_KEY } from './infraHealth.js';

export async function readAdminSchedules(env: Bindings) {
  const [rows, external] = await Promise.all([
    env.DB.prepare('SELECT key,value FROM app_meta WHERE key IN (?,?,?,?)')
      .bind(DAILY_STATE_KEY, BACKUP_LAST_KEY, BACKUP_STATE_KEY, INFRA_HEALTH_META_KEY)
      .all<{ key: string; value: string }>(),
    env.SCHEDULE_DASHBOARD?.snapshot().catch(() => null),
  ]);
  const records = new Map<string, unknown>();
  for (const row of rows.results) {
    try {
      records.set(row.key, JSON.parse(row.value));
    } catch {
      // A malformed legacy record is unavailable independently of the other jobs.
    }
  }
  const schema = AdminSchedulesSchema.shape;
  const running = records.get(BACKUP_STATE_KEY) as { startedAt?: unknown } | undefined;
  return {
    observedAt: Date.now(),
    sources: ScheduleSourcesSchema.safeParse(external).data ?? null,
    daily: schema.daily.safeParse(records.get(DAILY_STATE_KEY)).data ?? null,
    backup: schema.backup.safeParse(records.get(BACKUP_LAST_KEY)).data ?? null,
    backupRunningSince: schema.backupRunningSince.safeParse(running?.startedAt).data ?? null,
    infra: schema.infra.safeParse(records.get(INFRA_HEALTH_META_KEY)).data ?? null,
  };
}
