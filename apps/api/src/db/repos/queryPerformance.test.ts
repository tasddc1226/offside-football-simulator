import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HofSort } from '@offside/contracts';
import { PRESEASON } from '@offside/contracts/service-seasons';
import { createTestD1, syncCards, type TestD1 } from '../../test/d1.js';
import { createDb } from '../client.js';
import { listPublicHof } from './careers.js';
import { listTeamRanking } from './ownerTeams.js';
import { titleMetricsOf } from './ownerTitles.js';

type Query = { sql: string; params: unknown[] };

/** Capture the actual Drizzle SQL and bindings, including statements passed to batch(). */
function trace(db: D1Database) {
  const queries: Query[] = [];
  const DB = new Proxy(db, {
    get(target, key) {
      if (key === 'prepare')
        return (sql: string) => {
          const query: Query = { sql, params: [] };
          queries.push(query);
          return new Proxy(target.prepare(sql), {
            get(statement, property) {
              if (property === 'bind')
                return (...params: unknown[]) => {
                  query.params = params;
                  return statement.bind(...params);
                };
              const value = Reflect.get(statement, property) as unknown;
              return typeof value === 'function' ? value.bind(statement) : value;
            },
          });
        };
      const value = Reflect.get(target, key) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { db: createDb(DB), queries };
}

describe('critical query result and read-cost regressions (local D1)', () => {
  let ctx: TestD1;
  let traced: ReturnType<typeof trace>;
  beforeAll(async () => {
    ctx = await createTestD1();
    traced = trace(ctx.env.DB);
    await ctx.env.DB.prepare(
      `
      WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<79)
      INSERT INTO profiles (id,google_sub,settings_json,created_at,last_seen_at)
      SELECT 'profile-'||x,'google-'||x,'{}','2026-09-28','2026-09-28' FROM n
    `,
    ).run();
    await ctx.env.DB.prepare(
      `
      WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<3999)
      INSERT INTO careers (id,profile_id,pos,dpos,foot,type,trait,start_year,status,app_version,
        created_at,updated_at,retired_at,retire_age,peak,legend_score,service_season,public_name,
        hidden,goals,assists,apps,trophies,awards,ballon,caps,value)
      SELECT 'career-'||x,'profile-'||(x%80),
        CASE x%4 WHEN 0 THEN 'FW' WHEN 1 THEN 'MF' WHEN 2 THEN 'DF' ELSE 'GK' END,
        CASE x%4 WHEN 0 THEN 'ST' WHEN 1 THEN 'CM' WHEN 2 THEN 'CB' ELSE 'GK' END,
        '오른발','poacher','late',2026,CASE WHEN x%31=0 THEN 'active' ELSE 'retired' END,'1',
        '2026-09-28','2026-09-28',strftime('%Y-%m-%dT%H:%M:%fZ','2026-09-28','+'||x||' seconds'),
        CASE WHEN x%19=0 THEN 29 ELSE 34 END,80,10000-x%100,x%2,'player-'||x,
        CASE WHEN x%17=0 THEN 1 ELSE 0 END,x%500,x%200,x%800,x%20,x%15,x%3,x%100,x%1000
      FROM n
    `,
    ).run();
    await syncCards(ctx, 100);
    await ctx.env.DB.prepare(
      `
      INSERT INTO owner_teams (id,profile_id,season,name,formation,slots_json,filled,ovr,rating,created_at,updated_at)
      SELECT 'team-'||substr(id,9),id,0,id,'4-3-3',
        json_array('career-'||substr(id,9),'career-'||(cast(substr(id,9) as integer)+80)),
        2,80,1000,'2026-09-28','2026-09-28' FROM profiles
    `,
    ).run();
    // Live eligibility must survive the optimization: transfer, hiding, future cards, null values,
    // unlinked/deleted owners, and empty teams. Closed seasons ignore current card ownership only.
    await ctx.env.DB.exec(`
      UPDATE cards SET service_season=0;
      UPDATE cards SET card_value = 1000 WHERE career_id='career-1';
      UPDATE cards SET owner_id='profile-2' WHERE career_id='career-1';
      UPDATE careers SET hidden=1 WHERE id='career-82';
      UPDATE cards SET service_season=1 WHERE career_id='career-3';
      UPDATE cards SET card_value=NULL WHERE career_id='career-4';
      UPDATE profiles SET deleted_at='2026-09-30' WHERE id='profile-77';
      UPDATE profiles SET google_sub=NULL WHERE id='profile-78';
      UPDATE owner_teams SET filled=0 WHERE id='team-79';
    `);
  });
  afterAll(async () => {
    await ctx.dispose();
  });

  const run = (q: Query) =>
    ctx.env.DB.prepare(q.sql)
      .bind(...q.params)
      .all();
  const plan = async (q: Query) =>
    (
      await ctx.env.DB.prepare(`EXPLAIN QUERY PLAN ${q.sql}`)
        .bind(...q.params)
        .all<{ detail: string }>()
    ).results
      .map((r) => r.detail)
      .join('\n');

  it('owner title metrics read only that owner, matching the production global-peak plan results', async () => {
    traced.queries.length = 0;
    const metrics = await titleMetricsOf(traced.db, 'profile-1');
    expect(metrics.retired).toBeGreaterThan(0);
    const q = traced.queries[0]!;
    const baseline = {
      ...q,
      sql: q.sql.replace(
        'INDEXED BY careers_profile_status_season_idx',
        'INDEXED BY careers_hof_peak_idx',
      ),
    };
    const current = await run(q);
    const old = await run(baseline);
    expect(current.results).toEqual(old.results);
    expect(await plan(q)).toContain(
      'careers_profile_status_season_idx (profile_id=? AND status=?)',
    );
    expect(current.meta.rows_read).toBeLessThan(old.meta.rows_read / 5);
    console.info('owner-title rows read', {
      before: old.meta.rows_read,
      after: current.meta.rows_read,
    });
  });

  it('score search uses a covering, already ordered rank pass across all-time and season filters', async () => {
    for (const season of [
      undefined,
      PRESEASON,
      { ...PRESEASON, endsAt: '2026-09-28T00:20:00.000Z' },
    ]) {
      traced.queries.length = 0;
      const result = await listPublicHof(traced.db, 20, 1, 'score', season, 'player-12');
      expect(result.entries.length).toBeGreaterThan(0);
      const window = traced.queries.find((q) => q.sql.includes('row_number()'))!;
      const windowPlan = await plan(window);
      expect(windowPlan).toContain('USING COVERING INDEX careers_hof_');
      expect(windowPlan).not.toContain('TEMP B-TREE');
      const baseline = {
        ...window,
        sql: window.sql
          .replace(
            / INDEXED BY careers_hof_(?:season_)?score_order_idx/g,
            ' INDEXED BY careers_status_legend_idx',
          )
          .replace(
            /"careers"\."legend_score" desc,/g,
            '"careers"."legend_score" desc, "careers"."legend_score" desc,',
          ),
      };
      const current = await run(window);
      const old = await run(baseline);
      expect(current.results).toEqual(old.results);
      expect(current.meta.rows_read).toBeLessThan(old.meta.rows_read);
      console.info('HOF rank rows read', {
        season: season?.id,
        closed: !!season?.endsAt,
        before: old.meta.rows_read,
        after: current.meta.rows_read,
      });
    }
  });

  it('search ranks equal unfiltered positions for every sort and positional/season filters', async () => {
    for (const sort of [
      'score',
      'value',
      'goals',
      'assists',
      'ga',
      'apps',
      'trophies',
      'awards',
      'ballon',
      'caps',
      'peak',
    ] as HofSort[]) {
      for (const filtered of [false, true]) {
        const season = filtered ? PRESEASON : undefined;
        const pos = filtered ? 'FW' : undefined;
        const dpos = filtered ? 'ST' : undefined;
        const all = await listPublicHof(ctx.db, 5000, 1, sort, season, undefined, pos, dpos);
        const search = await listPublicHof(ctx.db, 7, 2, sort, season, 'player-12', pos, dpos);
        const matches = all.entries.filter((e) => e.name?.includes('player-12'));
        expect(search.total).toBe(matches.length);
        expect(search.entries.map((e) => e.id)).toEqual(matches.slice(7, 14).map((e) => e.id));
        for (const entry of search.entries)
          expect(entry.rank).toBe(all.entries.findIndex((e) => e.id === entry.id) + 1);
      }
    }
    expect((await listPublicHof(ctx.db, 20, 1, 'score', undefined, '%_')).total).toBe(0);
  });

  it('team value sorts reuse one aggregate and preserve pagination, ties and season eligibility', async () => {
    for (const now of ['2026-09-30T00:00:00.000Z', '2030-01-01T00:00:00.000Z']) {
      for (const page of [1, 2, 3]) {
        traced.queries.length = 0;
        const result = await listTeamRanking(traced.db, 0, 'value', page, now);
        expect(result.total).toBe(77);
        const q = traced.queries[0]!;
        const aggregate = q.sql.match(/(\([\s\S]*?\)) as "lineup_value"/)?.[1];
        expect(aggregate).toBeTruthy();
        const beforeOrder = (q.sql.slice(0, q.sql.indexOf('order by')).match(/\?/g) ?? []).length;
        const baseline = {
          ...q,
          sql: q.sql.replace('order by lineup_value desc', `order by ${aggregate} desc`),
          params: [
            ...q.params.slice(0, beforeOrder),
            ...q.params.slice(0, (aggregate!.match(/\?/g) ?? []).length),
            ...q.params.slice(beforeOrder),
          ],
        };
        const current = await run(q);
        const old = await run(baseline);
        expect(current.results).toEqual(old.results);
        const currentPlan = await plan(q);
        expect(currentPlan.match(/CORRELATED SCALAR SUBQUERY/g)).toHaveLength(1);
        expect((await plan(baseline)).match(/CORRELATED SCALAR SUBQUERY/g)).toHaveLength(2);
        expect(currentPlan).toContain(
          'SEARCH cards USING INDEX sqlite_autoindex_cards_1 (career_id=?)',
        );
        expect(current.meta.rows_read).toBeLessThan(old.meta.rows_read);
        console.info('team value rows read', {
          now,
          page,
          before: old.meta.rows_read,
          after: current.meta.rows_read,
        });
      }
    }
    const live = await listTeamRanking(ctx.db, 0, 'value', 1, '2026-09-30T00:00:00.000Z');
    const closed = await listTeamRanking(ctx.db, 0, 'value', 1, '2030-01-01T00:00:00.000Z');
    expect(closed.rows.find((r) => r.id === 'team-1')).toMatchObject({ value: 1100 });
    const livePages = [...live.rows];
    for (const page of [2, 3, 4]) {
      livePages.push(
        ...(await listTeamRanking(ctx.db, 0, 'value', page, '2026-09-30T00:00:00.000Z')).rows,
      );
    }
    expect(livePages.find((r) => r.id === 'team-1')).toMatchObject({ value: 100 });
  });
});
