import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import {
  DAILY_STAGES,
  DAILY_STATE_KEY,
  runDailyStep,
  runDailyTick,
  type DailyState,
  type DailyStep,
} from './dailyRunner.js';
import { DAILY_META_KEY } from './daily.js';
let ctx: TestD1;
const NOW = Date.parse('2026-10-17T09:00:00Z');
beforeAll(async () => {
  ctx = await createTestD1();
  ctx.env.ENVIRONMENT = 'production';
});
afterAll(() => ctx.dispose());
beforeEach(async () => {
  await ctx.env.DB.prepare('DELETE FROM app_meta WHERE key IN (?,?)')
    .bind(DAILY_STATE_KEY, DAILY_META_KEY)
    .run();
});
const read = async () =>
  JSON.parse(
    (await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
      .bind(DAILY_STATE_KEY)
      .first<{ value: string }>())!.value,
  ) as DailyState;
it('checkpoints successful stages and resumes a failed stage without repeating completed ones', async () => {
  const execute = vi.fn<DailyStep>().mockResolvedValue({ done: true, result: { ok: true } });
  expect((await runDailyStep(ctx.env, NOW, execute))?.stage).toBe(1);
  execute.mockRejectedValueOnce(new Error('temporary failure'));
  expect((await runDailyStep(ctx.env, NOW, execute))?.status).toBe('retry');
  expect(await runDailyStep(ctx.env, NOW, execute)).toBeNull();
  const state = await read();
  state.nextAttemptAt = 0;
  await ctx.env.DB.prepare('UPDATE app_meta SET value=? WHERE key=?')
    .bind(JSON.stringify(state), DAILY_STATE_KEY)
    .run();
  for (let i = 1; i < DAILY_STAGES.length; i++) await runDailyStep(ctx.env, NOW, execute);
  expect((await read()).status).toBe('complete');
  expect(execute.mock.calls.map(([s]) => s)).toEqual([
    'cleanup',
    'automation',
    'automation',
    ...DAILY_STAGES.slice(2),
  ]);
  expect(await runDailyStep(ctx.env, NOW, execute)).toBeNull();
  const last = JSON.parse(
    (await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
      .bind(DAILY_META_KEY)
      .first<{ value: string }>())!.value,
  );
  expect(last).toMatchObject({ day: '2026-10-16', level: 'info' });
});
it('overlapping ticks execute a stage only once', async () => {
  let finish: () => void = () => {};
  const blocked = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const execute = vi.fn<DailyStep>().mockImplementation(async () => {
    await blocked;
    return { done: true, result: 1 };
  });
  const first = runDailyStep(ctx.env, NOW, execute);
  await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
  expect(await runDailyStep(ctx.env, NOW, execute)).toBeNull();
  finish();
  await first;
  expect(execute).toHaveBeenCalledTimes(1);
});
it('an expired owner cannot commit a checkpoint after another execution took over', async () => {
  const execute: DailyStep = async () => {
    const state = await read();
    state.token = 'new-owner';
    state.leaseUntil = Date.now() + 60_000;
    await ctx.env.DB.prepare('UPDATE app_meta SET value=? WHERE key=?')
      .bind(JSON.stringify(state), DAILY_STATE_KEY)
      .run();
    return { done: true, result: 1 };
  };
  expect(await runDailyStep(ctx.env, NOW, execute)).toBeNull();
  expect((await read()).token).toBe('new-owner');
  expect((await read()).stage).toBe(0);
});

it('catches up the next missing business day, and a partial page stays on the same stage', async () => {
  await ctx.env.DB.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)')
    .bind(DAILY_META_KEY, JSON.stringify({ ts: '2026-10-14T20:00:00Z', level: 'info' }))
    .run();
  const execute = vi
    .fn<DailyStep>()
    .mockResolvedValueOnce({ done: false, result: { rows: 1000 } })
    .mockResolvedValue({ done: true, result: { rows: 1 } });
  expect(await runDailyStep(ctx.env, NOW, execute)).toMatchObject({ day: '2026-10-15', stage: 0 });
  expect(await runDailyStep(ctx.env, NOW, execute)).toMatchObject({ day: '2026-10-15', stage: 1 });
  expect(execute.mock.calls.map(([s]) => s)).toEqual(['cleanup', 'cleanup']);
});

it('runs the real bounded stages against local D1 through to a durable completion record', async () => {
  const env = { ...ctx.env };
  delete env.BACKUP;
  for (let tick = 0; tick < 12; tick++) {
    const state = await runDailyStep(env, NOW);
    expect(state?.status).not.toBe('retry');
    if (state?.status === 'complete') break;
  }
  expect(await read()).toMatchObject({ status: 'complete', stage: DAILY_STAGES.length });
});

it('a tick advances at most three completed stages and yields a partial page immediately', async () => {
  const execute = vi.fn<DailyStep>().mockResolvedValue({ done: true, result: 1 });
  expect((await runDailyTick(ctx.env, NOW, execute))?.stage).toBe(3);
  expect(execute).toHaveBeenCalledTimes(3);
  execute.mockClear();
  execute.mockResolvedValue({ done: false, result: { rows: 1000 } });
  expect((await runDailyTick(ctx.env, NOW, execute))?.stage).toBe(3);
  expect(execute).toHaveBeenCalledTimes(1);
});

it('a busy retention lease does not count as a completed daily step', async () => {
  const state: DailyState = {
    day: '2026-10-16',
    stage: 4,
    status: 'pending',
    token: '',
    leaseUntil: 0,
    nextAttemptAt: 0,
    attempts: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    results: {},
  };
  await ctx.env.DB.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)')
    .bind(DAILY_STATE_KEY, JSON.stringify(state))
    .run();
  await ctx.env.DB.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)')
    .bind(
      'cron:career-retention:lease',
      JSON.stringify({ token: 'other', expiresAt: Date.now() + 60_000 }),
    )
    .run();
  try {
    expect(await runDailyStep(ctx.env, NOW)).toMatchObject({
      stage: 4,
      status: 'pending',
      results: { careerRetention: { mode: 'busy' } },
    });
  } finally {
    await ctx.env.DB.prepare("DELETE FROM app_meta WHERE key='cron:career-retention:lease'").run();
  }
});
