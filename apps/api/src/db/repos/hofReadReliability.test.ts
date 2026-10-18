import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../../test/d1.js';
import { createDb } from '../client.js';
import { listPublicHof } from './careers.js';

type Stage = 'page' | 'count' | 'rank';
let ctx: TestD1;
beforeAll(async () => {
  ctx = await createTestD1();
  await ctx.env.DB.exec(`
    INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('owner','{}','2026-10-18','2026-10-18');
    INSERT INTO careers(id,profile_id,pos,foot,type,trait,start_year,status,app_version,created_at,updated_at,retired_at,retire_age,peak,legend_score,public_name,hidden) VALUES ('one','owner','FW','오른발','poacher','late',2026,'retired','test','2026-10-18','2026-10-18','2026-10-18',34,80,30,'runner-one',0),('two','owner','FW','오른발','poacher','late',2026,'retired','test','2026-10-18','2026-10-18','2026-10-18',34,80,20,'runner-two',0),('three','owner','FW','오른발','poacher','late',2026,'retired','test','2026-10-18','2026-10-18','2026-10-18',34,80,10,'runner-three',0);
  `);
});
afterAll(() => ctx.dispose());

/** Lose a SELECT response after real local D1 executed it, through the production Sessions API. */
function faultyRead(stage: Stage, failures: number, message = 'D1_ERROR: Network connection lost') {
  const calls: Record<Stage, number> = { page: 0, count: 0, rank: 0 };
  const queries: string[] = [];
  const statement = (stmt: D1PreparedStatement, query: string): D1PreparedStatement =>
    new Proxy(stmt, {
      get(target, key) {
        const value = Reflect.get(target, key) as unknown;
        if (typeof value !== 'function') return value;
        const fn = value as (...args: unknown[]) => unknown;
        if (key === 'bind')
          return (...args: unknown[]) =>
            statement(fn.apply(target, args) as D1PreparedStatement, query);
        if (key === 'raw' || key === 'all')
          return async (...args: unknown[]) => {
            const kind: Stage = query.includes('row_number()')
              ? 'rank'
              : query.startsWith('select count(*)')
                ? 'count'
                : 'page';
            calls[kind]++;
            queries.push(query);
            const result = await fn.apply(target, args);
            if (kind === stage && failures-- > 0) throw new Error(message);
            return result;
          };
        return fn.bind(target);
      },
    });
  const session = new Proxy(ctx.env.DB.withSession('first-primary'), {
    get(target, key) {
      if (key === 'prepare') return (query: string) => statement(target.prepare(query), query);
      const value = Reflect.get(target, key) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { db: createDb(session), calls, queries };
}

const load = (db: ReturnType<typeof createDb>, search = false) =>
  listPublicHof(db, 1, 2, 'score', undefined, search ? 'runner' : undefined);

describe('public HOF SELECT response recovery', () => {
  it.each<Stage>(['page', 'count', 'rank'])('replays only the failed %s SELECT', async (stage) => {
    const search = stage === 'rank';
    const expected = await load(ctx.db, search);
    const fault = faultyRead(stage, 1);
    expect(await load(fault.db, search)).toEqual(expected);
    expect(expected.total).toBe(3);
    expect(expected.entries[0]?.id).toBe('two');
    if (search) expect(expected.entries[0]?.rank).toBe(2);
    expect(fault.calls).toEqual({
      page: stage === 'page' ? 2 : 1,
      count: stage === 'count' ? 2 : 1,
      rank: search ? 2 : 0,
    });
    expect(fault.queries.every((query) => query.startsWith('select '))).toBe(true);
    if (!search)
      expect(fault.queries.some((query) => query.includes('careers_hof_count_idx'))).toBe(true);
  });

  it('keeps one execution per SELECT when healthy', async () => {
    const fault = faultyRead('count', 0);
    expect(await load(fault.db, true)).toEqual(await load(ctx.db, true));
    expect(fault.calls).toEqual({ page: 1, count: 1, rank: 1 });
  });

  it('caps a persistent connection failure at three attempts and does not return zero results', async () => {
    const fault = faultyRead('count', 10);
    await expect(load(fault.db)).rejects.toThrow('Failed query');
    expect(fault.calls).toEqual({ page: 1, count: 3, rank: 0 });
  });

  it.each([
    'D1 DB is overloaded. Requests queued for too long.',
    'D1_ERROR: no such column: missing_column',
  ])('does not multiply permanent/overload failures: %s', async (message) => {
    const fault = faultyRead('count', 10, message);
    await expect(load(fault.db)).rejects.toThrow('Failed query');
    expect(fault.calls).toEqual({ page: 1, count: 1, rank: 0 });
  });
});
