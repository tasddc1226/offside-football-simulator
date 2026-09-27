// T-10-070 매일 KST 04:00(UTC 19:00) cron. 정리가 실패해도 백업은 돈다. 결과는 요청 로그처럼
// JSON 한 줄로 남긴다(middleware/logger.ts와 같은 모양 — Workers Logs에서 job으로 찾는다).
import type { Bindings } from '../env.js';
import { backupToR2, type BackupResult } from './backup.js';
import { cleanupExpired, type CleanupResult } from './cleanup.js';

export type DailyResult = {
  cleanup: CleanupResult | { error: string };
  /** R2 바인딩(BACKUP)이 없으면(로컬·staging) 건너뛴다. */
  backup: BackupResult | { error: string } | 'skipped';
};

const errorOf = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) });

export async function runDaily(env: Bindings, now: number): Promise<DailyResult> {
  const startedAt = Date.now();
  // 정리 먼저 — 백업에 지울 행을 싣지 않는다.
  const cleanup = await cleanupExpired(env.DB, now).catch(errorOf);
  const backup = env.BACKUP
    ? await backupToR2(env.DB, env.BACKUP, env.ENVIRONMENT, now).catch(errorOf)
    : ('skipped' as const);
  const failed = 'error' in cleanup || (typeof backup === 'object' && 'error' in backup);
  console.log(
    JSON.stringify({
      level: failed ? 'error' : 'info',
      ts: new Date().toISOString(),
      job: 'daily',
      cleanup,
      backup,
      durationMs: Date.now() - startedAt,
    }),
  );
  return { cleanup, backup };
}
