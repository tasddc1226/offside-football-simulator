import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { DAILY_META_KEY } from './daily.js';
import { INFRA_HEALTH_META_KEY } from './infraHealth.js';

vi.mock('../seasonSchedule.js', async (original) => ({
  ...(await original<typeof import('../seasonSchedule.js')>()),
  loadSeasonSchedule: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./dailyRunner.js', async (original) => ({
  ...(await original<typeof import('./dailyRunner.js')>()),
  runDailyTick: vi.fn().mockResolvedValue({ status: 'complete' }),
}));
import worker from '../index.js';

const NOW = Date.parse('2026-10-17T19:01:30.000Z');
let ctx: TestD1;
beforeAll(async () => {
  ctx = await createTestD1();
});
afterAll(async () => {
  vi.useRealTimers();
  await ctx.dispose();
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await ctx.env.DB.prepare('DELETE FROM app_meta WHERE key IN (?,?)')
    .bind(DAILY_META_KEY, INFRA_HEALTH_META_KEY)
    .run();
});

it('a delayed scheduled tick does not classify an already completed daily job as a future/stale job', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await ctx.env.DB.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)')
    .bind(DAILY_META_KEY, JSON.stringify({ level: 'info', ts: new Date(NOW).toISOString() }))
    .run();
  await worker.scheduled(
    { cron: '0 19 * * *', scheduledTime: NOW - 90_000, noRetry: () => {} },
    { ...ctx.env, ENVIRONMENT: 'production' },
  );
  const row = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
    .bind(INFRA_HEALTH_META_KEY)
    .first<{ value: string }>();
  const report = JSON.parse(row!.value) as { at: number; issues: string[] };
  expect(report.issues).not.toContain('daily-job-missing-or-stale');
  expect(report.at).toBe(NOW);
});

it('the daily trigger refreshes a same-hour stale report after actual completion', async () => {
  await ctx.env.DB.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)')
    .bind(DAILY_META_KEY, JSON.stringify({ level: 'info', ts: new Date(NOW).toISOString() }))
    .run();
  await ctx.env.DB.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)')
    .bind(
      INFRA_HEALTH_META_KEY,
      JSON.stringify({ at: NOW - 30_000, samples: [], issues: ['daily-job-missing-or-stale'] }),
    )
    .run();
  await worker.scheduled(
    { cron: '0 19 * * *', scheduledTime: NOW - 90_000, noRetry: () => {} },
    { ...ctx.env, ENVIRONMENT: 'production' },
  );
  const row = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
    .bind(INFRA_HEALTH_META_KEY)
    .first<{ value: string }>();
  const report = JSON.parse(row!.value) as { at: number; issues: string[] };
  expect(report.issues).not.toContain('daily-job-missing-or-stale');
  expect(report.at).toBe(NOW);
});
