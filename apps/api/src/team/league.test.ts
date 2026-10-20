import {
  ErrorEnvelopeSchema,
  LeagueMatchResponseSchema,
  LeagueMeResponseSchema,
  LeagueResponseSchema,
  LeagueTableResponseSchema,
  AdminLeagueSchema,
  successEnvelope,
} from '@offside/contracts';
import { LEAGUE_ROUNDS, planLeague } from '@offside/contracts/league';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLeagueEndsAt } from '../cron/seasonGauge.js';
import { cards, careers, leagueEntries, ownerTeams } from '../db/schema.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueAdminCookie, issueGoogleCookie } from '../test/http.js';
import { runLeague } from './league.js';

// T-11-418b 오프사이드 리그 2차: 배치 · 경기 · 기권 · 알림 · 명단 잠금 · 순위표 API.

const S2 = '2026-10-30T15:00:00.000Z';
const L = planLeague(2, S2);
const OPEN = '2026-11-01T03:00:00.000Z';
const at = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();
let seq = 0;

const MeRes = successEnvelope(LeagueMeResponseSchema);
const ViewRes = successEnvelope(LeagueResponseSchema);
const TableRes = successEnvelope(LeagueTableResponseSchema);
const MatchRes = successEnvelope(LeagueMatchResponseSchema);

describe('오프사이드 리그 진행 (T-11-418b)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(OPEN));
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(1, S2, false));
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
  const notices = (profileId: string) =>
    ctx.env.DB.prepare(
      'SELECT source_key AS k, title, body FROM notifications WHERE profile_id = ? ORDER BY created_at, source_key',
    )
      .bind(profileId)
      .all<{ k: string; title: string; body: string }>()
      .then((r) => r.results);

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

  it('배치 하루 전 안내 → 배치(OVR 순 부 · 리그, 자격 미달 제외) → 경기 · 알림 · 순위 → 끝', async () => {
    // 15팀 = 1부 8팀 + 2부 7팀. OVR 높은 8팀이 1부.
    const strong = [];
    for (let i = 0; i < 8; i++) strong.push(await entrant(8, 90));
    const weak = [];
    for (let i = 0; i < 7; i++) weak.push(await entrant(8, 70));
    const short = await entrant(7, 95);
    const none = await entrant(0);

    // 배치 하루 전보다 앞이면 아무것도 하지 않는다.
    expect(await run(at(L.drawAt, -25 * 3600_000))).toBeNull();
    expect(await run(at(L.drawAt, -23 * 3600_000))).toEqual({ season: 2, step: 'remind', n: 2 });
    expect(await run(at(L.drawAt, -22 * 3600_000))).toBeNull();
    expect((await notices(short.profileId)).map((n) => n.body)).toEqual([
      '배치 때 시즌 2 팀 선발에 선수가 8명 있어야 참가할 수 있어요. 지금은 7명이에요.',
    ]);
    expect((await notices(none.profileId))[0]?.body).toContain('지금은 0명이에요');

    expect(await run(L.drawAt)).toEqual({
      season: 2,
      step: 'draw',
      placed: 15,
      dropped: 2,
      leagues: 2,
    });
    const rows = await ctx.db.select().from(leagueEntries);
    const of = (p: string) => rows.find((r) => r.profileId === p)!;
    for (const s of strong) expect(of(s.profileId)).toMatchObject({ tier: 1, leagueNo: 1 });
    for (const w of weak) expect(of(w.profileId)).toMatchObject({ tier: 2, leagueNo: 1 });
    expect(of(short.profileId)).toMatchObject({ status: 'dropped', tier: null, teamId: null });
    const { n } = (await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM league_matches').first<{
      n: number;
    }>())!;
    expect(n).toBe(4 * LEAGUE_ROUNDS + 3 * LEAGUE_ROUNDS);

    // 배치 결과 알림(다음 cron).
    expect(await run(at(L.drawAt, 300_000))).toMatchObject({ step: 'notify', n: 17 });
    expect((await notices(strong[0]!.profileId)).at(-1)?.body).toMatch(
      /^리그팀\d+은\(는\) 1부 1리그예요\. 1라운드는 오늘 13:00에 열려요\.$/,
    );
    expect((await notices(short.profileId)).at(-1)?.title).toBe(
      '시즌 2 오프사이드 리그 참가가 취소됐어요',
    );

    // 공개 요약 · 내 배치.
    vi.setSystemTime(new Date(at(L.drawAt, 600_000)));
    const v = ViewRes.parse(await (await call('GET', '/v1/leagues/current')).json()).data;
    expect(v).toMatchObject({ phase: 'running', entries: 15, playedRounds: 0 });
    expect(v.tiers).toEqual([
      { tier: 1, leagues: 1, teams: 8 },
      { tier: 2, leagues: 1, teams: 7 },
    ]);
    const me = async (cookie: string) =>
      MeRes.parse(await (await call('GET', '/v1/leagues/current/me', { cookie })).json()).data;
    expect((await me(strong[0]!.cookie)).placement).toMatchObject({
      status: 'placed',
      tier: 1,
      league: 1,
      rank: expect.any(Number),
    });
    expect((await me(short.cookie)).placement).toMatchObject({ status: 'dropped' });

    // 1라운드 1시간 전부터 명단이 잠긴다.
    vi.setSystemTime(new Date(at(L.rounds[0]!, -30 * 60_000)));
    const locked = await call('PUT', '/v1/owner-team', {
      cookie: strong[1]!.cookie,
      body: strong[1]!.body,
    });
    expect(locked.status).toBe(409);
    expect(
      (ErrorEnvelopeSchema.parse(await locked.json()).error.details as { reason: string }).reason,
    ).toBe('LEAGUE_LINEUP_LOCKED');

    // 1라운드: 경기(1부 4 + 2부 3) → 알림.
    expect(await run(L.rounds[0]!)).toEqual({ season: 2, step: 'play', n: 7 });
    expect(await run(at(L.rounds[0]!, 300_000))).toMatchObject({
      step: 'notify',
      n: 15,
      played: 1,
    });
    const r1 = (await notices(strong[0]!.profileId)).at(-1)!;
    expect(r1.title).toMatch(/^오프사이드 리그 1라운드 · (이겼어요|비겼어요|졌어요)$/);
    expect(r1.body).toMatch(/ · 지금 \d위예요$/);
    // 7팀 리그는 라운드마다 한 팀이 쉰다.
    const rested = [];
    for (const w of weak)
      if ((await notices(w.profileId)).at(-1)!.title.endsWith('휴식')) rested.push(w);
    expect(rested).toHaveLength(1);

    // 순위표 · 경기 상세.
    const table = TableRes.parse(await (await call('GET', '/v1/leagues/2/tables/1/1')).json()).data;
    expect(table.teams).toHaveLength(8);
    expect(table.standings.reduce((a, s) => a + s.p, 0)).toBe(8);
    expect(table.matches).toHaveLength(4 * LEAGUE_ROUNDS);
    const played = table.matches.find((m) => m.played)!;
    const detail = MatchRes.parse(
      await (await call('GET', `/v1/leagues/2/matches/${played.id}`)).json(),
    ).data;
    expect(detail.league).toEqual({ tier: 1, league: 1, round: 1, forfeit: false });
    expect((await call('GET', '/v1/leagues/2/tables/2/2')).status).toBe(404);
    expect((await call('GET', '/v1/leagues/2/tables/3/1')).status).toBe(404);

    // 나머지 라운드를 끝까지.
    await drain(at(L.rounds.at(-1)!, 3600_000));
    const end = (await notices(strong[0]!.profileId)).at(-1)!;
    expect(end.body).toMatch(/^1부 1리그 최종 \d위예요\.$/);
    const final = TableRes.parse(await (await call('GET', '/v1/leagues/2/tables/2/1')).json()).data;
    // 7팀 리그는 팀마다 12경기.
    for (const s of final.standings) expect(s.p).toBe(12);
    const state = await ctx.env.DB.prepare('SELECT done_at FROM league_state').first<{
      done_at: string | null;
    }>();
    expect(state?.done_at).not.toBeNull();
    expect(await openLeagueEndsAt(ctx.env.DB, { id: 2, startsAt: S2 })).toBeNull();
  });

  it('팀이 없어지면 0:3 기권패, 3번 쌓이면 남은 경기는 모두 기권패(forfeited)', async () => {
    const teams = [];
    for (let i = 0; i < 8; i++) teams.push(await entrant(8, 80));
    await run(L.drawAt);
    await drain(at(L.drawAt, 60_000));
    const gone = teams[0]!;
    await ctx.db.delete(ownerTeams).where(eqProfile(gone.profileId));
    // 3라운드까지 치른다.
    await drain(L.rounds[2]!);
    const [e] = await ctx.db.select().from(leagueEntries).where(eqEntry(gone.profileId));
    expect(e).toMatchObject({ status: 'forfeited', forfeits: 3 });
    expect((await notices(gone.profileId)).map((n) => n.title)).toContain(
      '오프사이드 리그 남은 경기가 기권패로 처리돼요',
    );
    await drain(at(L.rounds.at(-1)!, 60_000));
    const table = TableRes.parse(await (await call('GET', '/v1/leagues/2/tables/1/1')).json()).data;
    const row = table.standings.find((s) => s.teamId === e!.teamId)!;
    expect(row).toMatchObject({
      p: 14,
      w: 0,
      d: 0,
      l: 14,
      gf: 0,
      ga: 42,
      pts: 0,
      rank: 8,
      forfeits: 3,
    });
    const forfeits = table.matches.filter((m) => m.forfeit);
    expect(forfeits).toHaveLength(14);
  });

  it('경기 때 선발 실카드가 8명보다 적으면(카드가 팔림) 그 경기만 0:3 기권패', async () => {
    const teams = [];
    for (let i = 0; i < 8; i++) teams.push(await entrant(8, 80));
    await run(L.drawAt);
    await drain(at(L.drawAt, 60_000));
    const sold = teams[0]!;
    const [card] = await ctx.db
      .select()
      .from(cards)
      .where(eq(cards.ownerId, sold.profileId))
      .limit(1);
    await ctx.db
      .update(cards)
      .set({ ownerId: teams[1]!.profileId })
      .where(eq(cards.careerId, card!.careerId));
    await drain(L.rounds[0]!);
    const [e] = await ctx.db.select().from(leagueEntries).where(eqEntry(sold.profileId));
    expect(e).toMatchObject({ status: 'active', forfeits: 1 });
    const m = await ctx.env.DB.prepare(
      'SELECT home_team_id AS h, home_goals AS hg, away_goals AS ag, forfeit FROM league_matches WHERE round = 1 AND (home_team_id = ?1 OR away_team_id = ?1)',
    )
      .bind(e!.teamId)
      .first<{ h: string; hg: number; ag: number; forfeit: number }>();
    expect(m!.h === e!.teamId ? [m!.forfeit, m!.hg, m!.ag] : [m!.forfeit, m!.ag, m!.hg]).toEqual([
      m!.h === e!.teamId ? 1 : 2,
      0,
      3,
    ]);
  });

  it('7팀이 안 되면 리그를 열지 않고 모두에게 알린다', async () => {
    const few = [];
    for (let i = 0; i < 5; i++) few.push(await entrant(8));
    expect(await run(L.drawAt)).toMatchObject({ step: 'draw', placed: 0, dropped: 5, leagues: 0 });
    expect(await run(at(L.drawAt, 60_000))).toMatchObject({ step: 'notify', n: 5 });
    expect((await notices(few[0]!.profileId)).at(-1)?.title).toBe(
      '시즌 2 오프사이드 리그가 열리지 않아요',
    );
    expect(await run(at(L.drawAt, 120_000))).toEqual({ season: 2, step: 'done' });
    expect(await run(at(L.drawAt, 180_000))).toBeNull();
  });

  it('운영 도구: 상태 보기 · 배치 전 일정 미루기(쌓인다), 배치 뒤에는 막는다', async () => {
    const admin = await issueAdminCookie(ctx);
    const AdminRes = successEnvelope(AdminLeagueSchema);
    const view = async () =>
      AdminRes.parse(
        await (await call('GET', '/v1/admin/leagues/current', { cookie: admin.cookie })).json(),
      ).data;
    for (let i = 0; i < 7; i++) await entrant(8);
    expect(await view()).toMatchObject({
      phase: 'open',
      delayed: false,
      counts: { entries: 7, placed: 0 },
      drawnAt: null,
    });
    const delay = (days: number) =>
      call('POST', '/v1/admin/leagues/current/delay', { cookie: admin.cookie, body: { days } });
    expect((await delay(1)).status).toBe(200);
    const twice = AdminRes.parse(await (await delay(1)).json()).data;
    expect(twice.delayed).toBe(true);
    expect(twice.league.drawAt).toBe(at(L.drawAt, 2 * 86_400_000));
    expect(twice.league.rounds[0]).toBe(at(L.rounds[0]!, 2 * 86_400_000));
    expect(twice.league.opensAt).toBe(L.opensAt);
    // 원래 배치 시각에는 배치하지 않는다.
    expect(await run(L.drawAt)).toBeNull();
    expect(await run(twice.league.drawAt)).toMatchObject({ step: 'draw', placed: 7 });
    vi.setSystemTime(new Date(at(twice.league.drawAt, 60_000)));
    expect((await view()).counts).toMatchObject({ placed: 7 });
    const late = await delay(1);
    expect(late.status).toBe(409);
    expect(
      (
        await call('GET', '/v1/admin/leagues/current', {
          cookie: (await entrant(0, 80, false)).cookie,
        })
      ).status,
    ).toBe(403);
  });

  it('리그가 끝나기 전에는 시즌 마감을 마지막 라운드 뒤로 미룬다', async () => {
    expect(
      await openLeagueEndsAt(ctx.env.DB, { id: 1, startsAt: '2026-10-05T15:00:00.000Z' }),
    ).toBeNull();
    expect(await openLeagueEndsAt(ctx.env.DB, { id: 2, startsAt: S2 })).toBe(L.rounds.at(-1));
  });
});

const eqProfile = (p: string) => eq(ownerTeams.profileId, p);
const eqEntry = (p: string) => eq(leagueEntries.profileId, p);
