import {
  activeSeason,
  applySeasonSchedule,
  retireAtOf,
  SERVICE_SEASONS,
} from '@offside/contracts/service-seasons';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { forgetSeasonSchedule, readSeasonSchedule, SCHEDULE_KEY } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ceilKstMidnight } from '@offside/contracts/season-gauge';
import { countSeasonGauge, openCupEndsAt, readSeasonGauge, runSeasonGauge } from './seasonGauge.js';

// 시즌 1 개막(2026-10-06 00:00 KST) 이틀 뒤
const START = '2026-10-05T15:00:00.000Z';
const NOW = '2026-10-07T15:00:00.000Z';
const DAY = 86_400_000;
// T-11-189 시즌은 5주. 32일째면 진행률이 90%를 넘어 마감을 확정한다.
const LOCK = new Date(Date.parse(START) + 32 * DAY).toISOString();
let ctx: TestD1;
const run = (sql: string, ...params: unknown[]) =>
  ctx.env.DB.prepare(sql)
    .bind(...params)
    .run();
let seq = 0;
const retire = (profile: string, age: number, at: string, season = 1) =>
  run(
    `INSERT INTO careers(id, profile_id, pos, foot, type, trait, start_year, status, app_version, created_at, updated_at,
       retired_at, retire_age, service_season)
     VALUES (?, ?, 'FW', 'right', 'late', 'star', 2026, 'retired', 'test', ?, ?, ?, ?, ?)`,
    `c${++seq}`,
    profile,
    at,
    at,
    at,
    age,
    season,
  );

// 제1회 컵(마이그레이션이 넣어 둔 시즌 1 회차)의 결승과, 그 뒤로 미룬 마감.
let CUP_FINAL: string;
let END: string;
const later = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

beforeAll(async () => {
  ctx = await createTestD1();
  CUP_FINAL = (await openCupEndsAt(ctx.env.DB, 1))!;
  // 개막 + 35일. 그때까지 끝나지 않은 컵이 있으면 결승 다음 00:00 KST.
  END = new Date(
    Math.max(Date.parse(START) + 35 * DAY, ceilKstMidnight(Date.parse(CUP_FINAL) + 3_600_000)),
  ).toISOString();
  for (const p of ['a', 'b', 'c'])
    await run(
      'INSERT INTO profiles(id,settings_json,created_at,last_seen_at) VALUES (?,?,?,?)',
      p,
      '{}',
      START,
      START,
    );
  // a: 같은 날(KST) 25번 완주 → 하루 상한 20, 다음 날 1번 더
  for (let i = 0; i < 25; i++) await retire('a', 40, '2026-10-06T01:00:00.000Z');
  await retire('a', 36, '2026-10-06T16:00:00.000Z');
  // b: 완주 2번 + 조기 은퇴(센다에서 빠짐)
  await retire('b', 35, '2026-10-06T02:00:00.000Z');
  await retire('b', 44, '2026-10-07T02:00:00.000Z');
  await retire('b', 22, '2026-10-07T03:00:00.000Z');
  // c: 프리시즌 선수만(참여 유저가 아니다)
  await retire('c', 40, '2026-10-06T02:00:00.000Z', 0);
});
afterAll(() => {
  applySeasonSchedule([]);
  forgetSeasonSchedule();
  return ctx.dispose();
});

describe('시즌 진행 게이지 cron', () => {
  it('35세 이상 은퇴만, 유저·하루마다 20개까지 세고 참여 유저는 완주한 프로필만', async () => {
    expect(await countSeasonGauge(ctx.env.DB, 1, START)).toEqual({
      contributed: 20 + 1 + 2,
      participants: 2,
    });
  });

  it('완주 수는 참고 지표로만 굳히고 진행률은 시간으로 찬다 — 목표를 넘어도 마감을 확정하지 않는다(T-11-189)', async () => {
    const first = await runSeasonGauge(ctx.env.DB, NOW);
    // 목표(참여 2명 × 10 = 20)를 넘었지만 진행률은 2일 ÷ 35일이다.
    expect(first).toMatchObject({
      season: 1,
      contributed: 23,
      participants: 2,
      lockedAt: null,
      endsAt: null,
    });
    expect(first!.peak).toBeCloseTo(2 / 35);
    expect(await runSeasonGauge(ctx.env.DB, '2026-10-07T15:10:00.000Z')).toBeNull();
    expect((await readSeasonGauge(ctx.env.DB, 1))?.updatedAt).toBe(NOW);

    const res = await createApp().request('/v1/season/gauge', {}, ctx.env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        gauge: {
          target: number;
          progress: number;
          endsAt: null;
          minEndsAt: string;
          maxEndsAt: string;
        };
      };
    };
    // 진행률은 응답 시각(실제 지금)으로 다시 계산한다 — 확정 전에는 90%를 넘지 않는다. 마감은 개막 + 35일로 정해져 있다.
    const fixedEnd = new Date(Date.parse(START) + 35 * DAY).toISOString();
    expect(body.data.gauge).toMatchObject({
      target: 20,
      endsAt: null,
      minEndsAt: fixedEnd,
      maxEndsAt: fixedEnd,
    });
    expect(body.data.gauge.progress).toBeLessThanOrEqual(0.9);
  });

  it('90%(32일째)에 닿으면 마감을 개막 + 35일(끝나지 않은 컵이 있으면 그 뒤)로 확정한다', async () => {
    expect(await runSeasonGauge(ctx.env.DB, LOCK)).toMatchObject({
      season: 1,
      lockedAt: LOCK,
      endsAt: END,
      scheduled: true,
    });
  });

  it('마감을 확정하면 시즌 일정에 마감과 다음 시즌(마감 시각에 개막)을 적고, API가 일정을 내려 준다', async () => {
    expect(await readSeasonSchedule(ctx.env.DB)).toEqual([
      { id: 1, startsAt: START, endsAt: END, retireAt: 45 },
      { id: 2, startsAt: END, endsAt: null, retireAt: 45 },
    ]);
    expect(activeSeason(later(END, -1))?.id).toBe(1);
    expect(activeSeason(END)?.id).toBe(2);

    // 다른 아이솔레이트: 코드의 일정만 아는 상태에서 요청이 오면 굳힌 일정을 읽어 입힌다.
    applySeasonSchedule([]);
    forgetSeasonSchedule();
    expect(SERVICE_SEASONS).toHaveLength(1);
    const res = await createApp().request('/v1/season/gauge', {}, ctx.env);
    const body = (await res.json()) as { data: { seasons: { id: number }[] } };
    expect(body.data.seasons.map((s) => s.id)).toEqual([1, 2]);
    expect(SERVICE_SEASONS.map((s) => s.endsAt)).toEqual([END, null]);
  });

  it('마감 전에 누가 은퇴 나이까지 뛰면 다음 시즌 은퇴 나이를 올리고, 바뀐 게 없으면 다시 쓰지 않는다', async () => {
    await run(
      "INSERT INTO server_firsts(season, id, career_id, achieved_at) VALUES (1, 'retirecap', 'c1', ?)",
      '2026-10-08T00:00:00.000Z',
    );
    const after = later(LOCK, 60 * 60_000);
    expect(await runSeasonGauge(ctx.env.DB, after)).toMatchObject({
      scheduled: true,
    });
    expect(retireAtOf(2)).toBe(46);
    expect((await readSeasonSchedule(ctx.env.DB))[1]).toMatchObject({ id: 2, retireAt: 46 });
    expect(await runSeasonGauge(ctx.env.DB, later(after, 5 * 60_000))).toBeNull();
    const row = await ctx.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?')
      .bind(SCHEDULE_KEY)
      .first<{ value: string }>();
    expect(row?.value).toContain('"retireAt":46');
  });

  it('마감 시각이 지나면 다음 시즌 게이지를 새로 센다', async () => {
    const r = await runSeasonGauge(ctx.env.DB, later(END, 5 * 60_000));
    expect(r).toMatchObject({ season: 2, contributed: 0, participants: 0, lockedAt: null });
  });

  it('끝났거나 취소된 컵(cup_state.done_at)은 마감을 미루지 않는다', async () => {
    expect(await openCupEndsAt(ctx.env.DB, 1)).toBe(CUP_FINAL);
    await run(
      "INSERT INTO cup_state(cup_id, seed, groups, drawn_at, done_at) SELECT id, 's', 0, ?, ? FROM cups WHERE season = 1",
      NOW,
      NOW,
    );
    expect(await openCupEndsAt(ctx.env.DB, 1)).toBeNull();
  });
});
