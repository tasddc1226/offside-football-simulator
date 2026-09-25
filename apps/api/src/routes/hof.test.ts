import { HofDetailResponseSchema, HofListResponseSchema, ProfileSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';

const ORIGIN = 'http://localhost:5173';
const CAREER_ID = '3b1d6c1e-2a4f-4f7e-9a0b-7c8d9e0f1a2b';

async function issueCookie(ctx: TestD1): Promise<string> {
  const res = await createApp().request('/v1/profile', {}, ctx.env);
  const token = /offside_session=([^;]+)/.exec(res.headers.get('Set-Cookie') ?? '')?.[1];
  successEnvelope(ProfileSchema).parse(await res.json());
  return `offside_session=${token}`;
}

function put(ctx: TestD1, cookie: string, path: string, body: unknown) {
  return createApp().request(
    path,
    { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie }, body: JSON.stringify(body) },
    ctx.env,
  );
}

const season = {
  career: { pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late', startYear: 2026, appVersion: '1.0.0' },
  season: { age: 18, club: '테스트 FC', league: '고교리그', apps: 20, goals: 10, assists: 3, rating: 7.2, rank: 1, ovr: 60, honors: [] },
  events: [],
};
const summary = { retireAge: 34, peak: 88, legendScore: 420, apps: 300, goals: 120, assists: 60, trophies: 1, awards: 0, caps: 30, ballon: 0, lastClub: '테스트 FC' };
const snapshot = {
  number: 7,
  pos: 'FW',
  age: 34,
  peak: 88,
  lastClub: '테스트 FC',
  career: [{ year: 2026, age: 18, club: '테스트 FC', league: '고교리그', apps: 20, goals: 10, assists: 3, cs: 0, rating: 7.2, rank: 1, ovr: 60, honors: ['고교리그 우승'], ch: ['goals'] }],
  trophies: [{ year: 2026, t: '고교리그 우승', club: '테스트 FC' }],
  awards: [],
  ballon: [],
  nat: { caps: 30 },
  storyLog: [],
  miles: [{ year: 2026, t: '데뷔' }],
};

describe('공개 명예의 전당 /v1/hof', () => {
  let ctx: TestD1;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = await issueCookie(ctx);
    expect((await put(ctx, cookie, `/v1/careers/${CAREER_ID}/seasons/2026`, season)).status).toBe(200);
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('로그인 없이 목록을 읽고, 이름은 공개를 고르기 전엔 익명이다', async () => {
    expect((await put(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, { ...summary, publicName: null, snapshot })).status).toBe(200);
    const res = await createApp().request('/v1/hof', {}, ctx.env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age');
    const { entries } = successEnvelope(HofListResponseSchema).parse(await res.json()).data;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: CAREER_ID, name: null, number: 7, legendScore: 420, hasDetail: true });
  });

  it('다시 PUT하면 이름 공개로 바뀌고 최초 은퇴 시각은 유지된다', async () => {
    await put(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, { ...summary, publicName: null, snapshot });
    const first = successEnvelope(HofDetailResponseSchema).parse(await (await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).json()).data;
    expect((await put(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, { ...summary, publicName: '  김오프  ' })).status).toBe(200);
    const res = await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env);
    const detail = successEnvelope(HofDetailResponseSchema).parse(await res.json()).data;
    expect(detail.entry.name).toBe('김오프');
    expect(detail.entry.retiredAt).toBe(first.entry.retiredAt);
    // 스냅샷을 빼고 보내도 기존 상세는 지워지지 않는다.
    expect(detail.snapshot?.career[0]?.honors).toEqual(['고교리그 우승']);
  });

  it('옛 클라이언트 본문(이름·스냅샷 없음)도 목록에 익명·상세 없음으로 나온다', async () => {
    await put(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, summary);
    const { entries } = successEnvelope(HofListResponseSchema).parse(await (await createApp().request('/v1/hof', {}, ctx.env)).json()).data;
    expect(entries[0]).toMatchObject({ name: null, number: null, hasDetail: false });
  });

  it('은퇴하지 않은 커리어·없는 ID는 404', async () => {
    expect((await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).status).toBe(404);
    const { entries } = successEnvelope(HofListResponseSchema).parse(await (await createApp().request('/v1/hof', {}, ctx.env)).json()).data;
    expect(entries).toHaveLength(0);
  });

  it('page·limit으로 레전드 점수 순 페이지를 나눠 읽고 전체 인원을 준다', async () => {
    const ids = ['0a000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000003'];
    for (const [i, id] of ids.entries()) {
      await put(ctx, cookie, `/v1/careers/${id}/seasons/2026`, season);
      await put(ctx, cookie, `/v1/careers/${id}/retirement`, { ...summary, legendScore: 100 * (i + 1) });
    }
    const read = async (q: string) =>
      successEnvelope(HofListResponseSchema).parse(await (await createApp().request(`/v1/hof?${q}`, {}, ctx.env)).json()).data;
    const p1 = await read('limit=2');
    expect(p1.total).toBe(3);
    expect(p1.entries.map((e) => e.legendScore)).toEqual([300, 200]);
    const p2 = await read('limit=2&page=2');
    expect(p2.entries.map((e) => e.legendScore)).toEqual([100]);
    expect((await createApp().request('/v1/hof?page=0', {}, ctx.env)).status).toBe(400);
  });

  it('링크·욕설이 든 공개 이름은 거절한다', async () => {
    const res = await put(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, { ...summary, publicName: 'www.spam.com' });
    expect(res.status).toBe(400);
  });
});
