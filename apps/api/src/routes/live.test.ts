import { readFileSync } from 'node:fs';
import { LiveResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { issueCookie, putJson, RETIREMENT as summary, seasonBody } from '../test/http.js';

const A = '0c000000-0000-4000-8000-00000000000a';
const B = '0c000000-0000-4000-8000-00000000000b';
const C = '0c000000-0000-4000-8000-00000000000c';

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
      seasonBody({ club: '테스트 FC', clubId: 'pl-15', league: 'K리그1', goals: 21 }),
    );
    await putJson(
      ctx,
      cookie,
      `/v1/careers/${C}/seasons/2026`,
      seasonBody({ honors: ['고교리그 우승', '득점왕'] }),
    );
    await putJson(ctx, cookie, `/v1/careers/${A}/retirement`, { ...summary, lastClubId: 'pl-15' });

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
      lastClubId: 'pl-15',
    });
    expect(data.feed[1]).toMatchObject({
      kind: 'season',
      club: '테스트 고교',
      clubId: null,
      first: true,
      honor: '고교리그 우승',
    });
    expect(data.feed[2]).toMatchObject({
      kind: 'season',
      club: '테스트 FC',
      clubId: 'pl-15',
      goals: 21,
      first: false,
      honor: null,
    });
    // 진행 중 커리어는 식별자를 내보내지 않는다.
    expect(data.feed.filter((e) => e.kind === 'season').every((e) => !('careerId' in e))).toBe(
      true,
    );
  });

  it('진행 중 커리어는 시즌에 실어 보낸 공개 이름으로 보이고, 끄면 익명·안 보내면 그대로다 (T-10-065)', async () => {
    // undefined 키는 JSON에서 빠진다 = 이름을 보내지 않는 옛 클라이언트.
    const put = (id: string, year: number, publicName?: string | null) =>
      putJson(ctx, cookie, `/v1/careers/${id}/seasons/${year}`, { ...seasonBody(), publicName });
    await put(A, 2026, '도하람');
    await put(B, 2026, '시발 FC'); // 욕설은 시즌을 버리지 않고 익명으로만 남긴다
    expect((await read(ctx)).feed.map((e) => e.name)).toEqual(
      expect.arrayContaining(['도하람', null]),
    );
    await put(A, 2027); // 옛 클라이언트: 이름을 건드리지 않는다
    expect((await read(ctx)).feed.map((e) => e.name)).toContain('도하람');
    await put(A, 2028, null); // 이름 공개를 끔
    expect((await read(ctx)).feed.map((e) => e.name)).toEqual([null, null]);
    // 은퇴 뒤에는 명예의 전당 토글(은퇴 PUT)만 이름을 바꾼다 — 늦게 온 시즌 업로드가 되돌리지 않는다.
    await putJson(ctx, cookie, `/v1/careers/${A}/retirement`, summary);
    await put(A, 2029, '도하람');
    expect((await read(ctx)).feed.find((e) => e.kind === 'retire')?.name).toBeNull();
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

  it('지난 시즌을 다시 보내도 피드엔 그 선수의 마지막 시즌이 남는다', async () => {
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2026`, seasonBody({ goals: 1 }));
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2027`, seasonBody({ goals: 2 }));
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2026`, seasonBody({ goals: 1 }));
    const data = await read(ctx);
    expect(data.feed).toHaveLength(1);
    expect(data.feed[0]).toMatchObject({ kind: 'season', goals: 2, first: false });
    expect(data.stats).toMatchObject({ seasonsToday: 2, newToday: 1 });
  });

  it('은퇴를 다시 보내도(이름 공개 토글) 오늘 은퇴 수는 한 번만 센다 (T-10-055)', async () => {
    await putJson(ctx, cookie, `/v1/careers/${A}/seasons/2026`, seasonBody());
    await putJson(ctx, cookie, `/v1/careers/${B}/seasons/2026`, seasonBody());
    await putJson(ctx, cookie, `/v1/careers/${A}/retirement`, summary);
    await putJson(ctx, cookie, `/v1/careers/${A}/retirement`, { ...summary, publicName: '도하람' });
    expect((await read(ctx)).stats.retiredToday).toBe(1);
    await putJson(ctx, cookie, `/v1/careers/${B}/retirement`, summary);
    expect((await read(ctx)).stats.retiredToday).toBe(2);
  });

  it('migration 0027이 지금까지의 은퇴를 한국 시각 날짜별로 채운다', async () => {
    for (const id of [A, B, C]) {
      await putJson(ctx, cookie, `/v1/careers/${id}/seasons/2026`, seasonBody());
      await putJson(ctx, cookie, `/v1/careers/${id}/retirement`, summary);
    }
    // C는 사흘 전 은퇴로 옮기고, 카운터를 비운 뒤 migration만으로 다시 채운다.
    await ctx.env.DB.prepare('UPDATE careers SET retired_at = ? WHERE id = ?')
      .bind(new Date(Date.now() - 72 * 3_600_000).toISOString(), C)
      .run();
    await ctx.env.DB.prepare("DELETE FROM app_meta WHERE key LIKE 'retired:%'").run();
    const sql = readFileSync(
      new URL('../../migrations/0027_retired_daily_count.sql', import.meta.url),
      'utf8',
    );
    await ctx.env.DB.exec(sql.replace(/\s+/g, ' ').trim());
    expect((await read(ctx)).stats.retiredToday).toBe(2);
    const rows = await ctx.env.DB.prepare(
      "SELECT value FROM app_meta WHERE key LIKE 'retired:%' ORDER BY key",
    ).all<{ value: string }>();
    expect(rows.results.map((r) => Number(r.value))).toEqual([1, 2]);
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
