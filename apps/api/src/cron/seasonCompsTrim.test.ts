import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { COMPS_TRIM, SEASON_COMPS_TRIM_KEY, trimSeasonComps } from './seasonCompsTrim.js';

let ctx: TestD1;
const run = (sql: string, ...params: unknown[]) =>
  ctx.env.DB.prepare(sql)
    .bind(...params)
    .run();

/** 시즌 행 n개(커리어 하나, 해마다 한 행). 모두 comps·ch가 차 있다. */
async function seed(n: number, from = 2000) {
  await run(
    `INSERT OR IGNORE INTO careers(id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at)
     VALUES ('c1', 'owner', 'FW', 'right', 'late', 'star', 2000, 'active', 'test', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`,
  );
  for (let y = from; y < from + n; y++)
    await run(
      `INSERT INTO career_seasons(career_id,year,age,club,league,apps,goals,assists,rating,rank,ovr,honors_json,mil,events_json,created_at,comps_json,ch_json)
       VALUES ('c1', ?, 18, 'club', 'k1', 30, 10, 5, 7, '1', 60, '[]', 0, '[]', '2026-11-01T00:00:00Z', '[{"type":"cup"}]', '["goals"]')`,
      y,
    );
}
const filled = async () =>
  (await ctx.env.DB.prepare(
    'SELECT count(*) AS n FROM career_seasons WHERE comps_json IS NOT NULL OR ch_json IS NOT NULL',
  ).first<{ n: number }>())!.n;

beforeEach(async () => {
  ctx = await createTestD1();
  await run(
    "INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES ('owner','{}','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z')",
  );
});
afterEach(async () => {
  await ctx.dispose();
});

describe('T-11-829 trimSeasonComps', () => {
  it('rowid 구간으로 끝까지 비우고, 다른 열은 그대로 두고, 끝나면 읽기만 한다', async () => {
    await seed(5);
    const r = await trimSeasonComps(ctx.env.DB);
    expect(r).toMatchObject({ cursor: 5, end: 5, cleared: 5, done: true, doneToday: true });
    expect(await filled()).toBe(0);
    const row = await ctx.env.DB.prepare(
      'SELECT goals, honors_json AS h FROM career_seasons WHERE year=2000',
    ).first();
    expect(row).toEqual({ goals: 10, h: '[]' });

    // 끝난 뒤 들어온 행(옛 코드가 쓴 값이라 해도)은 건드리지 않고 읽기 한 번으로 끝난다.
    await seed(1, 2100);
    expect(await trimSeasonComps(ctx.env.DB)).toMatchObject({ done: true, cleared: 5 });
    expect(await filled()).toBe(1);
  });

  it('시간이 다 되면 멈추고 다음 틱에 이어 간다, 하루 상한을 넘기지 않는다', async () => {
    await seed(3);
    // 구간 폭보다 큰 표를 흉내 내려고 end를 크게 잡은 상태에서 시작한다.
    const end = COMPS_TRIM.chunk * 2 + 3;
    await run(
      'INSERT INTO app_meta(key,value) VALUES (?1,?2)',
      SEASON_COMPS_TRIM_KEY,
      JSON.stringify({ cursor: 0, end, cleared: 0, done: false }),
    );
    let t = 0;
    const clock = () => (t += COMPS_TRIM.stepMs + 1);
    const first = await trimSeasonComps(ctx.env.DB, undefined, clock);
    expect(first).toMatchObject({
      cursor: COMPS_TRIM.chunk,
      cleared: 3,
      done: false,
      doneToday: false,
    });
    expect(await filled()).toBe(0);

    const capped = await trimSeasonComps(ctx.env.DB, { ...first, today: COMPS_TRIM.perDay });
    expect(capped).toMatchObject({ cursor: COMPS_TRIM.chunk, doneToday: true, done: false });

    const next = await trimSeasonComps(ctx.env.DB, first);
    expect(next).toMatchObject({ cursor: end, done: true, doneToday: true });
  });
});
