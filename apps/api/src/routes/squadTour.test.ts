import {
  TourMatchResponseSchema,
  TourRankingResponseSchema,
  TourStateResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import { TOUR, tourFee, tourWeekOf } from '@offside/contracts/squad-tour';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  balanceVersions,
  careers,
  ownerFundLedger,
  ownerFunds,
  tourMatches,
  tourProgress,
} from '../db/schema.js';
import { createTestD1, syncCards, type TestD1 } from '../test/d1.js';
import { callJson, issueCookie, issueGoogleCookie } from '../test/http.js';

const State = successEnvelope(TourStateResponseSchema);
const Match = successEnvelope(TourMatchResponseSchema);
const Ranking = successEnvelope(TourRankingResponseSchema);
// 화요일 낮(한국 시각). 그 주 월요일은 2026-11-23.
const NOW = '2026-11-24T03:00:00.000Z';
const SEASON = teamSeasonAt(NOW)!;
const POS = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'] as const;
const DPOS = { GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST' } as const;
let seq = 0;

describe('원정 투어 (T-11-825)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await ctx.dispose();
  });

  const call = (method: string, path: string, opts?: Parameters<typeof callJson>[3]) =>
    callJson(ctx.env, method, path, opts);
  const idem = () => ({ 'Idempotency-Key': `tour-${++seq}-key-000000` });
  const open = (on = 1) =>
    ctx.db.insert(balanceVersions).values({
      version: 1,
      status: 'active',
      note: '',
      valuesJson: JSON.stringify({ tourOpen: on }),
      createdBy: 'test',
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
      activatedAt: '2026-09-29T00:00:00.000Z',
    });
  /** 최고 OVR이 peak인 카드 n장(자리 구성은 4-3-3 순서로 돈다). 유형 · 국적을 흩어 본선 앞쪽 제한에 걸리지 않게 한다. */
  async function addCards(profileId: string, n: number, peak: number) {
    const ids: string[] = [];
    const at = '2026-10-10T00:00:00.000Z';
    for (let i = 0; i < n; i++) {
      const pos = POS[i % POS.length]!;
      const id = crypto.randomUUID();
      await ctx.db.insert(careers).values({
        id,
        profileId,
        pos,
        dpos: DPOS[pos],
        foot: '오른발',
        type: (['maker', 'speed', 'power', 'tech', 'all'] as const)[i % 5] as never,
        trait: 'late',
        startYear: 2026,
        status: 'retired',
        appVersion: '1.0.0',
        createdAt: at,
        updatedAt: at,
        retiredAt: at,
        retireAge: 34,
        peak,
        legendScore: 300,
        apps: 300,
        nation: ['KR', 'JP', 'GB', 'FR', 'DE', 'BR', 'AR', 'ES'][i % 8]!,
        mainLeague: null,
        serviceSeason: SEASON,
        value: 1_000_000,
      });
      ids.push(id);
    }
    await syncCards(ctx, 500_000);
    return ids;
  }
  const start = (cookie: string, ids: string[], stage = 1) =>
    call('POST', '/v1/tour/matches', {
      cookie,
      headers: idem(),
      body: {
        stage,
        formation: '4-3-3',
        slotIds: ids.slice(0, 11),
        bench: ids.slice(11, 16),
        tactic: 'possession',
      },
    });
  const order = (cookie: string, id: string, done: number, body: object = {}) =>
    call('POST', `/v1/tour/matches/${id}/orders`, {
      cookie,
      headers: idem(),
      body: { done, ...body },
    });
  const reason = async (res: Response) =>
    ((await res.json()) as { error: { details?: { reason?: string } } }).error.details?.reason;
  /** 한 판을 끝까지 치른다(지시 없이). */
  async function playOut(cookie: string, ids: string[], stage: number) {
    const s = Match.parse(await (await start(cookie, ids, stage)).json()).data;
    const a = Match.parse(await (await order(cookie, s.match.id, 1)).json()).data;
    expect(a.match.done).toBe(2);
    return Match.parse(await (await order(cookie, s.match.id, 2)).json()).data;
  }

  it('닫혀 있으면(tourOpen 0) 홈은 open false, 출발은 404다', async () => {
    const owner = await issueGoogleCookie(ctx);
    const ids = await addCards(owner.profileId, 16, 99);
    const home = State.parse(
      await (await call('GET', '/v1/tour', { cookie: owner.cookie })).json(),
    );
    expect(home.data.open).toBe(false);
    const res = await start(owner.cookie, ids);
    expect(res.status).toBe(404);
    expect(await reason(res)).toBe('TOUR_CLOSED');
  });

  it('로그인하지 않은 프로필은 들어가지 못한다', async () => {
    await open();
    const anon = await issueCookie(ctx);
    expect((await call('GET', '/v1/tour', { cookie: anon.cookie })).status).toBe(403);
  });

  it('홈은 본선 사다리와 남은 도전을 준다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    const home = State.parse(
      await (await call('GET', '/v1/tour', { cookie: owner.cookie })).json(),
    );
    expect(home.data).toMatchObject({
      open: true,
      week: '2026-11-23',
      cleared: 0,
      score: 0,
      rank: null,
      triesLeft: 3,
      live: null,
    });
    expect(home.data.stages.map((s) => s.opp)).toEqual([...TOUR.opp]);
    expect(home.data.stages.every((s) => s.rules.length === 1 && s.stars === 0)).toBe(true);
  });

  it('강한 팀이 1차전을 이기면 대전료 · 점수 · 별을 받고 다음 경기가 열린다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    const ids = await addCards(owner.profileId, 16, 99);
    const end = await playOut(owner.cookie, ids, 1);
    expect(end.match.status).toBe('won');
    expect(end.match.done).toBe(3);
    expect(end.match.result).toMatchObject({ fee: tourFee(1) });
    expect(end.match.result!.stars).toBeGreaterThanOrEqual(2);
    expect(end.balance).toBe(tourFee(1));
    expect(end.triesLeft).toBe(2);
    const [funds] = await ctx.db
      .select()
      .from(ownerFunds)
      .where(eq(ownerFunds.profileId, owner.profileId));
    expect(funds?.balance).toBe(tourFee(1));
    const ledger = await ctx.db
      .select()
      .from(ownerFundLedger)
      .where(eq(ownerFundLedger.profileId, owner.profileId));
    expect(ledger).toMatchObject([
      { kind: 'tour_fee', delta: tourFee(1), balance: tourFee(1), ref: '2026-11-23:1' },
    ]);
    const home = State.parse(
      await (await call('GET', '/v1/tour', { cookie: owner.cookie })).json(),
    );
    expect(home.data).toMatchObject({ cleared: 1, rank: 1, triesLeft: 2, live: null });
    expect(home.data.score).toBe(end.match.result!.score);
    expect(home.data.stages[0]!.stars).toBe(end.match.result!.stars);
    // 자금 내역에 대전료 한 줄.
    const history = (await (
      await call('GET', '/v1/market/funds/history', { cookie: owner.cookie })
    ).json()) as {
      data: { items: { id: string; amount: number }[]; totals: { matchIncome: number } };
    };
    expect(history.data.items).toMatchObject([{ id: 'tour:2026-11-23:1', amount: tourFee(1) }]);
    expect(history.data.totals.matchIncome).toBe(tourFee(1));
    // 주간 순위(세션 없이).
    const rank = Ranking.parse(await (await call('GET', '/v1/tour/ranking')).json());
    expect(rank.data.rows).toMatchObject([{ rank: 1, cleared: 1, score: home.data.score }]);
  });

  it('이미 이긴 경기 · 건너뛴 경기는 갈 수 없다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    const ids = await addCards(owner.profileId, 16, 99);
    await playOut(owner.cookie, ids, 1);
    for (const stage of [1, 3]) {
      const res = await start(owner.cookie, ids, stage);
      expect(res.status).toBe(409);
      expect(await reason(res)).toBe('TOUR_STAGE');
    }
  });

  it('진행 중인 경기가 있으면 새로 출발하지 못하고, 홈에서 이어 갈 수 있다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    const ids = await addCards(owner.profileId, 16, 99);
    const s = Match.parse(await (await start(owner.cookie, ids)).json()).data;
    expect(s.match).toMatchObject({ status: 'live', done: 1, tryNo: 1, subsLeft: 3 });
    expect(Object.keys(s.match.chances ?? {})).toHaveLength(5);
    const again = await start(owner.cookie, ids);
    expect(await reason(again)).toBe('TOUR_LIVE');
    const home = State.parse(
      await (await call('GET', '/v1/tour', { cookie: owner.cookie })).json(),
    );
    expect(home.data.live?.id).toBe(s.match.id);
    expect(home.data.triesLeft).toBe(2);
  });

  it('작전 타임에 전술을 바꾸고 교체하면 상태에 반영된다. 지난 작전 타임의 지시는 버린다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    const ids = await addCards(owner.profileId, 16, 99);
    const s = Match.parse(await (await start(owner.cookie, ids)).json()).data;
    const a = Match.parse(
      await (
        await order(owner.cookie, s.match.id, 1, {
          tactic: 'counter',
          subs: [{ slot: 10, cardId: ids[11] }],
        })
      ).json(),
    ).data;
    expect(a.match).toMatchObject({ done: 2, tactic: 'counter', subsLeft: 2 });
    expect(a.match.slotIds[10]).toBe(ids[11]);
    expect(a.match.bench).not.toContain(ids[11]);
    // 같은 작전 타임(done 1) 지시를 다시 보내면 지금 상태 그대로다.
    const stale = Match.parse(
      await (await order(owner.cookie, s.match.id, 1, { tactic: 'press' })).json(),
    ).data;
    expect(stale.match).toMatchObject({ done: 2, tactic: 'counter' });
    // 명단에 없는 카드 교체는 거절.
    const bad = await order(owner.cookie, s.match.id, 2, { subs: [{ slot: 0, cardId: ids[0] }] });
    expect(bad.status).toBe(409);
    expect(await reason(bad)).toBe('TOUR_ORDER');
  });

  it('끝난 경기에 지시를 다시 보내도 대전료는 한 번만 들어간다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    const ids = await addCards(owner.profileId, 16, 99);
    const end = await playOut(owner.cookie, ids, 1);
    const again = Match.parse(await (await order(owner.cookie, end.match.id, 2)).json()).data;
    expect(again.match.status).toBe('won');
    expect(again.balance).toBeNull();
    const ledger = await ctx.db
      .select()
      .from(ownerFundLedger)
      .where(eq(ownerFundLedger.profileId, owner.profileId));
    expect(ledger).toHaveLength(1);
    const [p] = await ctx.db
      .select()
      .from(tourProgress)
      .where(eq(tourProgress.profileId, owner.profileId));
    expect(p).toMatchObject({ cleared: 1, tries: 1, triesAtScore: 1 });
  });

  it('약한 팀은 지고, 하루 세 판을 쓰면 더 갈 수 없다. 진 경기에는 대전료 · 점수가 없다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    // 5차전까지 올려 둔 진행(상대 90)에 60짜리 카드로 간다.
    await ctx.db.insert(tourProgress).values({
      profileId: owner.profileId,
      week: tourWeekOf(NOW),
      cleared: 4,
      score: 1000,
      tries: 4,
      triesAtScore: 4,
      reachedAt: '2026-11-23T03:00:00.000Z',
      updatedAt: '2026-11-23T03:00:00.000Z',
    });
    const ids = await addCards(owner.profileId, 16, 60);
    let lost = 0;
    for (let i = 0; i < 3; i++) {
      const end = await playOut(owner.cookie, ids, 5);
      if (end.match.status === 'lost') {
        lost++;
        expect(end.match.result).toMatchObject({ fee: 0, score: 0, stars: 0 });
        expect(end.balance).toBeNull();
      }
    }
    expect(lost).toBeGreaterThan(0);
    const res = await start(owner.cookie, ids, 5);
    expect(res.status).toBe(409);
    expect(await reason(res)).toBe('TOUR_NO_TRIES');
    const rows = await ctx.db
      .select()
      .from(tourMatches)
      .where(eq(tourMatches.profileId, owner.profileId));
    expect(rows.map((r) => r.tryNo).sort()).toEqual([1, 2, 3]);
    // 다음 날(한국 시각)에는 다시 찬다.
    vi.setSystemTime(new Date('2026-11-24T15:00:01.000Z'));
    const home = State.parse(
      await (await call('GET', '/v1/tour', { cookie: owner.cookie })).json(),
    );
    expect(home.data.triesLeft).toBe(3);
  });

  it('남의 카드 · 판매에 올린 카드 · 같은 카드 두 번은 편성에 넣을 수 없다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    const other = await issueGoogleCookie(ctx);
    const ids = await addCards(owner.profileId, 16, 99);
    const theirs = await addCards(other.profileId, 1, 99);
    for (const bad of [
      [theirs[0]!, ...ids.slice(1)],
      [ids[1]!, ...ids.slice(1)],
    ]) {
      const res = await start(owner.cookie, bad);
      expect(res.status).toBe(409);
      expect(await reason(res)).toBe('TOUR_LINEUP');
    }
    expect(await ctx.db.select().from(tourMatches)).toHaveLength(0);
  });

  it('주간 순위는 쿠키가 있어도 세션 · 프로필을 읽지 않는다', async () => {
    await open();
    const owner = await issueGoogleCookie(ctx);
    const seen: string[] = [];
    const prepare = ctx.env.DB.prepare.bind(ctx.env.DB);
    ctx.env.DB.prepare = (q: string) => (seen.push(q), prepare(q));
    const res = await call('GET', '/v1/tour/ranking', { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(seen.some((q) => /\b(sessions|profiles)\b/.test(q))).toBe(false);
  });
});
