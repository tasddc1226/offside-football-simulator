import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
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
afterEach(() => vi.restoreAllMocks());
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

it('retains a nested overload cause when a checkpoint read fails, without claiming completion', async () => {
  const error = Object.assign(
    new Error('query failed params: private-value', {
      cause: new Error('D1 DB is overloaded. Requests queued for too long.'),
    }),
    { query: 'SELECT value FROM app_meta WHERE key=?' },
  );
  const DB = new Proxy(ctx.env.DB, {
    get(target, key) {
      if (key === 'prepare')
        return () => {
          throw error;
        };
      const v = Reflect.get(target, key);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  const result = await runDailyTick({ ...ctx.env, DB }, NOW);
  expect(result).toMatchObject({
    status: 'retry',
    error: expect.stringContaining('D1 DB is overloaded'),
  });
  expect(result?.error).not.toContain('private-value');
  expect(
    await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
      .bind(DAILY_STATE_KEY)
      .first(),
  ).toBeNull();
});

it('retains a nested stage failure cause in the durable retry checkpoint', async () => {
  const execute: DailyStep = async () => {
    throw new Error('wrapped failure', { cause: new Error('D1_ERROR: Network connection lost.') });
  };
  expect(await runDailyStep(ctx.env, NOW, execute)).toMatchObject({
    status: 'retry',
    error: expect.stringContaining('Network connection lost'),
  });
  expect((await read()).attempts).toBe(1);
});

it('passes a partial stage cursor back to the next claimed execution', async () => {
  const cursor = { at: 'same-timestamp', id: 'last-id' };
  const execute = vi
    .fn<DailyStep>()
    .mockResolvedValueOnce({ done: false, result: { cursor } })
    .mockResolvedValue({ done: true, result: {} });
  await runDailyStep(ctx.env, NOW, execute);
  await runDailyStep(ctx.env, NOW, execute);
  expect(execute.mock.calls[1]![3]).toEqual({ cursor });
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
  // T-11-572 kpi 단계는 처음에 90일을 7일씩 거꾸로 채워 여러 걸음이 걸린다.
  for (let tick = 0; tick < 30; tick++) {
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

async function beginAnomalies() {
  const execute: DailyStep = async () => ({ done: true, result: {} });
  await runDailyStep(ctx.env, NOW, execute);
  await runDailyStep(ctx.env, NOW, execute);
  // Scheduling bounds are tested with an explicit clock, independent of CI D1 latency.
  vi.spyOn(Date, 'now').mockReturnValue(Date.now());
}

it('checkpoints ten small anomaly pages per tick and resumes the last committed cursor', async () => {
  await beginAnomalies();
  let pages = 0;
  const execute = vi.fn<DailyStep>().mockImplementation(async (stage, _at, _token, prior) => {
    expect(stage).toBe('anomalies');
    if (pages) expect(prior).toEqual({ cursor: { page: pages }, checked: 100 });
    pages++;
    return { done: false, result: { cursor: { page: pages }, checked: 100 } };
  });
  const log = vi.spyOn(console, 'log');
  expect(await runDailyTick(ctx.env, NOW, execute)).toMatchObject({ stage: 2, status: 'pending' });
  expect(execute).toHaveBeenCalledTimes(10);
  expect(await read()).toMatchObject({ results: { anomalies: { cursor: { page: 10 } } } });
  expect(log).toHaveBeenCalledWith(expect.stringContaining('"yieldReason":"page-limit"'));
  await runDailyTick(ctx.env, NOW, execute);
  expect(pages).toBe(20);
});

it('a failed later page preserves earlier progress and the normal retry backoff', async () => {
  await beginAnomalies();
  let pages = 0;
  const execute = vi.fn<DailyStep>().mockImplementation(async () => {
    if (++pages === 3) throw new Error('D1 DB is overloaded');
    return { done: false, result: { cursor: { page: pages } } };
  });
  expect(await runDailyTick(ctx.env, NOW, execute)).toMatchObject({
    stage: 2,
    status: 'retry',
    attempts: 1,
    results: { anomalies: { cursor: { page: 2 } } },
  });
  expect(await runDailyTick(ctx.env, NOW, execute)).toBeNull();
  expect(execute).toHaveBeenCalledTimes(3);
  const state = await read();
  state.nextAttemptAt = 0;
  await ctx.env.DB.prepare('UPDATE app_meta SET value=? WHERE key=?')
    .bind(JSON.stringify(state), DAILY_STATE_KEY)
    .run();
  const resume = vi.fn<DailyStep>().mockResolvedValue({ done: true, result: {} });
  expect((await runDailyTick(ctx.env, NOW, resume))?.stage).toBe(5);
  expect(resume.mock.calls[0]![3]).toEqual({ cursor: { page: 2 } });
  expect(resume.mock.calls.map(([stage]) => stage)).toEqual([
    'anomalies',
    'growthArchive',
    'careerRetention',
  ]);
});

it('yields after a slow anomaly page, retaining its cursor instead of starting another page', async () => {
  await beginAnomalies();
  let clock = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => clock);
  const execute = vi.fn<DailyStep>().mockImplementation(async () => {
    clock += 2000;
    return { done: false, result: { cursor: { page: 1 } } };
  });
  const log = vi.spyOn(console, 'log');
  await runDailyTick(ctx.env, NOW, execute);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(await read()).toMatchObject({ results: { anomalies: { cursor: { page: 1 } } } });
  expect(log).toHaveBeenCalledWith(expect.stringContaining('"yieldReason":"slow-page"'));
});

it('makes multiple pages of progress at the observed 1.2-second production round-trip latency', async () => {
  await beginAnomalies();
  let clock = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => clock);
  let page = 0;
  const execute = vi.fn<DailyStep>().mockImplementation(async () => {
    clock += 1250;
    return { done: false, result: { cursor: { page: ++page } } };
  });
  await runDailyTick(ctx.env, NOW, execute);
  expect(execute).toHaveBeenCalledTimes(4);
  expect(await read()).toMatchObject({ results: { anomalies: { cursor: { page: 4 } } } });
});

it('checks the shared time budget before pausing for another anomaly page', async () => {
  await runDailyStep(ctx.env, NOW, async () => ({ done: true, result: {} }));
  let clock = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => clock);
  const execute = vi.fn<DailyStep>().mockImplementation(async (stage) => {
    clock += stage === 'automation' ? 4900 : 60;
    return { done: stage === 'automation', result: { cursor: { page: 1 } } };
  });
  const log = vi.spyOn(console, 'log');
  await runDailyTick(ctx.env, NOW, execute);
  expect(execute.mock.calls.map(([stage]) => stage)).toEqual(['automation', 'anomalies']);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('"yieldReason":"time-budget"'));
});

it('allows a completed anomaly page to advance but still yields write-heavy partial stages', async () => {
  await beginAnomalies();
  const execute = vi.fn<DailyStep>().mockImplementation(async (stage) => ({
    done: stage === 'anomalies',
    result: stage === 'anomalies' ? { done: true, checked: 1, cursor: null } : { rows: 10_000 },
  }));
  expect((await runDailyTick(ctx.env, NOW, execute))?.stage).toBe(3);
  expect(execute.mock.calls.map(([stage]) => stage)).toEqual(['anomalies', 'growthArchive']);
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

it('the real scanner completes three 100-career pages in one tick, including a same-time boundary anomaly', async () => {
  await beginAnomalies();
  await ctx.env.DB.prepare("DELETE FROM app_meta WHERE key='anomaly_sweep_at'").run();
  const at = '2026-10-16T12:00:00.000Z';
  await ctx.env.DB.prepare(
    "INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('tick-profile','{}',?1,?1)",
  )
    .bind(at)
    .run();
  await ctx.env.DB.prepare(
    `WITH RECURSIVE n(i) AS (VALUES(0) UNION ALL SELECT i+1 FROM n WHERE i<204)
     INSERT INTO careers(id,profile_id,pos,foot,type,trait,start_year,app_version,status,created_at,updated_at)
     SELECT printf('tick-page-%03d',i),'tick-profile','FW','right','poacher','late',2026,'test','active',?1,?1 FROM n`,
  )
    .bind(at)
    .run();
  await ctx.env.DB.prepare(
    `INSERT INTO career_seasons(career_id,year,age,club,league,apps,goals,assists,rating,rank,ovr,honors_json,mil,events_json,created_at)
     SELECT id,2026,18,'A','L',30,10,5,7,'1',CASE WHEN id='tick-page-204' THEN 99 ELSE 60 END,'[]',0,'[]',?1 FROM careers WHERE id LIKE 'tick-page-%'`,
  )
    .bind(at)
    .run();
  // Keep this integration focused on the real anomaly pages, not R2/retention work.
  const env = { ...ctx.env };
  delete env.BACKUP;
  expect((await runDailyTick(env, NOW))?.stage).toBe(5);
  expect(await read()).toMatchObject({
    results: { anomalies: { done: true, checked: 5, hidden: 1, cursor: null } },
  });
  expect(
    await ctx.env.DB.prepare("SELECT hidden FROM careers WHERE id='tick-page-204'").first(),
  ).toEqual({ hidden: 1 });
  expect(
    await ctx.env.DB.prepare("SELECT value FROM app_meta WHERE key='anomaly_sweep_at'").first(),
  ).toEqual({ value: '2026-10-16T19:00:00.000Z' });
});
