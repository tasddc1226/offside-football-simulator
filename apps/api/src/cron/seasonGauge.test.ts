import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { countSeasonGauge, readSeasonGauge, runSeasonGauge } from './seasonGauge.js';

// 시즌 1 개막(2026-10-06 00:00 KST) 이틀 뒤
const START = '2026-10-05T15:00:00.000Z';
const NOW = '2026-10-07T15:00:00.000Z';
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

beforeAll(async () => {
  ctx = await createTestD1();
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
afterAll(() => ctx.dispose());

describe('시즌 진행 게이지 cron', () => {
  it('35세 이상 은퇴만, 유저·하루마다 20개까지 세고 참여 유저는 완주한 프로필만', async () => {
    expect(await countSeasonGauge(ctx.env.DB, 1, START)).toEqual({
      contributed: 20 + 1 + 2,
      participants: 2,
    });
  });

  it('센 값을 굳히고(90%를 넘으면 마감 확정) 30분 안에는 다시 세지 않으며, 홈 API가 진행률을 돌려준다', async () => {
    const first = await runSeasonGauge(ctx.env.DB, NOW);
    // 목표(참여 2명 × 10 = 20)를 넘었으니 마감을 확정한다 — 48시간 뒤보다 최소 7일이 늦어 10/13 00:00 KST.
    expect(first).toMatchObject({
      season: 1,
      contributed: 23,
      participants: 2,
      lockedAt: NOW,
      endsAt: '2026-10-12T15:00:00.000Z',
    });
    expect(await runSeasonGauge(ctx.env.DB, '2026-10-07T15:10:00.000Z')).toBeNull();
    expect((await readSeasonGauge(ctx.env.DB, 1))?.updatedAt).toBe(NOW);

    const res = await createApp().request('/v1/season/gauge', {}, ctx.env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { gauge: { target: number; progress: number; endsAt: string } };
    };
    // 진행률은 응답 시각(실제 지금)으로 다시 계산한다 — 확정 뒤에는 90%에서 마감 시각 100%로 시간에 따라 찬다.
    expect(body.data.gauge).toMatchObject({ target: 20, endsAt: '2026-10-12T15:00:00.000Z' });
    expect(body.data.gauge.progress).toBeGreaterThanOrEqual(0.9);
  });
});
