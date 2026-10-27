import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HofSort } from '@offside/contracts';
import { PRESEASON } from '@offside/contracts/service-seasons';
import { createTestD1, syncCards, type TestD1 } from '../../test/d1.js';
import { createDb } from '../client.js';
import { listPublicHof } from './careers.js';
import { listTeamRanking } from './ownerTeams.js';
import { recordCareerFirsts } from './firsts.js';
import { countOpenListingsAmong } from './market.js';
import { achievementRankOf, ownerActivityIn } from './ownerAchievements.js';
import { listRetiredNumbers, summarizeRetiredNumbers } from './retiredNumbers.js';
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

  it('team value ranking reads stored values and preserves season eligibility', async () => {
    for (const now of ['2026-09-30T00:00:00.000Z', '2030-01-01T00:00:00.000Z']) {
      const open = now.startsWith('2026');
      // Independent copy of the old live aggregate, used only as a test oracle.
      const oracle = await ctx.env.DB.prepare(
        `SELECT t.id, (
        SELECT coalesce(sum(coalesce(c.card_value, 10000)), 0)
        FROM json_each(t.slots_json) slot
        CROSS JOIN cards c ON c.career_id = slot.value
        LEFT JOIN careers r ON r.id = c.career_id
        WHERE c.service_season <= t.season AND coalesce(r.hidden, 0) = 0
        ${open ? 'AND c.owner_id = t.profile_id AND c.manager = 0' : ''}
      ) AS value FROM owner_teams t WHERE t.season = 0`,
      ).all<{ id: string; value: number }>();
      const expected = new Map(oracle.results.map((row) => [row.id, row.value]));
      for (const page of [1, 2, 3, 4]) {
        traced.queries.length = 0;
        const result = await listTeamRanking(traced.db, 0, 'value', page, now);
        for (const row of result.rows) expect(row.value, row.id).toBe(expected.get(row.id));
        expect(result.total).toBe(77);
        const q = traced.queries[0]!;
        expect(q.sql).not.toContain('json_each');
        expect(q.sql).not.toContain('cards');
        expect(await plan(q)).toContain('owner_teams_season_value_');
      }
    }
    const closed = await listTeamRanking(ctx.db, 0, 'value', 1, '2030-01-01T00:00:00.000Z');
    expect(closed.rows.find((r) => r.id === 'team-1')).toMatchObject({ value: 1100 });
    const livePages = [];
    for (const page of [1, 2, 3, 4])
      livePages.push(
        ...(await listTeamRanking(ctx.db, 0, 'value', page, '2026-09-30T00:00:00.000Z')).rows,
      );
    expect(livePages.find((r) => r.id === 'team-1')).toMatchObject({ value: 100 });
  });
  it('wall of honor reads only wall rows through its partial index (T-11-259)', async () => {
    await ctx.env.DB.prepare(
      `UPDATE careers SET wall_of_honor_json = json_object('clubId', 'pl-' || (cast(substr(id, 8) as integer) % 3),
        'club', 'club', 'number', 7, 'grantedAt', retired_at) WHERE cast(substr(id, 8) as integer) % 40 = 1`,
    ).run();
    for (const season of [0, 1]) {
      for (const read of [
        () => summarizeRetiredNumbers(traced.db, season),
        () => listRetiredNumbers(traced.db, season, 'pl-1'),
      ]) {
        traced.queries.length = 0;
        await read();
        const wallQueries = traced.queries.filter((q) =>
          q.sql.includes('careers_wall_of_honor_idx'),
        );
        expect(wallQueries.length).toBeGreaterThan(0);
        for (const q of wallQueries) {
          const baseline = {
            ...q,
            sql: q.sql.replace(' INDEXED BY careers_wall_of_honor_idx', ''),
          };
          const current = await run(q);
          const old = await run(baseline);
          expect(current.results).toEqual(old.results);
          expect(await plan(q)).toContain('careers_wall_of_honor_idx');
          expect(current.meta.rows_read).toBeLessThan(old.meta.rows_read / 5);
          console.info('wall of honor rows read', {
            season,
            count: q.sql.includes('count(*)'),
            before: old.meta.rows_read,
            after: current.meta.rows_read,
          });
        }
      }
    }
    const summary = await summarizeRetiredNumbers(ctx.db, 1);
    expect(summary.wallTotal).toBe(summary.wall?.length);
    expect(summary.wallTotal).toBeGreaterThan(0);
  });
  it('owner likes count starts from that owner’s likes, not every team of the season (T-11-262)', async () => {
    await ctx.env.DB.prepare(
      `INSERT INTO team_likes (team_id, profile_id, created_at)
       SELECT id, 'profile-5', '2026-09-29' FROM owner_teams WHERE cast(substr(id, 6) as integer) % 20 = 1
       UNION ALL SELECT id, 'profile-6', '2026-09-29' FROM owner_teams WHERE cast(substr(id, 6) as integer) % 2 = 0`,
    ).run();
    for (const [profileId, likes] of [
      ['profile-5', 4],
      ['profile-6', 40],
      ['profile-7', 0],
    ] as const) {
      traced.queries.length = 0;
      const activity = await ownerActivityIn(traced.db, profileId, 0, null);
      expect(activity.likesGiven).toBe(likes);
      const q = traced.queries.find((x) => x.sql.includes('team_likes_profile_idx'))!;
      const baseline = { ...q, sql: q.sql.replace(' INDEXED BY team_likes_profile_idx', '') };
      const current = await run(q);
      const old = await run(baseline);
      expect(current.results).toEqual(old.results);
      expect(await plan(q)).toContain('team_likes_profile_idx (profile_id=?)');
      expect(current.meta.rows_read).toBeLessThanOrEqual(old.meta.rows_read);
      if (likes < 40) expect(current.meta.rows_read).toBeLessThan(old.meta.rows_read / 5);
    }
  });

  it('achievement rank takes the shared ranked total from the cache when given (T-11-262)', async () => {
    await ctx.env.DB.prepare(
      `INSERT INTO owner_achievements (profile_id, season, score, done, players, reached_at, updated_at)
       SELECT id, 0, 10 + cast(substr(id, 9) as integer) % 7, 1, 1, '2026-09-29', '2026-09-29' FROM profiles`,
    ).run();
    const row = {
      profileId: 'profile-3',
      season: 0,
      score: 13,
      done: 1,
      players: 1,
      teamKept: null,
      rewardBoost: null,
      rewardScout: null,
      reachedAt: '2026-09-29',
      updatedAt: '2026-09-29',
    };
    traced.queries.length = 0;
    const fresh = await achievementRankOf(traced.db, row);
    expect(traced.queries).toHaveLength(2);
    traced.queries.length = 0;
    const cached = await achievementRankOf(traced.db, row, async () => fresh.ranked);
    expect(cached).toEqual(fresh);
    expect(traced.queries).toHaveLength(1);
    // 점수가 0이면 순위를 세지 않는다.
    traced.queries.length = 0;
    expect(await achievementRankOf(traced.db, { ...row, score: 0 }, async () => 9)).toEqual({
      rank: null,
      ranked: 9,
    });
    expect(traced.queries).toHaveLength(0);
  });
  // 운영(시즌 1, 약 1,900팀) 평점순 1쪽: 12,717 → 6,403행. 이 작은 픽스처에선 차이가 드러나지 않아 결과·쿼리 모양만 본다.
  it('rating and ovr team ranks count lineup value only for the page teams (T-11-268)', async () => {
    await ctx.env.DB.exec(
      'UPDATE owner_teams SET rating = 900 + (cast(substr(id,6) as integer) * 37) % 200, ovr = 60 + cast(substr(id,6) as integer) % 30;',
    );
    try {
      for (const now of ['2026-09-30T00:00:00.000Z', '2030-01-01T00:00:00.000Z']) {
        const allValues = new Map<string, number>();
        for (const page of [1, 2, 3, 4])
          for (const r of (await listTeamRanking(ctx.db, 0, 'value', page, now)).rows)
            allValues.set(r.id, r.value);
        for (const sort of ['rating', 'ovr'] as const) {
          for (const page of [1, 2, 4]) {
            traced.queries.length = 0;
            await listTeamRanking(traced.db, 0, 'value', page, now);
            traced.queries.length = 0;
            const result = await listTeamRanking(traced.db, 0, sort, page, now);
            expect(result.total).toBe(77);
            const q = traced.queries[0]!;
            expect(q.sql).toContain('"team_page"');
            expect(q.sql).not.toContain('json_each');
            expect(q.sql).not.toContain('cards');
            expect(result.rows.length).toBe(page === 4 ? 17 : 20);
            for (const r of result.rows) expect(r.value).toBe(allValues.get(r.id));
          }
        }
      }
    } finally {
      await ctx.env.DB.exec('UPDATE owner_teams SET rating = 1000, ovr = 80;');
    }
  });

  it('server firsts are looked up by their (season, id) key, ignoring other seasons (T-11-268)', async () => {
    // 다른 시즌에 같은 기록 id를 더 이르게 가진 커리어가 있어도 이 시즌 자리는 비어 있다.
    traced.queries.length = 0;
    await recordCareerFirsts(traced.db, 'career-1', { legendOnly: true, automaticHiding: false });
    const lookup = traced.queries.find((q) => /from "server_firsts" where/.test(q.sql))!;
    expect(lookup.sql).toContain('"server_firsts"."season" = ?');
    expect(await plan(lookup)).toContain('(season=? AND id=?)');
    const claimed = await ctx.env.DB.prepare(
      'SELECT id, achieved_at FROM server_firsts WHERE season = 1 AND career_id = ?',
    )
      .bind('career-1')
      .all<{ id: string; achieved_at: string }>();
    expect(claimed.results.length).toBeGreaterThan(0);
    await ctx.env.DB.prepare(
      "INSERT INTO server_firsts (season, id, career_id, achieved_at) SELECT 7, id, 'career-2', '2000-01-01' FROM server_firsts WHERE season = 1",
    ).run();
    // 다른 시즌의 더 이른 기록은 이 시즌 자리를 뺏지도, 다시 쓰게 하지도 않는다.
    expect(
      await recordCareerFirsts(ctx.db, 'career-1', { legendOnly: true, automaticHiding: false }),
    ).toBe(false);
    const after = await ctx.env.DB.prepare(
      'SELECT count(*) AS n FROM server_firsts WHERE season = 1 AND career_id = ?',
    )
      .bind('career-1')
      .first<{ n: number }>();
    expect(after?.n).toBe(claimed.results.length);
  });

  it('open listing count among a lineup reads only those cards (T-11-268)', async () => {
    await ctx.env.DB.prepare(
      `
      WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<1499)
      INSERT INTO market_listings (id, career_id, seller_id, season, price, status, created_at, closed_at)
      SELECT 'listing-'||x, 'career-'||(x+100), 'profile-'||(x%80), 0, 1000,
        CASE WHEN x%3=0 THEN 'sold' ELSE 'open' END, '2026-09-28', NULL FROM n
    `,
    ).run();
    const ids = ['career-101', 'career-102', 'career-103', 'career-105', 'career-1', 'career-2'];
    traced.queries.length = 0;
    expect(await countOpenListingsAmong(traced.db, ids)).toBe(3);
    const q = traced.queries[0]!;
    const baseline = {
      ...q,
      sql: q.sql.replace(' INDEXED BY market_listings_open_card_unique', ''),
    };
    const current = await run(q);
    const old = await run(baseline);
    expect(current.results).toEqual(old.results);
    expect(await plan(q)).toContain('market_listings_open_card_unique');
    expect(current.meta.rows_read * 20).toBeLessThan(old.meta.rows_read);
    console.info('open listings rows read', {
      before: old.meta.rows_read,
      after: current.meta.rows_read,
    });
  });
});
