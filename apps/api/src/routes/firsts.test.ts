import { FirstsResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { ensureFirstsBackfilled } from '../db/repos/firsts.js';
import { firstsCatalog } from '../firsts.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { deleteProfile, issueCookie, putJson, putSeasonsFor, TEST_CAREER } from '../test/http.js';

const A = '0b000000-0000-4000-8000-00000000000a';
const B = '0b000000-0000-4000-8000-00000000000b';
const C = '0b000000-0000-4000-8000-00000000000c';

const seasonBody = (over: Record<string, unknown> = {}) => ({
  career: TEST_CAREER,
  season: {
    age: 22,
    club: '테스트 FC',
    league: 'K리그1',
    apps: 30,
    goals: 10,
    assists: 3,
    rating: 7.2,
    rank: 1,
    ovr: 70,
    honors: [],
    ...over,
  },
  events: [],
});
// 발롱도르 5회 — 받아 둔 시즌 기록으로 900점을 낼 수 있는 레전드.
const summary = {
  retireAge: 34,
  peak: 88,
  legendScore: 900,
  apps: 300,
  goals: 120,
  assists: 60,
  trophies: 1,
  awards: 5,
  caps: 30,
  ballon: 5,
  lastClub: '테스트 FC',
};
const read = async (ctx: TestD1) => {
  const res = await createApp().request('/v1/firsts', {}, ctx.env);
  expect(res.status).toBe(200);
  expect(res.headers.get('Cache-Control')).toContain('public');
  return successEnvelope(FirstsResponseSchema).parse(await res.json()).data;
};
const achieved = (data: Awaited<ReturnType<typeof read>>) =>
  data.items.filter((x) => x.holder).length;
const holderOf = (data: Awaited<ReturnType<typeof read>>, id: string) =>
  data.items.find((x) => x.id === id)?.holder ?? null;

describe('서버 최초 기록 /v1/firsts (T-10-027)', () => {
  let ctx: TestD1;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('로그인 없이 읽고, 아무 기록도 없으면 모든 항목이 미달성이다', async () => {
    const data = await read(ctx);
    expect(achieved(data)).toBe(0);
    expect(data.items.map((x) => x.id)).toEqual(firstsCatalog([]).map((d) => d.id));
    expect(data.items.every((x) => x.holder === null && x.achievedAt === null)).toBe(true);
  });

  it('시즌 업로드로 기록이 생기고, 나중에 같은 기록을 채운 커리어는 자리를 뺏지 못한다', async () => {
    expect(
      (await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 32 })))
        .status,
    ).toBe(200);
    expect(
      (await putJson(ctx, cookie, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 45 })))
        .status,
    ).toBe(200);
    const data = await read(ctx);
    expect(holderOf(data, 'sgoals30')).toEqual({
      careerId: A,
      name: null,
      pos: 'FW',
      number: null,
    });
    expect(holderOf(data, 'sgoals40')?.careerId).toBe(B);
    expect(achieved(data)).toBe(2);
  });

  it('은퇴 때 레전드 점수 기록을 판정하고, 이름은 공개를 고른 경우에만 보인다', async () => {
    await putSeasonsFor(ctx.env, cookie, A, summary);
    await putJson(ctx, cookie, `/v1/careers/${A}/retirement`, { ...summary, publicName: null });
    expect(holderOf(await read(ctx), 'legend840')).toMatchObject({ careerId: A, name: null });
    await putJson(ctx, cookie, `/v1/careers/${A}/retirement`, { ...summary, publicName: '김오프' });
    const data = await read(ctx);
    expect(holderOf(data, 'legend840')).toMatchObject({ careerId: A, name: '김오프' });
    expect(holderOf(data, 'legend1000')).toBeNull();
  });

  it('기록을 가진 프로필이 지워지면 그다음으로 이른 달성자가 이어받는다(나중에 올린 사람이 아니라)', async () => {
    const other = (await issueCookie(ctx)).cookie;
    const late = (await issueCookie(ctx)).cookie;
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 32 }));
    await putJson(ctx, other, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 35 }));
    expect(holderOf(await read(ctx), 'sgoals30')?.careerId).toBe(A);

    expect((await deleteProfile(ctx.env, cookie, 'idem-firsts-del')).status).toBe(204);

    await putJson(ctx, late, `/v1/careers/${C}/seasons/2030`, seasonBody({ goals: 31 }));
    expect(holderOf(await read(ctx), 'sgoals30')?.careerId).toBe(B);
  });

  it('배포 전 기록은 첫 조회 때 한 번 소급하고, 업로드 순서와 상관없이 더 이른 시각이 이긴다', async () => {
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 35 }));
    await putJson(ctx, cookie, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 35 }));
    // 규칙 도입 전 상태로 되돌리고, B의 시즌이 먼저 올라온 것으로 바꾼다.
    const db = ctx.env.DB;
    await db.prepare('DELETE FROM server_firsts').run();
    await db
      .prepare(
        "UPDATE career_seasons SET created_at = '2026-01-01T00:00:00.000Z' WHERE career_id = ?",
      )
      .bind(B)
      .run();
    const data = await read(ctx);
    expect(holderOf(data, 'sgoals30')?.careerId).toBe(B);
    expect(data.items.find((x) => x.id === 'sgoals30')?.achievedAt).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    // 두 번째 조회는 버전이 같아 다시 훑지 않는다.
    await db.prepare('DELETE FROM server_firsts').run();
    expect(achieved(await read(ctx))).toBe(0);
  });

  it('서버 기록: 더 큰 값만 자리를 바꾸고, 같은 값이면 먼저 세운 쪽이 지킨다 (T-10-056)', async () => {
    const other = (await issueCookie(ctx)).cookie;
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 30 }));
    await putJson(ctx, other, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 45 }));
    const rec = async (id: string) => (await read(ctx)).records.find((r) => r.id === id);
    expect(await rec('sgoals')).toMatchObject({ value: 45, unit: '골', holder: { careerId: B } });
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2031`, seasonBody({ goals: 45 }));
    expect((await rec('sgoals'))?.holder?.careerId).toBe(B);
    // 통산은 A가 30 + 45 = 75로 앞선다.
    expect(await rec('goals')).toMatchObject({ value: 75, holder: { careerId: A } });
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2032`, seasonBody({ goals: 50 }));
    expect(await rec('sgoals')).toMatchObject({ value: 50, holder: { careerId: A } });
    expect(await rec('legend')).toMatchObject({ value: null, achievedAt: null, holder: null });
  });

  it('서버 기록을 가진 프로필이 지워지면 그다음 최고값이 이어받는다 (T-10-056)', async () => {
    const other = (await issueCookie(ctx)).cookie;
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 50 }));
    await putJson(ctx, other, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 40 }));
    expect((await deleteProfile(ctx.env, cookie, 'idem-records-del')).status).toBe(204);
    const r = (await read(ctx)).records.find((x) => x.id === 'sgoals');
    expect(r).toMatchObject({ value: 40, holder: { careerId: B } });
  });

  it('전체 재계산은 조각씩 이어서 훑고, 다 끝나면 멈춘다 (T-10-056)', async () => {
    const cookies = [cookie, (await issueCookie(ctx)).cookie, (await issueCookie(ctx)).cookie];
    for (const [i, id] of [A, B, C].entries())
      await putJson(
        ctx,
        cookies[i]!,
        `/v1/careers/${id}/seasons/2030`,
        seasonBody({ goals: 31 + i }),
      );
    const db = ctx.env.DB;
    await db.prepare('DELETE FROM server_firsts').run();
    await db.prepare('DELETE FROM server_records').run();
    await db.prepare("DELETE FROM app_meta WHERE key LIKE 'server_firsts_%'").run();
    // 가장 늦게 올린 C가 가장 이른 시즌을 가진 것으로 바꾼다 — 끝까지 훑어야 C가 최초가 된다.
    await db
      .prepare(
        "UPDATE career_seasons SET created_at = '2026-01-01T00:00:00.000Z' WHERE career_id = ?",
      )
      .bind(C)
      .run();
    const steps: boolean[] = [];
    for (let i = 0; i < 5; i++) steps.push(await ensureFirstsBackfilled(ctx.db, 1));
    expect(steps).toEqual([true, true, true, true, false]); // 3조각 + 빈 조각에서 끝 표시
    const data = await read(ctx);
    expect(holderOf(data, 'sgoals30')?.careerId).toBe(C);
    expect(data.records.find((r) => r.id === 'sgoals')).toMatchObject({
      value: 33,
      holder: { careerId: C },
    });
  });
});
