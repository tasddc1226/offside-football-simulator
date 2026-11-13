import { DailyRankResponseSchema, successEnvelope } from '@offside/contracts';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { careersByIds, teamPlayerCard } from '../db/repos/ownerTeams.js';
import { careers } from '../db/schema.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';
import { pushText } from '../push/text.js';
import { closeDailyRank, rankDay, resetDailyRankMemo, runDailyRank } from './dailyRank.js';

const Res = successEnvelope(DailyRankResponseSchema);
// 한국 날짜 11-20(금)은 UTC 11-19 15:00 ~ 11-20 15:00.
const DAY = '2026-11-20';
const NOON = '2026-11-20T03:00:00.000Z';
const NEXT = '2026-11-20T15:05:00.000Z';

describe('T-11-723 오늘의 랭킹', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOON));
    resetDailyRankMemo();
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  async function addCareer(
    profileId: string,
    score: number,
    o: {
      retiredAt?: string;
      hidden?: boolean;
      retireAge?: number;
      season?: number;
      name?: string;
    } = {},
  ) {
    const id = crypto.randomUUID();
    const at = o.retiredAt ?? '2026-11-20T01:00:00.000Z';
    await ctx.db.insert(careers).values({
      id,
      profileId,
      pos: 'FW',
      foot: '오른발',
      type: 'poacher',
      trait: 'late',
      startYear: 2026,
      status: 'retired',
      appVersion: '1.0.0',
      createdAt: at,
      updatedAt: at,
      retiredAt: at,
      retireAge: o.retireAge ?? 34,
      peak: 90,
      apps: 300,
      goals: 100,
      assists: 20,
      legendScore: score,
      lastClub: '서울',
      serviceSeason: o.season ?? 2,
      hidden: o.hidden ? 1 : 0,
      publicName: o.name ?? null,
    });
    await ctx.db.run(sql`
      insert into cards (career_id, owner_id, pos, peak, legend_score, service_season, card_value, retire_value, created_at, updated_at)
      values (${id}, ${profileId}, 'FW', 90, ${score}, ${o.season ?? 2}, 1000, 1000, ${at}, ${at})`);
    return id;
  }
  const items = (profileId: string) =>
    ctx.db.all<{ item: string; qty: number }>(
      sql`select item, qty from owner_items where profile_id = ${profileId} order by item`,
    );
  const notes = (profileId: string) =>
    ctx.db.all<{ title: string; body: string }>(
      sql`select title, body from notifications where profile_id = ${profileId} order by created_at`,
    );

  it('오늘 은퇴한 로그인 구단주의 선수만, 구단주마다 가장 높은 한 명을 점수 순으로 준다', async () => {
    const a = await issueGoogleCookie(ctx);
    const b = await issueGoogleCookie(ctx);
    const anon = await issueCookie(ctx);
    const a1 = await addCareer(a.profileId, 900, { name: '에이스' });
    await addCareer(a.profileId, 700);
    const b1 = await addCareer(b.profileId, 900, { retiredAt: '2026-11-20T00:30:00.000Z' });
    // 오르지 않는 선수: 로그인 안 한 구단주 · 숨김 · 은퇴 나이 미달 · 프리시즌 · 어제 은퇴 · 내일 은퇴.
    await addCareer(anon.profileId, 5000);
    const c = await issueGoogleCookie(ctx);
    await addCareer(c.profileId, 4000, { hidden: true });
    await addCareer(c.profileId, 3500, { retireAge: 25 });
    await addCareer(c.profileId, 3000, { season: 0 });
    await addCareer(c.profileId, 2500, { retiredAt: '2026-11-19T14:59:59.000Z' });
    await addCareer(c.profileId, 2000, { retiredAt: '2026-11-20T15:00:00.000Z' });

    // 동점이면 먼저 은퇴한 선수가 앞이다.
    expect((await rankDay(ctx.db, DAY, 50)).map((r) => r.id)).toEqual([b1, a1]);

    const res = await callJson(ctx.env, 'GET', '/v1/hof/daily');
    expect(res.status).toBe(200);
    const body = Res.parse(await res.json()).data;
    expect(body.day).toBe(DAY);
    expect(body.resetAt).toBe('2026-11-20T15:00:00.000Z');
    expect(body.entries.map((e) => e.id)).toEqual([b1, a1]);
    expect(body.entries[1]).toMatchObject({ name: '에이스', legendScore: 900 });
    expect(body.yesterday).toBeNull();
  });

  it('은퇴 시각 인덱스로 그날 은퇴분만 읽는다', async () => {
    const plan = await ctx.db.all<{ detail: string }>(sql`
      explain query plan
      select c.id from careers c indexed by careers_status_retired_idx join profiles p on p.id = c.profile_id
      where c.status = 'retired' and c.retired_at >= 'a' and c.retired_at < 'b'`);
    expect(plan.map((p) => p.detail).join('\n')).toMatch(
      /SEARCH c USING INDEX careers_status_retired_idx \(status=\? AND retired_at>\? AND retired_at<\?\)/,
    );
  });

  it('쿠키가 있어도 세션을 조회하지 않고, 빈 날은 빈 목록을 준다', async () => {
    const who = await issueGoogleCookie(ctx);
    const seen: string[] = [];
    const prepare = ctx.env.DB.prepare.bind(ctx.env.DB);
    const spy = vi.spyOn(ctx.env.DB, 'prepare').mockImplementation((q: string) => {
      seen.push(q);
      return prepare(q);
    });
    const res = await callJson(ctx.env, 'GET', '/v1/hof/daily', { cookie: who.cookie });
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(Res.parse(await res.json()).data).toMatchObject({ entries: [], yesterday: null });
    expect(seen.filter((q) => /"sessions"/.test(q))).toEqual([]);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('자정이 지나면 1 · 2 · 3위에 카드 표식 · 아이템 · 알림을 한 번만 준다', async () => {
    const [a, b, c, d] = await Promise.all([1, 2, 3, 4].map(() => issueGoogleCookie(ctx)));
    const first = await addCareer(a!.profileId, 900);
    const second = await addCareer(b!.profileId, 800);
    const third = await addCareer(c!.profileId, 700);
    const fourth = await addCareer(d!.profileId, 600);

    vi.setSystemTime(new Date(NEXT));
    expect(await runDailyRank(ctx.db, NEXT)).toEqual({ day: DAY, winners: 3 });
    // 같은 아이솔레이트 · 새 아이솔레이트에서 다시 돌려도 더 주지 않는다.
    expect(await runDailyRank(ctx.db, NEXT)).toBeNull();
    resetDailyRankMemo();
    expect(await runDailyRank(ctx.db, '2026-11-20T15:10:00.000Z')).toBeNull();
    expect(await closeDailyRank(ctx.db, DAY, NEXT)).toBeNull();

    expect(
      await ctx.db.all(
        sql`select career_id, rank, reroll, scout from daily_rank_winners order by rank`,
      ),
    ).toEqual([
      { career_id: first, rank: 1, reroll: 1, scout: 1 },
      { career_id: second, rank: 2, reroll: 1, scout: 0 },
      { career_id: third, rank: 3, reroll: 1, scout: 0 },
    ]);
    // 시즌 표식 표에는 넣지 않는다(시즌 결산 목록에 섞이지 않게).
    expect(await ctx.db.all(sql`select career_id from card_specials`)).toEqual([]);
    expect(await items(a!.profileId)).toEqual([
      { item: 'reroll', qty: 1 },
      { item: 'scout', qty: 1 },
    ]);
    expect(await items(b!.profileId)).toEqual([{ item: 'reroll', qty: 1 }]);
    expect(await items(c!.profileId)).toEqual([{ item: 'reroll', qty: 1 }]);
    expect(await items(d!.profileId)).toEqual([]);
    const [note] = await notes(a!.profileId);
    expect(note).toEqual({
      title: '어제 오늘의 랭킹 1위예요',
      body: '은퇴한 선수 카드에 1위 표식이 남았어요. 프리미엄 스카우트권 1장과 선수 후보 리롤권 1장을 받았어요.',
    });
    expect((await notes(a!.profileId)).length).toBe(1);
    expect(await notes(d!.profileId)).toEqual([]);
    // 알림은 요청 언어로 옮겨진다.
    expect(pushText(note!.title, 'en')).toBe('You finished #1 in yesterday’s Daily Ranking');
    expect(pushText(note!.body, 'ja')).toContain('プレミアムスカウト券1枚');

    // 카드 응답에 표식이 실리고, 다음 날 화면은 어제 1 · 2 · 3위를 보여 준다.
    const [row] = await careersByIds(ctx.db, [first]);
    const card = teamPlayerCard(row!);
    expect(card.daily).toBe(1);
    expect(card.specials).toBeUndefined();
    const [plain] = await careersByIds(ctx.db, [fourth]);
    expect(teamPlayerCard(plain!).daily).toBeUndefined();
    const body = Res.parse(await (await callJson(ctx.env, 'GET', '/v1/hof/daily')).json()).data;
    expect(body.day).toBe('2026-11-21');
    expect(body.entries).toEqual([]);
    expect(body.yesterday?.day).toBe(DAY);
    expect(body.yesterday?.winners.map((w) => [w.rank, w.entry.id])).toEqual([
      [1, first],
      [2, second],
      [3, third],
    ]);
  });

  it('같은 주에 이미 아이템을 받은 구단주는 표식만 받고, 주가 바뀌면 다시 받는다', async () => {
    const a = await issueGoogleCookie(ctx);
    // 금요일(11-20) 1위 → 토요일(11-21) 1위 → 다음 주 월요일(11-23) 1위.
    await addCareer(a.profileId, 900);
    await closeDailyRank(ctx.db, '2026-11-20', NEXT);
    const sat = await addCareer(a.profileId, 950, { retiredAt: '2026-11-21T01:00:00.000Z' });
    await closeDailyRank(ctx.db, '2026-11-21', '2026-11-21T15:05:00.000Z');
    expect(await items(a.profileId)).toEqual([
      { item: 'reroll', qty: 1 },
      { item: 'scout', qty: 1 },
    ]);
    expect(
      await ctx.db.all(
        sql`select rank, reroll, scout from daily_rank_winners where career_id = ${sat}`,
      ),
    ).toEqual([{ rank: 1, reroll: 0, scout: 0 }]);
    expect((await notes(a.profileId))[1]?.body).toBe(
      '은퇴한 선수 카드에 1위 표식이 남았어요. 아이템은 한 주에 한 번이라 이번에는 표식만 받았어요.',
    );
    await addCareer(a.profileId, 990, { retiredAt: '2026-11-23T01:00:00.000Z' });
    await closeDailyRank(ctx.db, '2026-11-23', '2026-11-23T15:05:00.000Z');
    expect(await items(a.profileId)).toEqual([
      { item: 'reroll', qty: 2 },
      { item: 'scout', qty: 2 },
    ]);
  });

  it('첫 날(11-14) 전에 은퇴한 선수는 순위에 넣지 않고 굳히지도 않는다', async () => {
    const a = await issueGoogleCookie(ctx);
    await addCareer(a.profileId, 900, { retiredAt: '2026-11-13T01:00:00.000Z' });
    expect(await rankDay(ctx.db, '2026-11-13', 50)).toEqual([]);
    vi.setSystemTime(new Date('2026-11-13T03:00:00.000Z'));
    const body = Res.parse(await (await callJson(ctx.env, 'GET', '/v1/hof/daily')).json()).data;
    expect(body).toMatchObject({ day: '2026-11-13', entries: [], yesterday: null });
    // 11-14 0시가 지나도 11-13은 굳히지 않는다(아이템 · 알림 · 표시 없음).
    expect(await runDailyRank(ctx.db, '2026-11-13T15:05:00.000Z')).toBeNull();
    expect(await ctx.db.all(sql`select key from app_meta where key like 'daily-rank:%'`)).toEqual(
      [],
    );
    expect(await items(a.profileId)).toEqual([]);
    // 첫 날에 은퇴한 선수는 오른다.
    const first = await addCareer(a.profileId, 800, { retiredAt: '2026-11-13T15:30:00.000Z' });
    expect((await rankDay(ctx.db, '2026-11-14', 50)).map((r) => r.id)).toEqual([first]);
  });

  it('오른 선수가 없는 날도 한 번만 세고 표시를 남긴다', async () => {
    expect(await closeDailyRank(ctx.db, DAY, NEXT)).toBe(0);
    expect(await closeDailyRank(ctx.db, DAY, NEXT)).toBeNull();
    expect(await ctx.db.all(sql`select day from daily_rank_winners`)).toEqual([]);
  });
});
