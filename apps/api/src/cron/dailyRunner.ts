import type { Bindings } from '../env.js';
import { createDb } from '../db/client.js';
import { DAY_MS } from '../time.js';
import { sweepAutomation, AUTOMATION_SWEEP_KEY } from '../db/repos/automationEnforcement.js';
import { sweepAnomaliesPage, type AnomalyCursor } from '../db/repos/anomalies.js';
import { rebuildStaleAchievements } from '../team/ownerAchievements.js';
import { syncGoogleVoided } from '../iap/refunds.js';
import { cleanupExpired } from './cleanup.js';
import { archiveGrowth } from './growthArchive.js';
import { runCareerRetention } from './careerRetention.js';
import { DAILY_META_KEY } from './daily.js';
import { backupDay } from './backup.js';
import { logErrorText } from '../logError.js';

export const DAILY_STATE_KEY = 'cron:daily:state';
const LEASE_MS = 4 * 60_000;
export const DAILY_STAGES = [
  'cleanup',
  'automation',
  'anomalies',
  'growthArchive',
  'careerRetention',
  'achievements',
  'iapRefunds',
] as const;
type Stage = (typeof DAILY_STAGES)[number];
export type DailyState = {
  day: string;
  stage: number;
  status: 'pending' | 'running' | 'retry' | 'complete';
  token: string;
  leaseUntil: number;
  nextAttemptAt: number;
  attempts: number;
  startedAt: number;
  updatedAt: number;
  results: Partial<Record<Stage, unknown>>;
  error?: string;
};
type StepResult = { done: boolean; result: unknown };
export type DailyStep = (
  stage: Stage,
  logicalAt: number,
  token: string,
  prior?: unknown,
) => Promise<StepResult>;

function steps(env: Bindings): DailyStep {
  return async (stage, at, token, prior) => {
    const db = createDb(env.DB);
    switch (stage) {
      case 'cleanup': {
        const result = await cleanupExpired(env.DB, at, { chunk: 1000, maxChunks: 2 });
        return { done: Object.values(result).every((n) => n < 2000), result };
      }
      case 'automation': {
        if (env.AUTOMATION_HIDE_DISABLED === '1') return { done: true, result: null };
        const saved = await env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
          .bind(AUTOMATION_SWEEP_KEY)
          .first<{ value: string }>();
        const prior = saved
          ? (JSON.parse(saved.value) as { through: string; status: string })
          : null;
        if (prior?.status === 'complete' && Date.parse(prior.through) >= at)
          return { done: true, result: prior };
        const result = await sweepAutomation(env.DB, at, false, { maxPages: 1, pageSize: 100 });
        return { done: result?.status === 'complete' && Date.parse(result.through) >= at, result };
      }
      case 'anomalies': {
        const result = await sweepAnomaliesPage(
          env.DB,
          at,
          (prior as { cursor?: AnomalyCursor } | undefined)?.cursor,
        );
        return { done: result.done, result };
      }
      case 'growthArchive': {
        const result = env.BACKUP
          ? await archiveGrowth(env.DB, env.BACKUP, env.ENVIRONMENT, at, {
              maxRows: 10_000,
              suffix: token,
            })
          : 'skipped';
        return { done: result === 'skipped' || result.rows < 10_000, result };
      }
      case 'careerRetention': {
        const result = await runCareerRetention(env, at);
        return { done: result.mode !== 'busy', result };
      }
      case 'achievements': {
        const result = await rebuildStaleAchievements(db, new Date(at).toISOString(), 20);
        return { done: result.refreshed < 20, result };
      }
      case 'iapRefunds':
        return { done: true, result: await syncGoogleVoided(env, db, at) };
    }
  };
}

/** One bounded stage on the existing five-minute tick. A lost cron or failed stage is picked up next time. */
export async function runDailyStep(
  env: Bindings,
  scheduledAt: number,
  execute: DailyStep = steps(env),
): Promise<DailyState | null> {
  if (env.ENVIRONMENT !== 'production' || !Number.isFinite(scheduledAt)) return null;
  const wall = Date.now();
  const dueDay = backupDay(scheduledAt);
  const { results } = await env.DB.prepare('SELECT key,value FROM app_meta WHERE key IN (?1,?2)')
    .bind(DAILY_STATE_KEY, DAILY_META_KEY)
    .all<{ key: string; value: string }>();
  const previous = results.find((r) => r.key === DAILY_STATE_KEY)?.value;
  const last = JSON.parse(results.find((r) => r.key === DAILY_META_KEY)?.value ?? 'null') as {
    ts?: string;
    day?: string;
    level?: string;
  } | null;
  let state = previous ? (JSON.parse(previous) as DailyState) : null;
  if (!state || state.status === 'complete') {
    const lastDay = state?.day ?? (last?.ts ? (last.day ?? backupDay(Date.parse(last.ts))) : null);
    if (lastDay && lastDay >= dueDay && last?.level !== 'error') return null;
    const nextDay =
      lastDay && last?.level !== 'error'
        ? new Date(Date.parse(lastDay) + DAY_MS).toISOString().slice(0, 10)
        : dueDay;
    state = {
      day: nextDay,
      stage: 0,
      status: 'pending',
      token: '',
      leaseUntil: 0,
      nextAttemptAt: 0,
      attempts: 0,
      startedAt: wall,
      updatedAt: wall,
      results: {},
    };
  }
  if (state.day > dueDay || state.leaseUntil > wall || state.nextAttemptAt > wall) return null;
  const claimed: DailyState = {
    ...state,
    token: crypto.randomUUID(),
    status: 'running',
    leaseUntil: wall + LEASE_MS,
    updatedAt: wall,
  };
  const claimedJson = JSON.stringify(claimed);
  // Compare the whole previous checkpoint: two overlapping ticks cannot own the same step.
  const claim = await env.DB.prepare(
    `INSERT INTO app_meta(key,value) VALUES (?1,?2)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE app_meta.value = ?3 RETURNING key`,
  )
    .bind(DAILY_STATE_KEY, claimedJson, previous ?? null)
    .first();
  if (!claim) return null;
  const stage = DAILY_STAGES[claimed.stage]!;
  let next: DailyState;
  try {
    const result = await execute(
      stage,
      Date.parse(claimed.day) + 19 * 3_600_000,
      claimed.token,
      claimed.results[stage],
    );
    next = {
      ...claimed,
      stage: claimed.stage + (result.done ? 1 : 0),
      status: 'pending',
      leaseUntil: 0,
      attempts: 0,
      nextAttemptAt: 0,
      updatedAt: Date.now(),
      results: { ...claimed.results, [stage]: result.result },
    };
    delete next.error;
    if (next.stage === DAILY_STAGES.length) next.status = 'complete';
  } catch (error) {
    // Do not advance the cursor or run dependent steps after failure.
    next = {
      ...claimed,
      status: 'retry',
      leaseUntil: 0,
      attempts: claimed.attempts + 1,
      nextAttemptAt: Date.now() + Math.min(3_600_000, 300_000 * 2 ** Math.min(claimed.attempts, 4)),
      updatedAt: Date.now(),
      error: logErrorText(error, 500),
    };
  }
  const owner = `EXISTS (SELECT 1 FROM app_meta WHERE key=?1 AND value=?2 AND json_extract(value,'$.leaseUntil') >= ?3)`;
  const completed = JSON.stringify({
    level: 'info',
    job: 'daily',
    day: next.day,
    ts: new Date(next.updatedAt).toISOString(),
    ...next.results,
    durationMs: next.updatedAt - next.startedAt,
  });
  // Completion and checkpoint are committed together; an expired owner cannot publish success.
  const committed = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO app_meta(key,value) SELECT ?4,?5 WHERE ${owner} AND ?6
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    ).bind(
      DAILY_STATE_KEY,
      claimedJson,
      Date.now(),
      DAILY_META_KEY,
      completed,
      next.status === 'complete' ? 1 : 0,
    ),
    env.DB.prepare(
      `UPDATE app_meta SET value=?4 WHERE key=?1 AND value=?2 AND json_extract(value,'$.leaseUntil') >= ?3`,
    ).bind(DAILY_STATE_KEY, claimedJson, Date.now(), JSON.stringify(next)),
  ]);
  if (!committed[1]!.meta.changes) return null;
  if (next.status === 'complete') console.log(completed);
  console.log(
    JSON.stringify({
      level: next.status === 'retry' ? 'error' : 'info',
      job: 'daily-step',
      day: next.day,
      stage,
      status: next.status,
      attempts: next.attempts,
      durationMs: Date.now() - wall,
    }),
  );
  return next;
}

const TICK_BUDGET_MS = 5000;
const ANOMALY_PAGES_PER_TICK = 10;
const ANOMALY_PAGE_SLOW_MS = 500;
const ANOMALY_PAGE_PAUSE_MS = 50;

/** Checkpoint each small page; allow a bounded burst only for the read-heavy anomaly scan. */
export async function runDailyTick(env: Bindings, scheduledAt: number, execute?: DailyStep) {
  const started = Date.now();
  const perform = execute ?? steps(env);
  let result: DailyState | null = null;
  let completedStages = 0;
  let anomalyPages = 0;
  let stepCount = 0;
  let yieldReason = 'time-budget';
  while (completedStages < 3 && Date.now() - started < TICK_BUDGET_MS) {
    const pageStarted = Date.now();
    let stage: Stage | undefined;
    const measured: DailyStep = (...args) => {
      stage = args[0];
      return perform(...args);
    };
    // Even a failed checkpoint read/claim must retain the overload signal so bulk work yields.
    const next = await runDailyStep(env, scheduledAt, measured).catch((error: unknown) => {
      const message = logErrorText(error);
      console.error(JSON.stringify({ level: 'error', job: 'daily-step', error: message }));
      return { status: 'retry' as const, error: message, stage: undefined };
    });
    if (next && next.stage === undefined) return next;
    if (!next) {
      yieldReason = 'no-claim';
      break;
    }
    result = next;
    stepCount++;
    if (next.status !== 'pending') {
      yieldReason = next.status;
      break;
    }
    const finished = next.stage > DAILY_STAGES.indexOf(stage!);
    if (finished) completedStages++;
    if (stage === 'anomalies') {
      anomalyPages++;
      // Include checkpoint/claim latency: a slow D1 round yields before another page starts.
      if (Date.now() - pageStarted >= ANOMALY_PAGE_SLOW_MS) {
        yieldReason = 'slow-page';
        break;
      }
      if (anomalyPages >= ANOMALY_PAGES_PER_TICK) {
        yieldReason = 'page-limit';
        break;
      }
    }
    if (finished) continue;
    if (stage !== 'anomalies') {
      yieldReason = 'partial-stage';
      break;
    }
    if (Date.now() - started + ANOMALY_PAGE_PAUSE_MS >= TICK_BUDGET_MS) break;
    // Keep user traffic interleaved instead of issuing an uninterrupted maintenance burst.
    await new Promise((resolve) => setTimeout(resolve, ANOMALY_PAGE_PAUSE_MS));
  }
  if (completedStages === 3) yieldReason = 'stage-limit';
  if (stepCount)
    console.log(
      JSON.stringify({
        level: result?.status === 'retry' ? 'error' : 'info',
        job: 'daily-tick',
        day: result?.day,
        stage: result?.stage,
        status: result?.status,
        steps: stepCount,
        anomalyPages,
        durationMs: Date.now() - started,
        yieldReason,
      }),
    );
  return result;
}
