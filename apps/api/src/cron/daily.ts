// T-10-070 매일 KST 04:00(UTC 19:00) cron. 정리가 실패해도 백업은 돈다. 결과는 요청 로그처럼
// JSON 한 줄로 남긴다(middleware/logger.ts와 같은 모양 — Workers Logs에서 job으로 찾는다).
import type { Bindings } from '../env.js';
import { sweepAnomalies, type SweepResult } from '../db/repos/anomalies.js';
import { backupToR2, type BackupResult } from './backup.js';
import { cleanupExpired, type CleanupResult } from './cleanup.js';
import { createDb } from '../db/client.js';
import { setMeta } from '../db/repos/firsts.js';
import { rebuildStaleAchievements } from '../team/ownerAchievements.js';

export type DailyResult = {
  cleanup: CleanupResult | { error: string };
  /** 비정상 기록 점검: 확실한 것은 숨기고 애매한 것은 운영자 검토로 남긴다(repos/anomalies.ts). */
  anomalies: SweepResult | { error: string };
  /** R2 바인딩(BACKUP)이 없으면(로컬·staging) 건너뛴다. */
  backup: BackupResult | { error: string } | 'skipped';
  /** T-11-028 놓친 구단주 업적 점수 다시 세기. */
  achievements: Awaited<ReturnType<typeof rebuildStaleAchievements>> | { error: string };
};

/** 요청 로그(middleware/logger.ts)처럼 메시지는 500자까지. */
const errorOf = (e: unknown) => ({
  error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
});

/** app_meta에 남기는 마지막 매일 작업 결과(JSON 한 줄). */
export const DAILY_META_KEY = 'cron:daily:last';

export async function runDaily(env: Bindings, now: number): Promise<DailyResult> {
  const startedAt = Date.now();
  // 정리 먼저 — 백업에 지울 행을 싣지 않는다.
  const cleanup = await cleanupExpired(env.DB, now).catch(errorOf);
  // 숨기는 쪽이 백업 전에 끝나도록 정리 다음에 돈다. 실패해도 백업은 돈다.
  const anomalies = await sweepAnomalies(env.DB, now).catch(errorOf);
  const backup = env.BACKUP
    ? await backupToR2(env.DB, env.BACKUP, env.ENVIRONMENT, now).catch(errorOf)
    : ('skipped' as const);
  // 이상 점검이 숨긴 커리어가 빠지도록 업적 점수는 점검 뒤에 센다.
  const achievements = await rebuildStaleAchievements(
    createDb(env.DB),
    new Date(now).toISOString(),
  ).catch(errorOf);
  const failed =
    'error' in cleanup ||
    'error' in anomalies ||
    (typeof backup === 'object' && 'error' in backup) ||
    'error' in achievements;
  const log = JSON.stringify({
    level: failed ? 'error' : 'info',
    ts: new Date().toISOString(),
    job: 'daily',
    cleanup,
    anomalies,
    backup,
    achievements,
    durationMs: Date.now() - startedAt,
  });
  console.log(log);
  // T-11-082 Workers Logs는 하루를 못 넘기고 지워진다 — 마지막 결과를 D1에도 남겨 나중에 조회한다.
  await setMeta(createDb(env.DB), DAILY_META_KEY, log)
    .run()
    .catch(() => {});
  return { cleanup, anomalies, backup, achievements };
}
