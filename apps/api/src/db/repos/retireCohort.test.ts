import { successEnvelope } from '@offside/contracts';
import { RetireCohortResponseSchema } from '@offside/contracts/retire-cohort';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { purgeEdgeOrigin } from '../../edgeCache.js';
import { profiles } from '../schema.js';
import { createTestD1, spyDb, type TestD1 } from '../../test/d1.js';
import { buildRetireCohort, readRetireCohort, RETIRE_COHORT_KEY } from './retireCohort.js';

// T-11-675 은퇴 동기 비교: 하루 한 번 분포를 만들고, 공개 조회는 그 한 행만 읽는다.
const NOW = '2026-11-09T18:30:00.000Z';
const T = '2026-11-01T00:00:00.000Z';

let ctx: TestD1;
beforeEach(async () => {
  ctx = await createTestD1();
  // 시즌 1이 10-31 00:00 KST에 끝나고 시즌 2가 열린 운영 일정.
  applySeasonSchedule(closeSeasonSchedule(1, '2026-10-30T15:00:00.000Z', false));
  await ctx.db
    .insert(profiles)
    .values({ id: 'p1', settingsJson: '{}', lastSeenAt: T, createdAt: T });
});
afterEach(async () => {
  applySeasonSchedule([]);
  await ctx.dispose();
});

/** 시즌 season에 은퇴한 pos 선수 n명. i번째 선수의 골은 i(0~n-1), 숨김 선수 · 진행 중 커리어도 한 명씩 섞는다. */
async function seed(season: number, pos: string, n: number, extra: Record<string, number> = {}) {
  const rows: unknown[][] = [];
  for (let i = 0; i < n; i++)
    rows.push([`${pos}-${season}-${i}`, pos, 'retired', 0, season, i, extra.caps ?? 0]);
  rows.push([`${pos}-${season}-hidden`, pos, 'retired', 1, season, 100_000, 0]);
  rows.push([`${pos}-${season}-active`, pos, 'active', 0, season, 100_000, 0]);
  for (let i = 0; i < rows.length; i += 50)
    await ctx.env.DB.prepare(
      `INSERT INTO careers (id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at,
         hidden, service_season, goals, caps, legend_score, peak, apps, assists, trophies, ballon)
       SELECT value ->> 0, 'p1', value ->> 1, '오른발', 'poacher', 'late', 2026, value ->> 2, '1.0.0', ?, ?,
         value ->> 3, value ->> 4, value ->> 5, value ->> 6, value ->> 5, 80, 300, 0, 0, 0
       FROM json_each(?)`,
    )
      .bind(T, T, JSON.stringify(rows.slice(i, i + 50)))
      .run();
}

describe('은퇴 동기 분포 (T-11-675)', () => {
  it('그 시즌 은퇴 · 숨기지 않은 커리어만, 포지션별로 지점을 만든다', async () => {
    await seed(2, 'FW', 1000);
    await seed(2, 'GK', 50);
    const c = await buildRetireCohort(ctx.env.DB, NOW);
    expect(c.season).toBe(2);
    expect(c.pos.FW?.n).toBe(1000);
    // 골 0~999: 상위 0.1%는 999골, 1%는 990골, 50%는 500골. 숨김 · 진행 중(10만 골)은 빠진다.
    const goals = c.pos.FW!.m.goals!;
    expect(goals[0]).toEqual([999, 0.1]);
    expect(goals).toContainEqual([990, 1]);
    expect(goals.at(-1)).toEqual([500, 50]);
    // 모두 0인 기록(도움)은 지점이 없다. 적은 포지션은 인원만 남긴다.
    expect(c.pos.FW!.m.assists).toBeUndefined();
    expect(c.pos.GK).toEqual({ n: 50, m: {} });
    expect(await readRetireCohort(ctx.env.DB)).toEqual(c);
  });

  it('시즌이 막 열려 인원이 모자라면 바로 앞 시즌으로 비교한다', async () => {
    await seed(1, 'MF', 300);
    await seed(2, 'MF', 10);
    expect((await buildRetireCohort(ctx.env.DB, NOW)).season).toBe(1);
  });

  it('공개 조회는 세션 · 프로필을 보지 않고 저장된 한 행만 읽는다, 계산 전이면 null', async () => {
    const get = async () => {
      const { DB, seen } = spyDb(ctx.env.DB);
      const res = await createApp().request(
        '/v1/retire-cohort',
        { headers: { Cookie: 'offside_session=abc' } },
        { ...ctx.env, DB },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(seen.some((q) => /sessions|profiles|careers/.test(q))).toBe(false);
      return successEnvelope(RetireCohortResponseSchema).parse(await res.json()).data;
    };
    expect(await get()).toBeNull();
    await seed(2, 'DF', 250);
    // 요청 미들웨어가 저장된 시즌 일정을 다시 입히므로 운영 일정을 한 번 더 둔다.
    applySeasonSchedule(closeSeasonSchedule(1, '2026-10-30T15:00:00.000Z', false));
    await buildRetireCohort(ctx.env.DB, NOW);
    await purgeEdgeOrigin('http://localhost', ['/v1/retire-cohort']);
    expect(await get()).toMatchObject({ season: 2, pos: { DF: { n: 250 } } });
    // 깨진 값은 없는 것으로 본다.
    await ctx.env.DB.prepare('UPDATE app_meta SET value = ? WHERE key = ?')
      .bind('{"season":"x"}', RETIRE_COHORT_KEY)
      .run();
    await purgeEdgeOrigin('http://localhost', ['/v1/retire-cohort']);
    expect(await get()).toBeNull();
  });
});
