import { HofListResponseSchema, successEnvelope } from '@offside/contracts';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { listPublicHof } from '../db/repos/careers.js';
import { EDGE } from '../edgeKeys.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { forgetSeasonSchedule } from '../seasonSchedule.js';
import { flushEdge, installFakeEdgeCache } from '../test/edgeCache.js';

const parse = successEnvelope(HofListResponseSchema);
const KEYS = ['club_ids_backfill', 'career_values_backfill'];
let ctx: TestD1;
beforeAll(async () => {
  ctx = await createTestD1();
  await ctx.env.DB.exec(`
    INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('owner','{}','2026-11-01','2026-11-01');
    INSERT INTO careers(id,profile_id,pos,foot,type,trait,start_year,status,app_version,created_at,updated_at,retired_at,retire_age,peak,legend_score,public_name,hidden) VALUES ('one','owner','FW','right','poacher','late',2026,'retired','test','2026-11-01','2026-11-01','2026-11-01',34,80,30,'runner',0);
  `);
  // The once-per-minute schedule bootstrap is separate from HOF's cache-miss loader.
  await createApp().request('/v1/health', {}, ctx.env);
});
afterAll(() => ctx.dispose());
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  for (const key of KEYS)
    await ctx.env.DB.prepare('INSERT OR REPLACE INTO app_meta(key,value) VALUES (?,?)')
      .bind(key, '1')
      .run();
  await ctx.env.DB.prepare('INSERT OR REPLACE INTO app_meta(key,value) VALUES (?,?)')
    .bind(`hof_count:${EDGE.hofCount('score')}`, JSON.stringify({ n: 1, at: Date.now() }))
    .run();
});

/** Real Miniflare SQL; record adapter/session ownership and first-query ordering, not simulated geography. */
function observe(tick = () => {}) {
  const queries: { sql: string; session: number | null; first: boolean }[] = [];
  const constraints: unknown[] = [];
  const statement = (
    stmt: D1PreparedStatement,
    sql: string,
    session: number | null,
    state: { first: boolean },
  ): D1PreparedStatement =>
    new Proxy(stmt, {
      get(target, key) {
        const fn = Reflect.get(target, key) as unknown;
        if (typeof fn !== 'function') return fn;
        if (key === 'bind')
          return (...args: unknown[]) => statement(fn.apply(target, args), sql, session, state);
        if (['all', 'raw', 'first', 'run'].includes(String(key)))
          return async (...args: unknown[]) => {
            queries.push({ sql, session, first: state.first });
            const result: unknown = await fn.apply(target, args);
            state.first = false;
            tick();
            return result;
          };
        return fn.bind(target);
      },
    });
  const wrap = <T extends D1Database | D1DatabaseSession>(target: T, session: number | null): T => {
    const state = { first: true };
    return new Proxy(target, {
      get(db, key) {
        if (key === 'withSession')
          return (...args: Parameters<D1Database['withSession']>) => {
            constraints.push(args[0]);
            return wrap(ctx.env.DB.withSession(...args), constraints.length);
          };
        if (key === 'prepare')
          return (sql: string) => statement(db.prepare(sql), sql, session, state);
        const value = Reflect.get(db, key) as unknown;
        return typeof value === 'function' ? value.bind(db) : value;
      },
    });
  };
  return { DB: wrap(ctx.env.DB, null), queries, constraints };
}

async function read(DB: D1Database, extra = {}, query = 'limit=10') {
  const res = await createApp().request(`/v1/hof?${query}`, {}, { ...ctx.env, DB, ...extra });
  expect(res.status).toBe(200);
  return parse.parse(await res.json()).data;
}

describe('HOF primary-anchored read session', () => {
  it('uses one request-local session for metadata, page and stored count, preserving the response and 3 queries', async () => {
    const expected = await listPublicHof(ctx.db, 10);
    const traced = observe();
    expect(await read(traced.DB)).toEqual(expected);
    expect(traced.constraints).toEqual(['first-primary']);
    expect(traced.queries.map(({ session, first }) => ({ session, first }))).toEqual([
      { session: 1, first: true },
      { session: 1, first: false },
      { session: 1, first: false },
    ]);
    expect(traced.queries[0]!.sql).toContain('"app_meta"."key" in');
    expect(traced.queries[1]!.sql).toContain('hof_page');
    expect(traced.queries[2]!.sql).toBe('SELECT value FROM app_meta WHERE key = ?');
    expect(traced.queries.some(({ sql }) => /from "sessions"|from "profiles"/.test(sql))).toBe(
      false,
    );
    expect(await read(traced.DB)).toEqual(expected);
    expect(traced.constraints).toEqual(['first-primary', 'first-primary']);
    expect(traced.queries.slice(3).every(({ session }) => session === 2)).toBe(true);
    // A write committed before the next request must not be hidden by an earlier bookmark.
    await ctx.env.DB.prepare("UPDATE careers SET hidden=1 WHERE id='one'").run();
    try {
      expect((await read(traced.DB)).entries).toEqual([]);
      expect(traced.constraints).toEqual(['first-primary', 'first-primary', 'first-primary']);
    } finally {
      await ctx.env.DB.prepare("UPDATE careers SET hidden=0 WHERE id='one'").run();
    }
  });

  it('keeps the emergency switch on the primary adapter without opening sessions', async () => {
    const traced = observe();
    expect(await read(traced.DB, { D1_READ_SESSIONS_DISABLED: '1' })).toEqual(
      await listPublicHof(ctx.db, 10),
    );
    expect(traced.constraints).toEqual([]);
    expect(traced.queries).toHaveLength(3);
    expect(traced.queries.every(({ session }) => session === null)).toBe(true);
  });

  it('retains unfinished backfill writes and page reads on primary and never caches the partial result', async () => {
    await read(ctx.env.DB); // A previous completed request must not hide a reset marker.
    for (const key of KEYS)
      await ctx.env.DB.prepare('DELETE FROM app_meta WHERE key=?').bind(key).run();
    const cache = installFakeEdgeCache();
    try {
      const traced = observe();
      expect((await read(traced.DB)).total).toBe(1);
      expect(traced.queries.filter(({ session }) => session !== null)).toHaveLength(1);
      expect(
        traced.queries.some(({ sql, session }) => session === null && sql.includes('hof_page')),
      ).toBe(true);
      await flushEdge();
      expect(cache.store.size).toBe(0);
      for (const key of KEYS)
        expect(
          await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key=?')
            .bind(key)
            .first('value'),
        ).toBe('1');
    } finally {
      cache.uninstall();
    }
  });

  it('does no database work on an edge-cache hit', async () => {
    const cache = installFakeEdgeCache();
    try {
      const traced = observe();
      const first = await read(traced.DB);
      await flushEdge();
      const queries = traced.queries.length;
      expect(await read(traced.DB)).toEqual(first);
      expect(traced.queries).toHaveLength(queries);
      expect(traced.constraints).toEqual(['first-primary']);
    } finally {
      cache.uninstall();
    }
  });

  it('logs slow stages with normalized filters and only the presence of a search term', async () => {
    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const traced = observe(() => {
      clock += 600;
    });
    await read(traced.DB, {}, 'limit=10&q=private-search');
    const diagnostics = log.mock.calls
      .map(([line]) => JSON.parse(line))
      .filter((row) => row.job === 'hof-read');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      ms: 1800,
      edgeHit: false,
      backfillMs: 600,
      listMs: 1200,
      countMs: 600,
      edgeMs: 0,
      search: true,
      readSessions: true,
    });
    expect(JSON.stringify(diagnostics)).not.toContain('private-search');
  });

  it('separates schedule/bootstrap waiting from the HOF loader', async () => {
    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    forgetSeasonSchedule();
    const traced = observe(() => {
      clock += 600;
    });
    await read(traced.DB);
    const diagnostics = log.mock.calls
      .map(([line]) => JSON.parse(line))
      .filter((row) => row.job === 'hof-read');
    expect(diagnostics[0]).toMatchObject({
      ms: 2400,
      beforeRouteMs: 600,
      routeMs: 1800,
      backfillMs: 600,
      listMs: 1200,
      countMs: 600,
    });
    expect(traced.queries[0]!.session).toBeNull();
  });
});
