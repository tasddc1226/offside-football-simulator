import {
  ErrorEnvelopeSchema,
  LeagueNewsResponseSchema,
  LeaguePredictionCountsSchema,
  LeaguePredictionMeResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { planLeague } from '@offside/contracts/league';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cards, careers, leagueMatches } from '../db/schema.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueGoogleCookie } from '../test/http.js';
import { cupText } from '../cupText.js';
import { runLeague } from './league.js';
import { pushHeadline } from './leagueNews.js';

// T-11-652 오프사이드 데일리(라운드 신문) · 빅매치 예측 API.

const S2 = '2026-10-30T15:00:00.000Z';
const S3 = '2026-11-18T15:00:00.000Z';
const L = planLeague(2, S2, S3);
const OPEN = '2026-11-01T03:00:00.000Z';
const at = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();
const DAY_END = 8 * 3_600_000;
let seq = 0;

const NewsRes = successEnvelope(LeagueNewsResponseSchema);
const CountsRes = successEnvelope(LeaguePredictionCountsSchema);
const PredMeRes = successEnvelope(LeaguePredictionMeResponseSchema);

describe('오프사이드 데일리 (T-11-652)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(OPEN));
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(1, S2, false));
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(2, S3, false));
  });
  afterEach(async () => {
    vi.useRealTimers();
    applySeasonSchedule([]);
    forgetSeasonSchedule();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson({ ...ctx.env, ADMIN_EMAILS: ADMIN_EMAIL }, method, path, opts);
  const db = () => ctx.db;
  const run = (now: string) => runLeague(db(), now);
  /** 끝날 때까지(null) cron을 돌린다. */
  const drain = async (now: string) => {
    const steps: unknown[] = [];
    for (let i = 0; i < 50; i++) {
      const r = await run(now);
      if (!r) break;
      steps.push(r);
    }
    return steps;
  };
  const news = async (round: number) => {
    const res = await call('GET', `/v1/leagues/2/news/${round}`);
    return res.status === 200 ? NewsRes.parse(await res.json()).data : res.status;
  };
  const predict = (cookie: string, matchId: string, pick: string) =>
    call('PUT', `/v1/leagues/2/matches/${matchId}/prediction`, { cookie, body: { pick } });

  /** 시즌 2 카드 n장(OVR peak)으로 선발을 채우고 리그에 신청한 구단주. */
  async function entrant(n: number, peak = 80, enter = true) {
    const who = await issueGoogleCookie(ctx, { nickname: `리그${++seq}` });
    const ids: string[] = [];
    const t = '2026-10-31T00:00:00.000Z';
    for (let i = 0; i < n; i++) {
      const id = crypto.randomUUID();
      await ctx.db.insert(careers).values({
        id,
        profileId: who.profileId,
        pos: 'FW',
        foot: '오른발',
        type: 'poacher',
        trait: 'late',
        startYear: 2026,
        status: 'retired',
        appVersion: '1.0.0',
        createdAt: t,
        updatedAt: t,
        retiredAt: t,
        retireAge: 34,
        peak,
        legendScore: 300,
        shirtNumber: 9,
        serviceSeason: 2,
      });
      await ctx.db.insert(cards).values({
        careerId: id,
        ownerId: who.profileId,
        serviceSeason: 2,
        pos: 'FW',
        number: 9,
        peak,
        legendScore: 300,
        retireValue: 0,
        createdAt: t,
        updatedAt: t,
      });
      ids.push(id);
    }
    const body = {
      name: `리그팀${seq}`,
      manager: '김감독',
      formation: '4-3-3',
      slots: [...ids, ...Array(11 - n).fill(null)],
    };
    if (n)
      expect((await call('PUT', '/v1/owner-team', { cookie: who.cookie, body })).status).toBe(200);
    if (enter)
      expect(
        (
          await call('POST', '/v1/leagues/current/entries', {
            cookie: who.cookie,
            headers: { 'Idempotency-Key': `lg-${++seq}-key` },
          })
        ).status,
      ).toBe(204);
    return { ...who, body };
  }

  it('배치 전에는 신문이 없고, 배치 뒤 0라운드는 1라운드 빅매치만, 끝난 라운드는 기사 · 지난 빅매치 결과 · 다음 빅매치', async () => {
    // 1부: OVR이 높은 4팀과 낮은 4팀. 2부 7팀.
    const top = [];
    for (let i = 0; i < 4; i++) top.push(await entrant(8, 95));
    for (let i = 0; i < 4; i++) top.push(await entrant(8, 84));
    for (let i = 0; i < 7; i++) await entrant(8, 70);
    expect(await news(0)).toBe(404);

    await drain(L.drawAt);
    vi.setSystemTime(new Date(at(L.drawAt, 600_000)));
    const n0 = await news(0);
    if (typeof n0 === 'number') throw new Error(`news 0: ${n0}`);
    expect(n0.items).toEqual([]);
    expect(n0.lastBig).toBeNull();
    expect(n0.bigMatch).toMatchObject({ tier: 1, league: 1, round: 1 });
    // 아직 치르지 않은 라운드는 신문이 없다.
    expect(await news(1)).toBe(404);

    // 빅매치 예측: 경기 전까지 고르고 바꿀 수 있다. 수는 누구나 본다.
    const big = n0.bigMatch!;
    const [a, b] = top;
    expect((await predict(a!.cookie, big.id, 'home')).status).toBe(200);
    expect((await predict(a!.cookie, big.id, 'away')).status).toBe(200);
    const res = await predict(b!.cookie, big.id, 'away');
    expect(CountsRes.parse(await res.json()).data).toEqual({
      matchId: big.id,
      home: 0,
      draw: 0,
      away: 2,
    });
    expect(
      CountsRes.parse(
        await (await call('GET', `/v1/leagues/2/matches/${big.id}/predictions`)).json(),
      ).data,
    ).toMatchObject({ away: 2 });
    expect((await predict(a!.cookie, big.id, 'win')).status).toBe(400);
    // 로그인하지 않으면 예측할 수 없다.
    expect(
      (await call('PUT', `/v1/leagues/2/matches/${big.id}/prediction`, { body: { pick: 'home' } }))
        .status,
    ).toBe(401);

    // 1라운드를 치르고 나면 마감이다.
    await drain(at(L.rounds[0]!, DAY_END));
    vi.setSystemTime(new Date(at(L.rounds[0]!, DAY_END + 600_000)));
    const closed = await predict(a!.cookie, big.id, 'home');
    expect(closed.status).toBe(409);
    expect(ErrorEnvelopeSchema.parse(await closed.json()).error.details).toMatchObject({
      reason: 'LEAGUE_PREDICTION_CLOSED',
    });

    // 기사가 잘 보이게 1부 두 경기 결과를 고친다: 낮은 OVR 팀의 승리(이변), 7골 경기(골 잔치).
    const round1 = await ctx.db
      .select()
      .from(leagueMatches)
      .where(and(eq(leagueMatches.round, 1), eq(leagueMatches.tier, 1)));
    const strong = new Set(top.slice(0, 4).map((t) => t.body.name));
    const nameOf = (m: (typeof round1)[number], side: 'home' | 'away') =>
      (JSON.parse(m.detailJson!) as { home: { name: string }; away: { name: string } })[side].name;
    const mixed = round1.find(
      (m) => strong.has(nameOf(m, 'home')) !== strong.has(nameOf(m, 'away')),
    )!;
    const weakHome = !strong.has(nameOf(mixed, 'home'));
    await ctx.db
      .update(leagueMatches)
      .set(weakHome ? { homeGoals: 2, awayGoals: 0 } : { homeGoals: 0, awayGoals: 2 })
      .where(eq(leagueMatches.id, mixed.id));
    const fest = round1.find((m) => m.id !== mixed.id && m.id !== big.id)!;
    await ctx.db
      .update(leagueMatches)
      .set({ homeGoals: 4, awayGoals: 3 })
      .where(eq(leagueMatches.id, fest.id));

    // 역전승: 끌려가다 뒤집은 경기(골 기록으로 판단한다).
    const turn = round1.find((m) => ![mixed.id, fest.id, big.id].includes(m.id))!;
    const d = JSON.parse(turn.detailJson!) as { events: unknown[] };
    const goal = (minute: number, side: 'home' | 'away') => ({
      minute,
      side,
      scorer: { careerId: null, anon: '유스 선수' },
      assist: null,
    });
    d.events = [goal(10, 'away'), goal(50, 'home'), goal(80, 'home')];
    await ctx.db
      .update(leagueMatches)
      .set({ homeGoals: 2, awayGoals: 1, detailJson: JSON.stringify(d) })
      .where(eq(leagueMatches.id, turn.id));

    const n1 = await news(1);
    if (typeof n1 === 'number') throw new Error(`news 1: ${n1}`);
    const kinds = n1.items.map((i) => i.kind);
    expect(kinds).toContain('leader');
    expect(kinds).toContain('teamOfRound');
    // 무작위로 치른 다른 경기에 더 큰 역전승이 있으면 그 경기가 실린다. 실린 역전승은 1골 차 이상 끌려갔다.
    const cb = n1.items.find((i) => i.kind === 'comeback');
    expect(cb).toBeTruthy();
    expect((cb as { trailed: number }).trailed).toBeGreaterThanOrEqual(1);
    // 1라운드에는 라운드 전 순위가 없어 더비가 없다.
    expect(kinds).not.toContain('derby');
    const upset = n1.items.find((i) => i.kind === 'upset');
    expect(upset).toMatchObject({ match: { id: mixed.id }, gap: expect.any(Number) });
    expect((upset as { gap: number }).gap).toBeGreaterThanOrEqual(3);
    expect(n1.items.find((i) => i.kind === 'goalfest')).toMatchObject({
      match: { id: fest.id, homeGoals: 4, awayGoals: 3 },
    });
    expect(n1.items.find((i) => i.kind === 'leader')).toMatchObject({
      tier: 1,
      league: 1,
      changed: false,
    });
    expect(n1.lastBig?.id).toBe(big.id);
    expect(n1.bigMatch).toMatchObject({ tier: 1, league: 1, round: 2 });

    // 내 예측 기록: 끝난 경기는 결과와 적중 수.
    const mine = PredMeRes.parse(
      await (await call('GET', '/v1/leagues/2/predictions/me', { cookie: a!.cookie })).json(),
    ).data;
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ matchId: big.id, round: 1, pick: 'away' });
    expect(mine.total).toBe(1);
    expect(mine.hit).toBe(mine.items[0]!.result === 'away' ? 1 : 0);
  }, 60_000); // 15팀 배치 · 1라운드를 치러 보는 흐름이라 혼자 돌려도 10초 넘게 걸린다(전체 실행 부하에서 20초 기본값을 넘는다).

  it('잘못된 시즌 · 라운드는 404', async () => {
    expect(await news(0)).toBe(404);
    expect((await call('GET', '/v1/leagues/2/news/abc')).status).toBe(404);
    expect((await call('GET', '/v1/leagues/2/news/100')).status).toBe(404);
  });
});

describe('T-11-652 라운드 결과 알림의 신문 1면', () => {
  const t = (teamId: string, name: string) => ({
    teamId,
    name,
    owner: '감독',
    logo: null,
    ovr: 80,
  });
  const m = {
    id: 'm1',
    tier: 1,
    league: 1,
    round: 3,
    home: t('a', '하늘 FC'),
    away: t('b', '바다 FC'),
    homeGoals: 0,
    awayGoals: 2,
  };
  const news = {
    season: 2,
    round: 3,
    bigMatch: null,
    lastBig: null,
    items: [
      {
        kind: 'leader' as const,
        tier: 1,
        league: 1,
        team: t('c', '숲 FC'),
        points: 9,
        changed: false,
      },
      { kind: 'upset' as const, match: m, gap: 7 },
    ],
  };

  it('내 팀이 실린 기사를 먼저, 없으면 이변 같은 큰 기사를 1면으로 고른다', () => {
    expect(pushHeadline(news, 'c')).toEqual({ mine: true, head: '숲 FC, 1부 선두 자리 지켜' });
    expect(pushHeadline(news, 'z')).toEqual({ mine: false, head: '바다 FC, OVR 7 차를 뒤집다' });
    expect(pushHeadline({ ...news, items: [] }, 'a')).toBeNull();
  });

  it('알림 본문은 한국어로 저장되고 요청 언어로 옮겨진다', () => {
    const body = '하늘 FC 0 : 2 바다 FC · 지금 5위예요\n오늘의 신문: 바다 FC, OVR 7 차를 뒤집다';
    expect(cupText(body, 'en')).toBe(
      '하늘 FC 0 : 2 바다 FC · Position 5\nToday’s paper: 바다 FC overturn a 7-point OVR gap',
    );
    expect(
      cupText(
        '숲 FC 1 : 0 하늘 FC · 지금 1위예요\n우리 팀이 신문에 실렸어요: 숲 FC, 1부 선두로',
        'ja',
      ),
    ).toBe('숲 FC 1 : 0 하늘 FC・現在1位です\nチームが新聞に載りました: 숲 FC、1部首位に浮上');
  });
});
