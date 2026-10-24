import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { DAY_MS } from '../time.js';
import { PRUNE, pruneAbandonedCareers, UNCHANGED } from './pruneAbandoned.js';

const NOW = Date.parse('2026-10-23T19:00:00Z');
const ago = (days: number, plusMs = 0) => new Date(NOW - days * DAY_MS + plusMs).toISOString();
let ctx: TestD1;
const run = (sql: string, ...params: unknown[]) =>
  ctx.env.DB.prepare(sql)
    .bind(...params)
    .run();
const ids = async (table: 'careers' | 'pruned_careers', col = 'id') =>
  (
    await ctx.env.DB.prepare(`SELECT ${col} AS id FROM ${table} ORDER BY 1`).all<{ id: string }>()
  ).results.map((r) => r.id);

/** 진행 중 커리어 하나: days일 전에 만들고 playMs 동안 시즌 2개를 올렸다. */
async function seed(
  id: string,
  { days = 8, playMs = 10 * 60_000, status = 'active', season = 1 as number | null } = {},
) {
  await run(
    `INSERT INTO careers(id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at, service_season)
     VALUES (?, 'owner', 'FW', 'right', 'late', 'star', 2026, ?, 'test', ?, ?, ?)`,
    id,
    status,
    ago(days),
    ago(days, playMs),
    season,
  );
  for (const year of [2026, 2027])
    await run(
      `INSERT INTO career_seasons(career_id,year,age,club,league,apps,goals,assists,rating,rank,ovr,honors_json,mil,events_json,created_at)
       VALUES (?, ?, 18, 'club', 'k1', 30, 10, 5, 7, '1', 60, '[]', 0, '[]', ?)`,
      id,
      year,
      ago(days),
    );
}

beforeEach(async () => {
  ctx = await createTestD1();
  await run(
    "INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('owner','{}',?,?)",
    ago(30),
    ago(1),
  );
});
afterEach(() => ctx.dispose());

describe('T-11-468 버린 커리어 정리', () => {
  it('지울 커리어는 넘긴 id로만 찾는다(진행 중 커리어 전체를 훑지 않는다, T-11-468b)', async () => {
    const { results } = await ctx.env.DB.prepare(
      `EXPLAIN QUERY PLAN DELETE FROM careers WHERE id IN (${UNCHANGED})`,
    )
      .bind('[]')
      .all<{ detail: string }>();
    const plan = results.map((r) => r.detail);
    expect(plan.some((d) => /^SCAN j\b/.test(d))).toBe(true);
    expect(plan.find((d) => /^(SEARCH|SCAN) c\b/.test(d))).toMatch(/\bid=\?/);
  });

  it('한 시간 안에 멈추고 일주일 넘게 갱신이 없는 진행 중 커리어만 지우고 주인 · 서비스 시즌을 남긴다', async () => {
    await seed('gone', { season: 0 });
    await seed('recent', { days: 6 });
    await seed('long-play', { playMs: 2 * 60 * 60_000 });
    await seed('retired', { status: 'retired' });
    await seed('titled');
    await run("UPDATE careers SET title = 't' WHERE id = 'titled'");
    await seed('first');
    await run(
      "INSERT INTO server_firsts(season, id, career_id, achieved_at) VALUES (1, 'x', 'first', ?)",
      ago(8),
    );

    const r = await pruneAbandonedCareers(ctx.env.DB, NOW);
    expect(r).toMatchObject({ pruned: 1, raced: 0, done: true });
    expect(await ids('careers')).toEqual(['first', 'long-play', 'recent', 'retired', 'titled']);
    expect(
      (
        await ctx.env.DB.prepare(
          "SELECT count(*) AS n FROM career_seasons WHERE career_id = 'gone'",
        ).first<{ n: number }>()
      )?.n,
    ).toBe(0);
    expect(
      await ctx.env.DB.prepare(
        'SELECT career_id, profile_id, service_season FROM pruned_careers',
      ).all(),
    ).toMatchObject({ results: [{ career_id: 'gone', profile_id: 'owner', service_season: 0 }] });

    // 다시 돌아도 남은 커리어는 그대로다.
    expect(await pruneAbandonedCareers(ctx.env.DB, NOW)).toMatchObject({
      pruned: 0,
      raced: 0,
      done: true,
    });
  });

  it('페이지를 넘겨 이어 지우고, 하루 상한에 닿으면 멈춘다', async () => {
    for (let i = 0; i < PRUNE.page + 5; i++) await seed(`c${String(i).padStart(4, '0')}`);
    const r = await pruneAbandonedCareers(ctx.env.DB, NOW);
    expect(r).toMatchObject({ pruned: PRUNE.page + 5, raced: 0, done: true });
    expect(await ids('careers')).toEqual([]);

    await seed('more');
    // 오늘 앞선 단계에서 이미 하루 상한만큼 지웠으면 더 지우지 않는다.
    expect(
      await pruneAbandonedCareers(ctx.env.DB, NOW, { pruned: PRUNE.perDay, raced: 0, done: false }),
    ).toMatchObject({ pruned: PRUNE.perDay, raced: 0, done: true });
    expect(await ids('careers')).toEqual(['more']);
  });
});
