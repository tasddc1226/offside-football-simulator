import { LiveResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie, putJson, TEST_CAREER } from '../test/http.js';

const A = '0c000000-0000-4000-8000-00000000000a';
const B = '0c000000-0000-4000-8000-00000000000b';
const C = '0c000000-0000-4000-8000-00000000000c';

const seasonBody = (over: Record<string, unknown> = {}) => ({
  career: TEST_CAREER,
  season: {
    age: 18,
    club: '테스트 고교',
    league: '고교리그',
    apps: 20,
    goals: 15,
    assists: 4,
    rating: 7.4,
    rank: 1,
    ovr: 58,
    honors: [],
    ...over,
  },
  events: [],
});
const summary = {
  retireAge: 34,
  peak: 88,
  legendScore: 612,
  apps: 300,
  goals: 120,
  assists: 60,
  trophies: 1,
  awards: 0,
  caps: 30,
  ballon: 0,
  lastClub: '테스트 FC',
  publicName: null,
};
const read = async (ctx: TestD1) => {
  const res = await createApp().request('/v1/live', {}, ctx.env);
  expect(res.status).toBe(200);
  expect(res.headers.get('Cache-Control')).toContain('public');
  return successEnvelope(LiveResponseSchema).parse(await res.json()).data;
};

describe('홈 라이브 현황 /v1/live (T-10-030)', () => {
  let ctx: TestD1;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('로그인 없이 읽고, 아무 기록도 없으면 0과 빈 피드다', async () => {
    const data = await read(ctx);
    expect(data.stats).toEqual({ playing: 0, seasonsToday: 0, newToday: 0, retiredToday: 0 });
    expect(data.feed).toEqual([]);
  });

  it('시즌·은퇴 업로드가 최신순 피드와 오늘 숫자로 보인다 — 선수당 한 줄', async () => {
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2026`, seasonBody());
    await putJson(ctx, cookie, `/v1/careers/${B}/seasons/2026`, seasonBody());
    await putJson(
      ctx,
      cookie,
      `/v1/careers/${B}/seasons/2027`,
      seasonBody({ club: '테스트 FC', league: 'K리그1', goals: 21 }),
    );
    await putJson(
      ctx,
      cookie,
      `/v1/careers/${C}/seasons/2026`,
      seasonBody({ honors: ['고교리그 우승', '득점왕'] }),
    );
    await putJson(ctx, cookie, `/v1/careers/${A}/retirement`, summary);

    const data = await read(ctx);
    expect(data.stats).toEqual({ playing: 2, seasonsToday: 4, newToday: 3, retiredToday: 1 });
    // A는 은퇴 소식만, B는 최신 시즌(2027)만 남는다.
    expect(data.feed.map((e) => e.kind)).toEqual(['retire', 'season', 'season']);
    expect(data.feed[0]).toMatchObject({
      kind: 'retire',
      careerId: A,
      name: null,
      pos: 'FW',
      score: 612,
      lastClub: '테스트 FC',
    });
    expect(data.feed[1]).toMatchObject({
      kind: 'season',
      club: '테스트 고교',
      first: true,
      honor: '고교리그 우승',
    });
    expect(data.feed[2]).toMatchObject({
      kind: 'season',
      club: '테스트 FC',
      goals: 21,
      first: false,
      honor: null,
    });
    // 진행 중 커리어는 식별자를 내보내지 않는다.
    expect(data.feed.filter((e) => e.kind === 'season').every((e) => !('careerId' in e))).toBe(
      true,
    );
  });

  it('짧은 커리어 은퇴는 오늘 숫자에만 세고 은퇴 소식에는 올리지 않는다 (T-10-032)', async () => {
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2026`, seasonBody());
    await putJson(ctx, cookie, `/v1/careers/${A}/retirement`, { ...summary, retireAge: 21 });
    const data = await read(ctx);
    expect(data.stats.retiredToday).toBe(1);
    expect(data.feed).toEqual([]);
  });

  it('오늘 시즌 수는 한국 시각 오늘 자정 이후에 올라온 시즌만 센다', async () => {
    for (const year of [2026, 2027, 2028]) {
      await putJson(ctx, cookie, `/v1/careers/${A}/seasons/${year}`, seasonBody());
    }
    const twoDaysAgo = new Date(Date.now() - 48 * 3_600_000).toISOString();
    await ctx.env.DB.prepare('UPDATE career_seasons SET created_at = ? WHERE year = 2026')
      .bind(twoDaysAgo)
      .run();
    expect((await read(ctx)).stats.seasonsToday).toBe(2);
  });

  it('최근 1시간이 한산하면 기간을 넓혀 채우고, 7일보다 오래된 기록은 빠진다', async () => {
    for (const [i, id] of [A, B].entries()) {
      await putJson(ctx, cookie, `/v1/careers/${id}/seasons/2026`, seasonBody());
      await putJson(ctx, cookie, `/v1/careers/${id}/seasons/2027`, seasonBody({ goals: i }));
    }
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    await ctx.env.DB.prepare(
      'UPDATE career_seasons SET created_at = ? WHERE career_id = ? AND year = 2026',
    )
      .bind(hoursAgo(4), A)
      .run();
    await ctx.env.DB.prepare(
      'UPDATE career_seasons SET created_at = ? WHERE career_id = ? AND year = 2027',
    )
      .bind(hoursAgo(3), A)
      .run();
    await ctx.env.DB.prepare('UPDATE career_seasons SET created_at = ? WHERE career_id = ?')
      .bind(hoursAgo(24 * 8), B)
      .run();
    await ctx.env.DB.prepare('UPDATE careers SET updated_at = ?').bind(hoursAgo(3)).run();

    const data = await read(ctx);
    // 1시간 안엔 없어 24시간·7일로 넓혔다 — 3시간 전 A(최신 시즌 하나)만 남고 8일 전 B는 빠진다.
    expect(data.feed).toHaveLength(1);
    expect(data.feed[0]).toMatchObject({ kind: 'season', goals: 0 });
    expect(data.stats.playing).toBe(0);
  });
});
