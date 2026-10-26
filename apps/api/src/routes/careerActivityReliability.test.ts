import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie } from '../test/http.js';

const NOW = Date.parse('2026-10-17T12:00:00.000Z');
let ctx: TestD1;
let user: Awaited<ReturnType<typeof issueCookie>>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ctx = await createTestD1();
  user = await issueCookie(ctx);
});
afterEach(async () => {
  vi.useRealTimers();
  await ctx.dispose();
});
const lost = () => new Error('D1_ERROR: Network connection lost.');
function intercept(
  marker: string,
  method: 'run' | 'first',
  execute: (statement: D1PreparedStatement, attempt: number) => Promise<unknown>,
) {
  let attempts = 0;
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, key) {
        if (key === 'bind') return (...values: unknown[]) => wrap(target.bind(...values));
        if (key === method) return async () => execute(target, ++attempts);
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  const DB = new Proxy(ctx.env.DB, {
    get(target, key) {
      if (key === 'prepare')
        return (sql: string) =>
          sql.includes(marker) ? wrap(target.prepare(sql)) : target.prepare(sql);
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { DB, attempts: () => attempts };
}
const send = (DB: D1Database, state: 'active' | 'retired', id: string, lang = 'ko') =>
  callJson({ ...ctx.env, DB, ENVIRONMENT: 'local' }, 'PUT', `/v1/career-activity?lang=${lang}`, {
    cookie: user.cookie,
    body: { careerId: id, state },
  });
const row = () =>
  ctx.env.DB.prepare(
    'SELECT career_id,state,last_active_at,retired_at,lang FROM career_activity WHERE profile_id=?',
  )
    .bind(user.profileId)
    .first();

it.each([false, true])(
  'recovers activity connection loss afterCommit=%s without duplicate state',
  async (afterCommit) => {
    const id = crypto.randomUUID();
    const fault = intercept('INSERT INTO career_activity', 'run', async (statement, n) => {
      if (n === 1 && !afterCommit) throw lost();
      const result = await statement.run();
      if (n === 1) throw lost();
      return result;
    });
    expect((await send(fault.DB, 'retired', id)).status).toBe(204);
    expect(fault.attempts()).toBe(2);
    expect(await row()).toEqual({
      career_id: id,
      state: 'retired',
      last_active_at: new Date(NOW).toISOString(),
      retired_at: new Date(NOW).toISOString(),
      lang: 'ko',
    });
  },
);

it('retries the side-effect-free owner lookup', async () => {
  const fault = intercept('SELECT profile_id FROM careers', 'first', async (statement, n) => {
    if (n === 1) throw lost();
    return statement.first();
  });
  expect((await send(fault.DB, 'active', crypto.randomUUID())).status).toBe(204);
  expect(fault.attempts()).toBe(2);
});

it.each([false, true])(
  'an older retry preserves newer activity and the first retirement afterCommit=%s',
  async (afterCommit) => {
    const old = crypto.randomUUID(),
      current = crypto.randomUUID();
    const fault = intercept('INSERT INTO career_activity', 'run', async (statement, n) => {
      if (n === 1) {
        if (afterCommit) await statement.run();
        vi.setSystemTime(NOW + 1000);
        expect((await send(ctx.env.DB, 'active', current, 'en')).status).toBe(204);
        throw lost();
      }
      return statement.run();
    });
    expect((await send(fault.DB, 'retired', old)).status).toBe(204);
    expect(fault.attempts()).toBe(2);
    expect(await row()).toEqual({
      career_id: current,
      state: 'active',
      last_active_at: new Date(NOW + 1000).toISOString(),
      retired_at: new Date(NOW).toISOString(),
      lang: 'en',
    });
  },
);

it('does not multiply writes when the primary is overloaded', async () => {
  const fault = intercept('INSERT INTO career_activity', 'run', async () => {
    throw new Error('D1 DB is overloaded. Requests queued for too long.');
  });
  expect((await send(fault.DB, 'active', crypto.randomUUID())).status).toBe(503);
  expect(fault.attempts()).toBe(1);
  expect(await row()).toBeNull();
});

it('does not rewrite an unchanged recent activity row, but refreshes after an hour (T-11-505)', async () => {
  const id = crypto.randomUUID();
  const at = (ms: number) => new Date(NOW + ms).toISOString();
  expect((await send(ctx.env.DB, 'active', id)).status).toBe(204);
  // 30분 뒤 같은 상태: 행을 다시 쓰지 않아 last_active_at이 그대로다.
  vi.setSystemTime(NOW + 30 * 60_000);
  expect((await send(ctx.env.DB, 'active', id)).status).toBe(204);
  expect(await row()).toMatchObject({ last_active_at: at(0), lang: 'ko' });
  // 바뀐 것(언어)이 있으면 바로 쓴다.
  expect((await send(ctx.env.DB, 'active', id, 'en')).status).toBe(204);
  expect(await row()).toMatchObject({ last_active_at: at(30 * 60_000), lang: 'en' });
  // 한 시간이 지나면 같은 상태도 다시 쓴다.
  vi.setSystemTime(NOW + 2 * 60 * 60_000);
  expect((await send(ctx.env.DB, 'active', id, 'en')).status).toBe(204);
  expect(await row()).toMatchObject({ last_active_at: at(2 * 60 * 60_000) });
  // 은퇴는 늘 바로 쓴다.
  expect((await send(ctx.env.DB, 'retired', id, 'en')).status).toBe(204);
  expect(await row()).toMatchObject({ state: 'retired', retired_at: at(2 * 60 * 60_000) });
});
