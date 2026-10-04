import { FirstsResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const read = async (ctx: TestD1, query = '') => {
  const res = await createApp().request(`/v1/firsts${query}`, {}, ctx.env);
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
    vi.useRealTimers();
    await ctx.dispose();
  });

  it('로그인 없이 읽고, 아무 기록도 없으면 모든 항목이 미달성이다', async () => {
    const data = await read(ctx);
    expect(achieved(data)).toBe(0);
    expect(data.items.map((x) => x.id)).toEqual(firstsCatalog([], data.season).map((d) => d.id));
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

  it('T-11-029: 시즌마다 따로 겨룬다 — 시즌 1 선수도 같은 기록의 최초가 되고, 서버 기록도 시즌별이다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z')); // 프리시즌
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 32 }));
    // 개막 전 기본 목록은 프리시즌.
    expect(holderOf(await read(ctx), 'sgoals30')?.careerId).toBe(A);

    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1
    await putJson(ctx, cookie, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 35 }));
    // 기본 목록은 지금 시즌 — 프리시즌의 A가 아니라 시즌 1의 B가 최초다.
    const now = await read(ctx);
    expect(now.season).toBe(1);
    expect(holderOf(now, 'sgoals30')?.careerId).toBe(B);
    expect(now.records.find((r) => r.id === 'sgoals')).toMatchObject({
      value: 35,
      holder: { careerId: B },
    });
    const pre = await read(ctx, '?season=0');
    expect(pre.season).toBe(0);
    expect(holderOf(pre, 'sgoals30')?.careerId).toBe(A);
    expect(pre.records.find((r) => r.id === 'sgoals')).toMatchObject({
      value: 32,
      holder: { careerId: A },
    });
    expect(achieved(await read(ctx, '?season=1'))).toBe(achieved(now));

    // 프리시즌 선수의 새 기록은 프리시즌 안에서만 겨룬다.
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2031`, seasonBody({ goals: 50 }));
    expect((await read(ctx, '?season=0')).records.find((r) => r.id === 'sgoals')?.value).toBe(50);
    expect((await read(ctx, '?season=1')).records.find((r) => r.id === 'sgoals')?.value).toBe(35);
    expect((await createApp().request('/v1/firsts?season=9', {}, ctx.env)).status).toBe(400);
  });

  it('T-11-029: 전체 재계산도 커리어를 자기 시즌 기록으로만 판정한다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z'));
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 32 }));
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
    await putJson(ctx, cookie, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 35 }));
    const db = ctx.env.DB;
    await db.prepare('DELETE FROM server_firsts').run();
    await db.prepare('DELETE FROM server_records').run();
    await db.prepare("DELETE FROM app_meta WHERE key LIKE 'server_firsts_%'").run();
    // 첫 조회가 한 조각(전체)을 판정한다.
    expect(holderOf(await read(ctx, '?season=1'), 'sgoals30')?.careerId).toBe(B);
    expect(holderOf(await read(ctx, '?season=0'), 'sgoals30')?.careerId).toBe(A);
  });

  it('T-11-045: 시즌 1 선수가 45세에 은퇴하면 은퇴 나이 해금 기록이 생긴다 — 프리시즌 41세 은퇴는 해당 없다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const veteran = async (id: string, ages: number[], retireAge: number) => {
      for (const [i, age] of ages.entries())
        await putJson(ctx, cookie, `/v1/careers/${id}/seasons/${2060 + i}`, seasonBody({ age }));
      return putJson(ctx, cookie, `/v1/careers/${id}/retirement`, {
        ...summary,
        retireAge,
        publicName: null,
      });
    };
    vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z')); // 프리시즌
    expect((await veteran(A, [39, 40], 41)).status).toBe(200);
    expect((await read(ctx, '?season=0')).items.some((x) => x.id === 'retirecap')).toBe(false);

    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z')); // 시즌 1
    expect((await veteran(B, [43], 44)).status).toBe(200); // 은퇴 나이 전에 그만둠
    expect(holderOf(await read(ctx, '?season=1'), 'retirecap')).toBeNull();
    // 은퇴 나이를 부풀려 보내도 서버는 마지막 시즌 + 1로 맞춘다.
    expect((await veteran(C, [43, 44], 50)).status).toBe(200);
    const s1 = await read(ctx, '?season=1');
    expect(s1.items.find((x) => x.id === 'retirecap')).toMatchObject({
      label: '45세 은퇴 최초 달성! 다음 시즌 은퇴 나이 46세 해금',
      holder: { careerId: C },
    });
  });
});
