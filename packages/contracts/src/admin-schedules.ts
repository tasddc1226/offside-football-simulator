import { z } from 'zod';

const schedule = z.object({
  name: z.string(),
  crons: z.array(z.string()),
  next: z.array(z.string()),
  recent: z.array(z.object({ at: z.string(), result: z.string() })),
});

export const ScheduleSourcesSchema = z.object({
  actions: z.array(schedule).nullable(),
  workers: z.array(schedule.extend({ available: z.boolean() })).nullable(),
  activity: z.array(
    z.object({
      worker: z.string(),
      events: z
        .array(
          z.object({
            at: z.number(),
            cron: z.string(),
            job: z.string().nullable(),
            result: z.string(),
          }),
        )
        .nullable(),
    }),
  ),
  errors: z.array(
    z.object({
      worker: z.string(),
      total: z.number().nullable(),
      jobs: z.array(z.object({ job: z.string(), count: z.number() })).nullable(),
    }),
  ),
});

export const AdminSchedulesSchema = z.object({
  observedAt: z.number(),
  sources: ScheduleSourcesSchema.nullable(),
  daily: z.object({ status: z.string(), updatedAt: z.number(), stage: z.number() }).nullable(),
  backup: z.object({ startedAt: z.number(), finishedAt: z.number(), steps: z.number() }).nullable(),
  backupRunningSince: z.number().nullable(),
  infra: z.object({ at: z.number(), issues: z.array(z.string()) }).nullable(),
});
export type AdminSchedules = z.infer<typeof AdminSchedulesSchema>;

export const BACKUP_CONTROL_PATH = '/v1/admin/schedules/backup';
export const BackupCommandSchema = z.strictObject({
  action: z.enum(['pause', 'resume']),
  revision: z.number().int().nonnegative(),
});
export const BackupPolicySchema = z.object({
  revision: z.number().int().nonnegative(),
  pausedUntil: z.number().nonnegative(),
  history: z.array(
    z.object({
      action: BackupCommandSchema.shape.action,
      at: z.number(),
      actor: z.string(),
    }),
  ),
});
export const BackupControlSchema = BackupPolicySchema.extend({
  observedAt: z.number(),
  draining: z.boolean(),
});
export type BackupControl = z.infer<typeof BackupControlSchema>;
