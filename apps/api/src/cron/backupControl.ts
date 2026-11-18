import { BackupPolicySchema, type BackupControl } from '@offside/contracts';
import { conflictError } from '../routes/shared.js';

export const BACKUP_CONTROL_KEY = 'cron:backup:control';
export const BACKUP_LEASE_KEY = 'cron:backup:lease';

async function read(db: D1Database) {
  const { results } = await db
    .prepare('SELECT key,value FROM app_meta WHERE key IN (?,?)')
    .bind(BACKUP_CONTROL_KEY, BACKUP_LEASE_KEY)
    .all<{ key: string; value: string }>();
  const raw = results.find((row) => row.key === BACKUP_CONTROL_KEY)?.value ?? null;
  const lease = results.find((row) => row.key === BACKUP_LEASE_KEY);
  const policy =
    raw === null
      ? { revision: 0, pausedUntil: 0, history: [] }
      : BackupPolicySchema.parse(JSON.parse(raw));
  const observedAt = Date.now();
  const view: BackupControl = {
    ...policy,
    observedAt,
    draining:
      policy.pausedUntil > observedAt && !!lease && JSON.parse(lease.value).expiresAt > observedAt,
  };
  return { raw, view };
}

export async function backupControl(db: D1Database) {
  return (await read(db)).view;
}

export async function setBackupControl(
  db: D1Database,
  action: 'pause' | 'resume',
  revision: number,
  actor: string,
) {
  const { raw, view } = await read(db);
  const stale = () => conflictError('Backup control state has changed.', 'BACKUP_CONTROL_CHANGED');
  const alreadyPaused = view.pausedUntil > view.observedAt;
  if (view.revision !== revision || (action === 'pause') === alreadyPaused) throw stale();
  const next = JSON.stringify({
    revision: revision + 1,
    pausedUntil: action === 'pause' ? view.observedAt + 30 * 60_000 : 0,
    history: [{ action, at: view.observedAt, actor }, ...view.history].slice(0, 20),
  });
  // State and audit history share one compare-and-swap, including first creation.
  const changed =
    raw === null
      ? await db
          .prepare('INSERT OR IGNORE INTO app_meta(key,value) VALUES(?,?)')
          .bind(BACKUP_CONTROL_KEY, next)
          .run()
      : await db
          .prepare('UPDATE app_meta SET value=? WHERE key=? AND value=?')
          .bind(next, BACKUP_CONTROL_KEY, raw)
          .run();
  if (!changed.meta.changes) throw stale();
  return backupControl(db);
}
