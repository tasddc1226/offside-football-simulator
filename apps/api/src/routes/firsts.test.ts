import { FirstsResponseSchema, ProfileSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { FIRSTS } from '../firsts.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ORIGIN = 'http://localhost:5173';
const A = '0b000000-0000-4000-8000-00000000000a';
const B = '0b000000-0000-4000-8000-00000000000b';
const C = '0b000000-0000-4000-8000-00000000000c';

async function issueCookie(ctx: TestD1): Promise<string> {
  const res = await createApp().request('/v1/profile', {}, ctx.env);
  successEnvelope(ProfileSchema).parse(await res.json());
  return `offside_session=${/offside_session=([^;]+)/.exec(res.headers.get('Set-Cookie') ?? '')?.[1]}`;
}
const put = (ctx: TestD1, cookie: string, path: string, body: unknown) =>
  createApp().request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie }, body: JSON.stringify(body) }, ctx.env);
const seasonBody = (over: Record<string, unknown> = {}) => ({
  career: { pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late', startYear: 2026, appVersion: '1.0.0' },
  season: { age: 22, club: '테스트 FC', league: 'K리그1', apps: 30, goals: 10, assists: 3, rating: 7.2, rank: 1, ovr: 70, honors: [], ...over },
  events: [],
});
const summary = { retireAge: 34, peak: 88, legendScore: 900, apps: 300, goals: 120, assists: 60, trophies: 1, awards: 0, caps: 30, ballon: 0, lastClub: '테스트 FC' };
const read = async (ctx: TestD1) => {
  const res = await createApp().request('/v1/firsts', {}, ctx.env);
  expect(res.status).toBe(200);
  expect(res.headers.get('Cache-Control')).toContain('public');
  return successEnvelope(FirstsResponseSchema).parse(await res.json()).data;
};
const achieved = (data: Awaited<ReturnType<typeof read>>) => data.items.filter((x) => x.holder).length;
const holderOf = (data: Awaited<ReturnType<typeof read>>, id: string) => data.items.find((x) => x.id === id)?.holder ?? null;

describe('서버 최초 기록 /v1/firsts (T-10-027)', () => {
  let ctx: TestD1;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = await issueCookie(ctx);
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('로그인 없이 읽고, 아무 기록도 없으면 모든 항목이 미달성이다', async () => {
    const data = await read(ctx);
    expect(achieved(data)).toBe(0);
    expect(data.items.map((x) => x.id)).toEqual(FIRSTS.map((d) => d.id));
    expect(data.items.every((x) => x.holder === null && x.achievedAt === null)).toBe(true);
  });

  it('시즌 업로드로 기록이 생기고, 나중에 같은 기록을 채운 커리어는 자리를 뺏지 못한다', async () => {
    expect((await put(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 32 }))).status).toBe(200);
    expect((await put(ctx, cookie, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 45 }))).status).toBe(200);
    const data = await read(ctx);
    expect(holderOf(data, 'sgoals30')).toEqual({ careerId: A, name: null, pos: 'FW', number: null });
    expect(holderOf(data, 'sgoals40')?.careerId).toBe(B);
    expect(achieved(data)).toBe(2);
  });

  it('은퇴 때 레전드 점수 기록을 판정하고, 이름은 공개를 고른 경우에만 보인다', async () => {
    await put(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody());
    await put(ctx, cookie, `/v1/careers/${A}/retirement`, { ...summary, publicName: null });
    expect(holderOf(await read(ctx), 'legend840')).toMatchObject({ careerId: A, name: null });
    await put(ctx, cookie, `/v1/careers/${A}/retirement`, { ...summary, publicName: '김오프' });
    const data = await read(ctx);
    expect(holderOf(data, 'legend840')).toMatchObject({ careerId: A, name: '김오프' });
    expect(holderOf(data, 'legend1000')).toBeNull();
  });

  it('기록을 가진 프로필이 지워지면 그다음으로 이른 달성자가 이어받는다(나중에 올린 사람이 아니라)', async () => {
    const other = await issueCookie(ctx);
    const late = await issueCookie(ctx);
    await put(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 32 }));
    await put(ctx, other, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 35 }));
    expect(holderOf(await read(ctx), 'sgoals30')?.careerId).toBe(A);

    const app = createApp();
    const h = (key: string) => ({ 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie, 'Idempotency-Key': key });
    const tokenRes = await app.request('/v1/profile/delete', { method: 'POST', headers: h('idem-firsts-del-token'), body: '{}' }, ctx.env);
    const { data } = (await tokenRes.json()) as { data: { confirmToken: string } };
    const confirm = await app.request('/v1/profile/delete', { method: 'POST', headers: h('idem-firsts-del-confirm'), body: JSON.stringify({ confirmToken: data.confirmToken }) }, ctx.env);
    expect(confirm.status).toBe(204);

    await put(ctx, late, `/v1/careers/${C}/seasons/2030`, seasonBody({ goals: 31 }));
    expect(holderOf(await read(ctx), 'sgoals30')?.careerId).toBe(B);
  });

  it('배포 전 기록은 첫 조회 때 한 번 소급하고, 업로드 순서와 상관없이 더 이른 시각이 이긴다', async () => {
    await put(ctx, cookie, `/v1/careers/${A}/seasons/2030`, seasonBody({ goals: 35 }));
    await put(ctx, cookie, `/v1/careers/${B}/seasons/2030`, seasonBody({ goals: 35 }));
    // 규칙 도입 전 상태로 되돌리고, B의 시즌이 먼저 올라온 것으로 바꾼다.
    const db = ctx.env.DB;
    await db.prepare('DELETE FROM server_firsts').run();
    await db.prepare("UPDATE career_seasons SET created_at = '2026-01-01T00:00:00.000Z' WHERE career_id = ?").bind(B).run();
    const data = await read(ctx);
    expect(holderOf(data, 'sgoals30')?.careerId).toBe(B);
    expect(data.items.find((x) => x.id === 'sgoals30')?.achievedAt).toBe('2026-01-01T00:00:00.000Z');
    // 두 번째 조회는 버전이 같아 다시 훑지 않는다.
    await db.prepare('DELETE FROM server_firsts').run();
    expect(achieved(await read(ctx))).toBe(0);
  });
});
