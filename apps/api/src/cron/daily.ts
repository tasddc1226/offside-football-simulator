import { sweepAutomation } from '../db/repos/automationEnforcement.js';
// T-10-070 매일 KST 04:00(UTC 19:00) cron. 한 단계가 실패해도 나머지는 돈다. 결과는 요청 로그처럼
// JSON 한 줄로 남긴다(middleware/logger.ts와 같은 모양 — Workers Logs에서 job으로 찾는다).
// T-11-269 R2 백업은 여기서 빠졌다 — 15분 상한을 넘겨 뒤 단계를 함께 죽였다. 지금은 5분 cron이 조각으로 올린다(backup.ts).
import type { Bindings } from '../env.js';
import { sweepAnomalies, type SweepResult } from '../db/repos/anomalies.js';
import { runCareerRetention, type RetentionResult } from './careerRetention.js';
import { archiveGrowth, type GrowthArchiveResult } from './growthArchive.js';
import { cleanupExpired, type CleanupResult } from './cleanup.js';
import { createDb } from '../db/client.js';
import { setMeta } from '../db/repos/firsts.js';
import { rebuildStaleAchievements } from '../team/ownerAchievements.js';
import { syncGoogleVoided } from '../iap/refunds.js';

export type DailyResult = {
  automation: Awaited<ReturnType<typeof sweepAutomation>> | { error: string };
  careerRetention: RetentionResult | { error: string };
  cleanup: CleanupResult | { error: string };
  /** 비정상 기록 점검: 확실한 것은 숨기고 애매한 것은 운영자 검토로 남긴다(repos/anomalies.ts). */
  anomalies: SweepResult | { error: string };
  /** T-11-100 오래된 시즌 성장 기록을 R2로 옮기고 D1에서 비운다. R2 바인딩이 없으면 건너뛴다. */
  growthArchive: GrowthArchiveResult | { error: string } | 'skipped';
  /** T-11-028 놓친 구단주 업적 점수 다시 세기. */
  achievements: Awaited<ReturnType<typeof rebuildStaleAchievements>> | { error: string };
  /** T-11-215 Google Play가 무효화(환불)한 구매의 아이템 회수. 서비스 계정 키가 없으면 건너뛴다. */
  iapRefunds: Awaited<ReturnType<typeof syncGoogleVoided>> | { error: string };
};

/** 요청 로그(middleware/logger.ts)처럼 메시지는 500자까지. */
const errorOf = (e: unknown) => ({
  error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
});

/** app_meta에 남기는 마지막 매일 작업 결과(JSON 한 줄). */
export const DAILY_META_KEY = 'cron:daily:last';

export async function runDaily(env: Bindings, now: number): Promise<DailyResult> {
  const startedAt = Date.now();
  // 정리 먼저 — 그날 백업에 지울 행을 싣지 않는다.
  const cleanup = await cleanupExpired(env.DB, now).catch(errorOf);
  // 숨기는 쪽이 정리 다음에 돈다. 실패해도 뒤 단계는 돈다.
  const automation =
    env.AUTOMATION_HIDE_DISABLED === '1' ? null : await sweepAutomation(env.DB, now).catch(errorOf);
  const anomalies = await sweepAnomalies(env.DB, now).catch(errorOf);
  // 옮기기는 R2에 올린 뒤에만 비운다.
  const growthArchive = env.BACKUP
    ? await archiveGrowth(env.DB, env.BACKUP, env.ENVIRONMENT, now).catch(errorOf)
    : ('skipped' as const);
  const careerRetention = await runCareerRetention(env, now).catch(errorOf);
  // 이상 점검이 숨긴 커리어가 빠지도록 업적 점수는 점검 뒤에 센다.
  const achievements = await rebuildStaleAchievements(
    createDb(env.DB),
    new Date(now).toISOString(),
  ).catch(errorOf);
  const iapRefunds = await syncGoogleVoided(env, createDb(env.DB), now).catch(errorOf);
  const failed =
    (automation !== null && 'error' in automation) ||
    (typeof iapRefunds === 'object' && 'error' in iapRefunds) ||
    'error' in cleanup ||
    'error' in anomalies ||
    (typeof growthArchive === 'object' && 'error' in growthArchive) ||
    'error' in achievements ||
    'error' in careerRetention;
  const log = JSON.stringify({
    level: failed ? 'error' : 'info',
    ts: new Date().toISOString(),
    job: 'daily',
    cleanup,
    anomalies,
    automation,
    growthArchive,
    careerRetention,
    achievements,
    iapRefunds,
    durationMs: Date.now() - startedAt,
  });
  console.log(log);
  // T-11-082 Workers Logs는 하루를 못 넘기고 지워진다 — 마지막 결과를 D1에도 남겨 나중에 조회한다.
  await setMeta(createDb(env.DB), DAILY_META_KEY, log).catch((e: unknown) =>
    console.error(JSON.stringify({ level: 'error', job: 'daily', meta: errorOf(e) })),
  );
  // 단계마다 오류를 잡아 나머지는 끝까지 돌리지만, 하나라도 실패했으면 실행을 실패로 남긴다(호출 기록에서 보이게).
  if (failed) throw new Error(`daily job failed: ${log.slice(0, 300)}`);
  return {
    cleanup,
    anomalies,
    automation,
    growthArchive,
    careerRetention,
    achievements,
    iapRefunds,
  };
}
