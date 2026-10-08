import {
  HofDetailResponseSchema,
  HofListResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { cards, careers } from '../db/schema.js';
import { ensureCardValuesBackfilled } from '../db/repos/cardValues.js';
import { eq, inArray } from 'drizzle-orm';
import { cardValue, retireValue, valueFor } from '@offside/contracts/market-value';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { issueCookie, putJson, putSeasonsFor, seasonBody } from '../test/http.js';

const CAREER_ID = '3b1d6c1e-2a4f-4f7e-9a0b-7c8d9e0f1a2b';

const summary = {
  retireAge: 34,
  peak: 88,
  legendScore: 420,
  apps: 300,
  goals: 120,
  assists: 60,
  trophies: 1,
  awards: 0,
  caps: 30,
  ballon: 0,
  lastClub: '테스트 FC',
};
const snapshot = {
  number: 7,
  pos: 'FW',
  age: 34,
  peak: 88,
  lastClub: '테스트 FC',
  lastClubId: 'pl-15',
  career: [
    {
      year: 2026,
      age: 18,
      club: '테스트 FC',
      clubId: 'pl-15',
      league: '고교리그',
      apps: 20,
      goals: 10,
      assists: 3,
      cs: 0,
      rating: 7.2,
      rank: 1,
      ovr: 60,
      honors: ['고교리그 우승'],
      ch: ['goals'],
    },
  ],
  trophies: [{ year: 2026, t: '고교리그 우승', club: '테스트 FC', clubId: 'pl-15' }],
  awards: [],
  ballon: [],
  nat: { caps: 30 },
  storyLog: [],
  miles: [{ year: 2026, t: '데뷔' }],
  style: {
    from: 18,
    betOdds: 610,
    bets: 12,
    betWins: 7,
    longshots: 3,
    longshotWins: 1,
    safe: 2,
    sure: 5,
    best: { id: 'derby', p: 0.22 },
    moves: 2,
    tierUp: 2,
    tierDown: 0,
    payFirst: 0,
    loyal: 1,
    snubUp: 0,
  },
};

describe('공개 명예의 전당 /v1/hof', () => {
  let ctx: TestD1;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
    await putSeasonsFor(ctx.env, cookie, CAREER_ID, summary);
  });
  afterEach(async () => {
    await ctx.dispose();
    vi.useRealTimers();
  });

  it('은퇴 잠재력은 저장된 값만 공개하고 진행 중·값 없는 과거 기록은 만들지 않는다', async () => {
    const app = createApp();
    // 조회만으로 진행 커리어의 잠재력이 공개되지 않는다.
    await ctx.db.update(careers).set({ pot: 95, potReal: 84 }).where(eq(careers.id, CAREER_ID));
    expect((await app.request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).status).toBe(404);
    const active = successEnvelope(HofListResponseSchema).parse(
      await (await app.request('/v1/hof', {}, ctx.env)).json(),
    ).data;
    expect(active.entries).toHaveLength(0);
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
      ...summary,
      snapshot,
      potReal: 84,
    });
    const detail = successEnvelope(HofDetailResponseSchema).parse(
      await (await app.request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).json(),
    ).data;
    expect(detail.entry.potReal).toBe(84);
    expect(detail.entry).not.toHaveProperty('pot');
    await ctx.db.update(careers).set({ potReal: null }).where(eq(careers.id, CAREER_ID));
    const old = successEnvelope(HofDetailResponseSchema).parse(
      await (await app.request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).json(),
    ).data;
    expect(old.entry).not.toHaveProperty('potReal');
    expect(old.entry.peak).toBe(detail.entry.peak);
  });

  it('로그인 없이 목록을 읽고, 이름은 공개를 고르기 전엔 익명이다', async () => {
    expect(
      (
        await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
          ...summary,
          lastClubId: 'pl-15',
          publicName: null,
          snapshot,
        })
      ).status,
    ).toBe(200);
    const res = await createApp().request('/v1/hof', {}, ctx.env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age');
    const { entries } = successEnvelope(HofListResponseSchema).parse(await res.json()).data;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: CAREER_ID,
      name: null,
      number: 7,
      legendScore: 420,
      hasDetail: true,
      lastClubId: 'pl-15',
    });
  });

  it('다시 PUT하면 이름 공개로 바뀌고 최초 은퇴 시각은 유지된다', async () => {
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
      ...summary,
      publicName: null,
      snapshot,
    });
    const first = successEnvelope(HofDetailResponseSchema).parse(
      await (await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).json(),
    ).data;
    expect(
      (
        await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
          ...summary,
          publicName: '  김오프  ',
        })
      ).status,
    ).toBe(200);
    const res = await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env);
    const detail = successEnvelope(HofDetailResponseSchema).parse(await res.json()).data;
    expect(detail.entry.name).toBe('김오프');
    expect(detail.entry.retiredAt).toBe(first.entry.retiredAt);
    // 스냅샷을 빼고 보내도 기존 상세는 지워지지 않는다.
    expect(detail.snapshot?.career[0]?.honors).toEqual(['고교리그 우승']);
    // T-10-066 스냅샷의 클럽 id도 그대로 돌아온다.
    expect(detail.snapshot?.career[0]?.clubId).toBe('pl-15');
    expect(detail.snapshot?.trophies[0]?.clubId).toBe('pl-15');
    // T-10-077 플레이 성향도 그대로 돌아온다.
    expect(detail.snapshot?.style).toEqual(snapshot.style);
  });

  it('옛 클라이언트 본문(이름·스냅샷 없음)도 목록에 익명·상세 없음으로 나온다', async () => {
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, summary);
    const { entries } = successEnvelope(HofListResponseSchema).parse(
      await (await createApp().request('/v1/hof', {}, ctx.env)).json(),
    ).data;
    expect(entries[0]).toMatchObject({
      name: null,
      number: null,
      hasDetail: false,
      lastClubId: null,
    });
  });

  it('대표 칭호와 획득 칭호를 저장하고, 칭호 없이 다시 보내도 지우지 않는다 (T-10-026)', async () => {
    const titles = [
      { id: 'goals100', year: 2034 },
      { id: 'debut', year: 0 },
    ];
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
      ...summary,
      title: 'goals100',
      publicName: null,
      snapshot: { ...snapshot, titles },
    });
    const list = successEnvelope(HofListResponseSchema).parse(
      await (await createApp().request('/v1/hof', {}, ctx.env)).json(),
    ).data;
    expect(list.entries[0]?.title).toBe('goals100');
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
      ...summary,
      publicName: '김오프',
    });
    const detail = successEnvelope(HofDetailResponseSchema).parse(
      await (await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).json(),
    ).data;
    expect(detail.entry.title).toBe('goals100');
    expect(detail.snapshot?.titles).toEqual(titles);
    expect(
      (
        await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
          ...summary,
          title: '<b>칭호</b>',
        })
      ).status,
    ).toBe(400);
  });

  it('은퇴 뒤에도 받은 칭호 중에서만 대표 칭호를 바꾼다', async () => {
    const titles = [
      { id: 'goals100', year: 2034 },
      { id: 'debut', year: 0 },
    ];
    const put = (title: string) =>
      putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
        ...summary,
        title,
        publicName: null,
        snapshot: { ...snapshot, titles },
      });
    const titleNow = async () =>
      successEnvelope(HofDetailResponseSchema).parse(
        await (await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).json(),
      ).data.entry.title;
    await put('goals100');
    expect((await put('debut')).status).toBe(200);
    expect(await titleNow()).toBe('debut');
    // 받지 않은 칭호는 무시한다(요청은 성공 — 업로드 큐가 버리지 않게).
    expect((await put('ballon1')).status).toBe(200);
    expect(await titleNow()).toBe('debut');
  });

  it('칭호 없이 은퇴한 옛 기록은 title이 null이다', async () => {
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, summary);
    const { entries } = successEnvelope(HofListResponseSchema).parse(
      await (await createApp().request('/v1/hof', {}, ctx.env)).json(),
    ).data;
    expect(entries[0]?.title).toBeNull();
  });

  it('30세 전에 은퇴한 짧은 커리어는 목록·상세(공유 링크)에 오르지 않는다 (T-10-032)', async () => {
    const SHORT = '0c000000-0000-4000-8000-000000000001';
    await putSeasonsFor(ctx.env, cookie, SHORT, { ...summary, retireAge: 29 });
    await putJson(ctx, cookie, `/v1/careers/${SHORT}/retirement`, {
      ...summary,
      retireAge: 29,
      publicName: null,
      snapshot,
    });
    expect((await createApp().request(`/v1/hof/${SHORT}`, {}, ctx.env)).status).toBe(404);
    const list = successEnvelope(HofListResponseSchema).parse(
      await (await createApp().request('/v1/hof', {}, ctx.env)).json(),
    ).data;
    expect(list).toEqual({ entries: [], total: 0 });
    // 은퇴 나이는 받아 둔 시즌이 정한다 — 30세라고 보내도 29세에 은퇴한 기록이다.
    const LIED = '0c000000-0000-4000-8000-000000000002';
    await putSeasonsFor(ctx.env, cookie, LIED, { ...summary, retireAge: 29 });
    await putJson(ctx, cookie, `/v1/careers/${LIED}/retirement`, { ...summary, retireAge: 34 });
    expect((await createApp().request(`/v1/hof/${LIED}`, {}, ctx.env)).status).toBe(404);
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
      ...summary,
      retireAge: 30,
      publicName: null,
      snapshot,
    });
    expect((await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).status).toBe(200);
  });

  it('은퇴하지 않은 커리어·없는 ID는 404', async () => {
    expect((await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).status).toBe(404);
    const { entries } = successEnvelope(HofListResponseSchema).parse(
      await (await createApp().request('/v1/hof', {}, ctx.env)).json(),
    ).data;
    expect(entries).toHaveLength(0);
  });

  it('page·limit으로 레전드 점수 순 페이지를 나눠 읽고 전체 인원을 준다', async () => {
    const ids = [
      '0a000000-0000-4000-8000-000000000001',
      '0a000000-0000-4000-8000-000000000002',
      '0a000000-0000-4000-8000-000000000003',
    ];
    for (const [i, id] of ids.entries()) {
      await putSeasonsFor(ctx.env, cookie, id, summary);
      await putJson(ctx, cookie, `/v1/careers/${id}/retirement`, {
        ...summary,
        legendScore: 100 * (i + 1),
      });
    }
    const read = async (q: string) =>
      successEnvelope(HofListResponseSchema).parse(
        await (await createApp().request(`/v1/hof?${q}`, {}, ctx.env)).json(),
      ).data;
    const p1 = await read('limit=2');
    expect(p1.total).toBe(3);
    expect(p1.entries.map((e) => e.legendScore)).toEqual([300, 200]);
    const p2 = await read('limit=2&page=2');
    expect(p2.entries.map((e) => e.legendScore)).toEqual([100]);
    expect((await createApp().request('/v1/hof?page=0', {}, ctx.env)).status).toBe(400);
  });

  it('T-10-090: season=1은 개막 뒤 처음 올라온 커리어만 보여 준다(프리시즌 선수 제외)', async () => {
    const [pre, s1] = [
      '0b000000-0000-4000-8000-000000000001',
      '0b000000-0000-4000-8000-000000000002',
    ];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T14:59:00.000Z')); // 개막 1분 전(KST 10/5 23:59)
    await putSeasonsFor(ctx.env, cookie, pre, summary);
    vi.setSystemTime(new Date('2026-10-05T15:00:00.000Z')); // 개막
    await putSeasonsFor(ctx.env, cookie, s1, summary);
    // 프리시즌 선수가 시즌 중에 은퇴해도 시즌 순위에는 오르지 않는다.
    vi.setSystemTime(new Date('2026-10-20T00:00:00.000Z'));
    for (const id of [pre, s1]) await putJson(ctx, cookie, `/v1/careers/${id}/retirement`, summary);

    const read = async (q: string) => {
      const res = await createApp().request(`/v1/hof?${q}`, {}, ctx.env);
      return successEnvelope(HofListResponseSchema).parse(await res.json()).data;
    };
    expect((await read('')).entries.map((e) => e.id).sort()).toEqual([pre, s1]);
    const season = await read('season=1');
    expect(season.total).toBe(1);
    expect(season.entries.map((e) => e.id)).toEqual([s1]);
    // T-11-029 season=0은 프리시즌 — 개막 뒤에 은퇴한 프리시즌 선수는 여기 오르고 시즌 1 선수는 빠진다.
    const preseason = await read('season=0');
    expect(preseason.total).toBe(1);
    expect(preseason.entries.map((e) => e.id)).toEqual([pre]);
    expect((await createApp().request('/v1/hof?season=9', {}, ctx.env)).status).toBe(400);
    // 시즌 번호는 처음 올라온 시각으로 한 번 정해져 컬럼에 남는다(시즌 기간을 고쳐도 소급하지 않는다).
    const stamped = await ctx.db
      .select({ id: careers.id, s: careers.serviceSeason })
      .from(careers)
      .where(inArray(careers.id, [pre, s1]));
    expect(Object.fromEntries(stamped.map((r) => [r.id, r.s]))).toEqual({ [pre]: 0, [s1]: 1 });
  });

  it('sort로 기록별 순위를 매기고, 그 기록이 0인 선수는 뺀다', async () => {
    const rows = [
      {
        id: '0b000000-0000-4000-8000-000000000001',
        legendScore: 300,
        goals: 50,
        assists: 5,
        ballon: 0,
      },
      {
        id: '0b000000-0000-4000-8000-000000000002',
        legendScore: 200,
        goals: 200,
        assists: 0,
        ballon: 2,
      },
      {
        id: '0b000000-0000-4000-8000-000000000003',
        legendScore: 100,
        goals: 10,
        assists: 90,
        ballon: 1,
      },
    ];
    for (const { id, ...s } of rows) {
      await putSeasonsFor(ctx.env, cookie, id, { ...summary, ...s });
      await putJson(ctx, cookie, `/v1/careers/${id}/retirement`, { ...summary, ...s });
    }
    const read = async (q: string) =>
      successEnvelope(HofListResponseSchema).parse(
        await (await createApp().request(`/v1/hof?${q}`, {}, ctx.env)).json(),
      ).data;
    expect((await read('sort=goals')).entries.map((e) => e.goals)).toEqual([200, 50, 10]);
    expect((await read('sort=ga')).entries.map((e) => e.legendScore)).toEqual([200, 100, 300]);
    const ballon = await read('sort=ballon');
    expect(ballon.total).toBe(2);
    expect(ballon.entries.map((e) => e.ballon)).toEqual([2, 1]);
    expect((await createApp().request('/v1/hof?sort=name', {}, ctx.env)).status).toBe(400);
  });

  it('T-11-018: pos로 그 포지션 선수만 순위를 매긴다(검색 순위도 포지션 안에서)', async () => {
    const rows = [
      { id: '0d000000-0000-4000-8000-000000000001', legendScore: 900, pos: 'FW' },
      { id: '0d000000-0000-4000-8000-000000000002', legendScore: 500, pos: 'DF' },
      { id: '0d000000-0000-4000-8000-000000000003', legendScore: 400, pos: 'DF' },
      { id: '0d000000-0000-4000-8000-000000000004', legendScore: 300, pos: 'GK' },
    ] as const;
    for (const { id, legendScore, pos } of rows) {
      await putSeasonsFor(ctx.env, cookie, id, summary);
      await putJson(ctx, cookie, `/v1/careers/${id}/retirement`, {
        ...summary,
        legendScore,
        publicName: `선수${legendScore}`,
      });
      await ctx.db.update(careers).set({ pos }).where(eq(careers.id, id));
    }
    const read = async (q: string) =>
      successEnvelope(HofListResponseSchema).parse(
        await (await createApp().request(`/v1/hof?${q}`, {}, ctx.env)).json(),
      ).data;
    const df = await read('pos=DF');
    expect(df.total).toBe(2);
    expect(df.entries.map((e) => e.legendScore)).toEqual([500, 400]);
    expect((await read('pos=GK')).entries.map((e) => e.pos)).toEqual(['GK']);
    expect((await read('pos=MF')).total).toBe(0);
    expect((await read('')).total).toBe(4);
    // 검색 결과의 순위도 고른 포지션 안에서 센다.
    expect((await read('pos=DF&q=선수400')).entries.map((e) => e.rank)).toEqual([2]);
    expect((await createApp().request('/v1/hof?pos=ST', {}, ctx.env)).status).toBe(400);
  });

  // Four complete retirement uploads precede search checks; allow slower fixture
  // D1 RPC under parallel runs without relaxing any search/rank assertions.
  it('T-10-101: q로 공개 이름을 찾고, 찾은 선수에 검색 전 순위를 붙인다', async () => {
    const rows = [
      {
        id: '0c000000-0000-4000-8000-000000000001',
        legendScore: 400,
        goals: 10,
        publicName: '김오프',
      },
      {
        id: '0c000000-0000-4000-8000-000000000002',
        legendScore: 300,
        goals: 90,
        publicName: '박사이드',
      },
      {
        id: '0c000000-0000-4000-8000-000000000003',
        legendScore: 200,
        goals: 50,
        publicName: '오프_100%',
      },
      { id: '0c000000-0000-4000-8000-000000000004', legendScore: 100, goals: 70, publicName: null },
    ];
    for (const { id, publicName, ...s } of rows) {
      await putSeasonsFor(ctx.env, cookie, id, { ...summary, ...s });
      await putJson(ctx, cookie, `/v1/careers/${id}/retirement`, { ...summary, ...s, publicName });
    }
    const read = async (q: string) =>
      successEnvelope(HofListResponseSchema).parse(
        await (await createApp().request(`/v1/hof?${q}`, {}, ctx.env)).json(),
      ).data;
    const pick = (d: Awaited<ReturnType<typeof read>>) => d.entries.map((e) => [e.name, e.rank]);

    const off = await read(`q=${encodeURIComponent('오프')}`);
    expect(off.total).toBe(2);
    expect(pick(off)).toEqual([
      ['김오프', 1],
      ['오프_100%', 3],
    ]);
    // 순위는 고른 유형 기준(득점 순이면 박사이드 90 · 익명 70 · 오프_100% 50 · 김오프 10).
    expect(pick(await read(`sort=goals&q=${encodeURIComponent('오프')}`))).toEqual([
      ['오프_100%', 3],
      ['김오프', 4],
    ]);
    // LIKE 특수 문자는 글자 그대로 찾는다.
    expect(pick(await read(`q=${encodeURIComponent('_1')}`))).toEqual([['오프_100%', 3]]);
    expect((await read(`q=${encodeURIComponent('%')}`)).total).toBe(1);
    // 한 페이지를 나눠도 순위는 그대로, 빈 검색어는 전체 목록.
    expect(pick(await read(`limit=1&page=2&q=${encodeURIComponent('오프')}`))).toEqual([
      ['오프_100%', 3],
    ]);
    const blank = await read('q=%20');
    expect(blank.total).toBe(4);
    expect(blank.entries.every((e) => e.rank === undefined)).toBe(true);
    expect((await createApp().request(`/v1/hof?q=${'가'.repeat(21)}`, {}, ctx.env)).status).toBe(
      400,
    );
  }, 60_000);

  it('공개 목록은 쿠키가 있어도 세션·프로필을 읽지 않는다(T-10-015)', async () => {
    const { DB, seen } = spyDb(ctx.env.DB);
    const res = await createApp().request(
      '/v1/hof',
      { headers: { Cookie: cookie } },
      { ...ctx.env, DB },
    );
    expect(res.status).toBe(200);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((q) => /"sessions"|"profiles"/.test(q))).toEqual([]);
  });

  it('링크·욕설이 든 공개 이름은 거절한다', async () => {
    const res = await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
      ...summary,
      publicName: 'www.spam.com',
    });
    expect(res.status).toBe(400);
  });

  // T-10-081 T-10-066 이전 은퇴(구단 id 없음) 중 유저가 이름을 바꾼 구단은 그 유저의 구단 꾸미기로 id를 되찾는다.
  it('구단 id 없는 옛 기록은 올린 유저가 바꾼 구단 이름으로 id를 채운다', async () => {
    const renamed = '버밍엄 시티';
    await putJson(ctx, cookie, '/v1/club-custom', {
      clubs: {
        'pl-7': { name: renamed },
        'pl-3': { name: '겹친 이름' },
        'pl-4': { name: '겹친 이름' },
      },
      updatedAt: '2026-09-25T00:00:00.000Z',
    });
    await putJson(
      ctx,
      cookie,
      `/v1/careers/${CAREER_ID}/seasons/2027`,
      seasonBody({ age: 19, club: renamed, league: '프리미어리그' }),
    );
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
      ...summary,
      lastClub: renamed,
      publicName: null,
      snapshot: {
        ...snapshot,
        // 옛 클라이언트: 구단 id 없이 이름만(JSON으로 가면 undefined는 빠진다).
        lastClubId: undefined,
        lastClub: renamed,
        career: [
          { ...snapshot.career[0]!, clubId: undefined },
          { ...snapshot.career[0]!, year: 2027, club: renamed, clubId: undefined },
        ],
        trophies: [{ year: 2027, t: '리그 우승', club: renamed }],
      },
    });

    const list = successEnvelope(HofListResponseSchema).parse(
      await (await createApp().request('/v1/hof', {}, ctx.env)).json(),
    ).data;
    expect(list.entries[0]?.lastClubId).toBe('pl-7');
    const detail = successEnvelope(HofDetailResponseSchema).parse(
      await (await createApp().request(`/v1/hof/${CAREER_ID}`, {}, ctx.env)).json(),
    ).data;
    expect(detail.snapshot?.lastClubId).toBe('pl-7');
    // 바꾸지 않은 이름('테스트 FC')은 웹이 이름으로 찾으므로 그대로 둔다.
    expect(detail.snapshot?.career.map((r) => r.clubId)).toEqual([undefined, 'pl-7']);
    expect(detail.snapshot?.trophies[0]?.clubId).toBe('pl-7');
    const seasons = await ctx.env.DB.prepare(
      'select club, club_id as clubId from career_seasons where career_id = ? and year <= 2027 order by year',
    )
      .bind(CAREER_ID)
      .all();
    expect(seasons.results).toEqual([
      { club: '테스트 고교', clubId: null },
      { club: renamed, clubId: 'pl-7' },
    ]);
    // 한 번 끝나면 다시 훑지 않는다.
    const meta = await ctx.env.DB.prepare(
      "select value from app_meta where key = 'club_ids_backfill'",
    ).first();
    expect(meta).toEqual({ value: '1' });
  });
  it('T-10-100: 은퇴 가치를 스냅샷으로 매기고 가치 순으로 정렬한다(옛 기록은 리그 이름으로, 스냅샷 없으면 빠진다)', async () => {
    const pro = (ovr: number, age: number, league: string) => ({
      ...snapshot.career[0]!,
      league,
      clubId: undefined,
      ovr,
      age,
    });
    const rows = [
      {
        id: '0c000000-0000-4000-8000-000000000001',
        legendScore: 300,
        career: [pro(80, 26, '라리가')],
      },
      {
        id: '0c000000-0000-4000-8000-000000000002',
        legendScore: 900,
        career: [pro(90, 25, '프리미어리그'), pro(88, 27, '프리미어리그')],
      },
      { id: '0c000000-0000-4000-8000-000000000003', legendScore: 500, career: null }, // 옛 클라이언트: 스냅샷 없음
    ];
    for (const { id, legendScore, career } of rows) {
      await putSeasonsFor(ctx.env, cookie, id, summary);
      await putJson(ctx, cookie, `/v1/careers/${id}/retirement`, {
        ...summary,
        legendScore,
        ...(career ? { publicName: null, snapshot: { ...snapshot, career } } : {}),
      });
    }
    const read = async (q: string) =>
      successEnvelope(HofListResponseSchema).parse(
        await (await createApp().request(`/v1/hof?${q}`, {}, ctx.env)).json(),
      ).data;
    const list = await read('sort=value');
    expect(list.entries.map((e) => e.id)).toEqual([rows[1]!.id, rows[0]!.id]);
    expect(list.entries[1]!.value).toBe(retireValue(rows[0]!.career!, 300));
    expect(list.entries[1]!.value).toBe(
      Math.round(((valueFor('ll', 80, 26) / 3) * (1 + 300 / 250)) / 1000) * 1000,
    );
    // 스냅샷 없는 기록은 소급해도 0 — 가치 순에서 빠지고, 레전드 점수 순에는 남는다.
    expect((await read('sort=score')).entries.find((e) => e.id === rows[2]!.id)?.value).toBe(0);
  });

  it('T-11-080: 은퇴하면 카드가 한 장 생기고, 기존 카드의 기준가는 명예의 전당 조회 때 스냅샷으로 소급한다', async () => {
    const pro = (ovr: number, age: number) => ({ ...snapshot.career[0]!, ovr, age });
    const rows = [
      { id: '0c000000-0000-4000-8000-000000000011', career: [pro(summary.peak, 31)] },
      { id: '0c000000-0000-4000-8000-000000000012', career: null }, // 스냅샷 없음
      { id: '0c000000-0000-4000-8000-000000000013', career: [pro(summary.peak, 24)] },
    ];
    for (const { id, career } of rows) {
      await putSeasonsFor(ctx.env, cookie, id, summary);
      await putJson(ctx, cookie, `/v1/careers/${id}/retirement`, {
        ...summary,
        ...(career ? { publicName: null, snapshot: { ...snapshot, career } } : {}),
      });
    }
    const cardRows = () =>
      ctx.db
        .select({ id: cards.careerId, cardValue: cards.cardValue, retireValue: cards.retireValue })
        .from(cards)
        .where(
          inArray(
            cards.careerId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(cards.careerId);
    const want = rows.map(({ id, career }) => ({
      id,
      cardValue: career ? cardValue(career, summary.peak) : null,
      retireValue: career ? retireValue(career, summary.legendScore) : 0,
    }));
    expect(await cardRows()).toEqual(want);
    // 다시 보낸 은퇴는 카드를 늘리지 않는다.
    await putJson(ctx, cookie, `/v1/careers/${rows[0]!.id}/retirement`, { ...summary });
    expect(await cardRows()).toHaveLength(3);

    // 마이그레이션이 만든 기존 카드: 기준가 null·은퇴 가치 0. 스냅샷 있는 카드만 한 장씩 채운다(없는 카드는 null로 남는다).
    await ctx.db.update(cards).set({ cardValue: null, retireValue: 0 });
    for (let i = 0; i < 2; i++) expect(await ensureCardValuesBackfilled(ctx.db, 1)).toBe(true);
    expect(await ensureCardValuesBackfilled(ctx.db, 1)).toBe(true); // 빈 조각 → 끝 표시
    expect(await ensureCardValuesBackfilled(ctx.db, 1)).toBe(false);
    expect(await cardRows()).toEqual(want);
  });

  it('T-10-100: 이 기능 전 은퇴 기록(value 없음)은 명예의 전당 조회 때 스냅샷으로 소급한다', async () => {
    await putJson(ctx, cookie, `/v1/careers/${CAREER_ID}/retirement`, {
      ...summary,
      publicName: null,
      snapshot: {
        ...snapshot,
        career: [{ ...snapshot.career[0]!, league: 'K리그1', clubId: undefined, ovr: 75, age: 23 }],
      },
    });
    await ctx.env.DB.prepare('update careers set value = null').run();
    const list = successEnvelope(HofListResponseSchema).parse(
      await (await createApp().request('/v1/hof?sort=value', {}, ctx.env)).json(),
    ).data;
    expect(list.entries[0]?.value).toBe(
      Math.round(((valueFor('k1', 75, 23) / 3) * (1 + 420 / 250)) / 1000) * 1000,
    );
    const meta = await ctx.env.DB.prepare(
      "select value from app_meta where key = 'career_values_backfill'",
    ).first();
    expect(meta).toEqual({ value: '1' });
  });
});
