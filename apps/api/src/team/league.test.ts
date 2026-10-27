import {
  ErrorEnvelopeSchema,
  LeagueMatchResponseSchema,
  LeagueMeResponseSchema,
  LeagueResponseSchema,
  LeagueTableResponseSchema,
  AdminLeagueSchema,
  successEnvelope,
} from '@offside/contracts';
import { LEAGUE_CYCLE, planLeague } from '@offside/contracts/league';
import { applySeasonSchedule, closeSeasonSchedule } from '@offside/contracts/service-seasons';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cupKo, cupText } from '../cupText.js';
import { cards, careers, leagueEntries, ownerTeams } from '../db/schema.js';
import { forgetSeasonSchedule, saveSeasonSchedule } from '../seasonSchedule.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { ADMIN_EMAIL, callJson, issueAdminCookie, issueGoogleCookie } from '../test/http.js';
import { runLeague } from './league.js';

// T-11-418b 오프사이드 리그 2차: 배치 · 경기 · 기권 · 알림 · 명단 잠금 · 순위표 API.

const S2 = '2026-10-30T15:00:00.000Z';
// 시즌 2가 11/19 00:00 KST에 끝나는 일정: 리그는 11/5 ~ 11/18 14라운드(T-11-540 마감 전날까지).
const S3 = '2026-11-18T15:00:00.000Z';
const L = planLeague(2, S2, S3);
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
    expect(n).toBe(4 * LEAGUE_CYCLE + 3 * LEAGUE_CYCLE);

    // 배치 결과 알림(다음 cron).
    expect(await run(at(L.drawAt, 300_000))).toMatchObject({ step: 'notify', n: 17 });
    expect((await notices(strong[0]!.profileId)).at(-1)?.body).toMatch(
      /^리그팀\d+ 팀은 1부 1리그예요\. 1라운드는 오늘 13:00에 열려요\.$/,
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
      forfeits: 0,
    });
    // T-11-430 자격이 모자라 빠진 신청은 이유가 short.
    expect((await me(short.cookie)).placement).toMatchObject({
      status: 'dropped',
      reason: 'short',
    });
    expect((await notices(short.profileId)).at(-1)?.body).toBe(
      '배치 시각에 시즌 2 팀 선발 선수가 8명보다 적었어요. 다음 시즌에 다시 신청할 수 있어요.',
    );

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
    expect(table.matches).toHaveLength(4 * LEAGUE_CYCLE);
    // T-11-418d 득점 순위: 리그 팀 선수만, 많은 순, 3위까지(같은 골 수 포함 5줄 안). 마지막 라운드 전이라 골 시각은 없다.
    const ids = new Set(table.teams.map((t) => t.teamId));
    const scored = table.matches.reduce((a, m) => a + (m.homeGoals ?? 0) + (m.awayGoals ?? 0), 0);
    const sc = table.scorers ?? [];
    expect(sc.length).toBeLessThanOrEqual(5);
    expect(sc.reduce((a, x) => a + x.goals, 0)).toBeLessThanOrEqual(scored);
    for (const x of sc) {
      expect(ids.has(x.teamId)).toBe(true);
      expect(x).toMatchObject({ name: null, pos: 'FW', number: 9 });
    }
    expect(sc.map((x) => x.goals)).toEqual([...sc.map((x) => x.goals)].sort((a, b) => b - a));
    expect(table.matches.some((m) => m.goals)).toBe(false);
    const played = table.matches.find((m) => m.played)!;
    const detail = MatchRes.parse(
      await (await call('GET', `/v1/leagues/2/matches/${played.id}`)).json(),
    ).data;
    expect(detail.league).toEqual({ tier: 1, league: 1, round: 1, forfeit: false });
    expect((await call('GET', '/v1/leagues/2/tables/2/2')).status).toBe(404);
    expect((await call('GET', '/v1/leagues/2/tables/3/1')).status).toBe(404);

    // 나머지 라운드를 끝까지.
    await drain(at(L.rounds.at(-1)!, 3600_000));
    // T-11-418e 결산: 최종 순위 · 결과 · 보상(한 번만), 1부 우승 칭호, 마지막 알림에 보상과 다음 시즌 부.
    const settled = await ctx.db.select().from(leagueEntries);
    const placed = settled.filter((r) => r.tier !== null);
    expect(placed.every((r) => r.rewardedAt && r.finalRank && r.outcome)).toBe(true);
    const at1 = (tier: number, rank: number) =>
      placed.find((r) => r.tier === tier && r.finalRank === rank)!;
    expect(at1(1, 1).outcome).toBe('champion');
    expect(at1(1, 6).outcome).toBe('stayed');
    expect([at1(1, 7).outcome, at1(1, 8).outcome]).toEqual(['relegated', 'relegated']);
    expect(at1(2, 1).outcome).toBe('promoted');
    // 2부가 맨 아래 부라 7위도 잔류.
    expect(at1(2, 7).outcome).toBe('stayed');
    const items = async (p: string) =>
      Object.fromEntries(
        (
          await ctx.env.DB.prepare('SELECT item, qty FROM owner_items WHERE profile_id = ?')
            .bind(p)
            .all<{ item: string; qty: number }>()
        ).results.map((r) => [r.item, r.qty]),
      );
    const champ = at1(1, 1).profileId;
    // T-11-541 시즌 2 새 업적(정점 OVR 90 선수) 단계 보상 강화권 1장이 더해진다.
    expect(await items(champ)).toEqual({ reroll: 17, scout: 3, boost: 4 });
    expect(await items(at1(2, 1).profileId)).toEqual({ reroll: 9, scout: 1, boost: 1 });
    expect(await items(at1(2, 3).profileId)).toEqual({ reroll: 2 });
    const title = await ctx.env.DB.prepare('SELECT title FROM profiles WHERE id = ?')
      .bind(champ)
      .first<{ title: string | null }>();
    expect(title?.title).toBe('league-2-champion');
    const end = (await notices(champ)).at(-1)!;
    expect(end.title).toBe('시즌 2 오프사이드 리그 1부 1리그 우승!');
    expect(end.body).toBe(
      '1부 우승! 시즌 2 리그 챔피언 칭호와 선수 후보 리롤권 17장, 프리미엄 스카우트권 3장, 잠재력 강화권 3장을 받았어요.',
    );
    expect((await notices(at1(1, 8).profileId)).at(-1)!.body).toBe(
      '1부 1리그 최종 8위예요. 선수 후보 리롤권 2장을 받았어요. 다음 시즌에 신청하면 2부에서 시작해요.',
    );
    expect((await notices(at1(2, 1).profileId)).at(-1)!.body).toBe(
      '2부 1리그 최종 1위예요. 선수 후보 리롤권 9장, 프리미엄 스카우트권 1장, 잠재력 강화권 1장을 받았어요. 다음 시즌에 신청하면 1부에서 시작해요.',
    );
    // 다시 돌려도 보상은 한 번.
    expect(await drain(at(L.rounds.at(-1)!, 7200_000))).toEqual([]);
    expect((await items(champ)).reroll).toBe(17);
    const champCookie = [...strong, ...weak].find((x) => x.profileId === champ)!.cookie;
    vi.setSystemTime(new Date(at(L.rounds.at(-1)!, 7200_000)));
    expect((await me(champCookie)).placement).toMatchObject({
      rank: 1,
      final: { rank: 1, outcome: 'champion', rerolls: 17, scouts: 3, boosts: 3, nextTier: 1 },
    });
    const titles = await call('GET', '/v1/owner/title', { cookie: champCookie });
    expect(((await titles.json()) as { data: { titles: string[] } }).data.titles[0]).toBe(
      'league-2-champion',
    );
    const final = TableRes.parse(await (await call('GET', '/v1/leagues/2/tables/2/1')).json()).data;
    // 7팀 리그는 팀마다 12경기.
    for (const s of final.standings) expect(s.p).toBe(12);
    // T-11-418d 마지막 라운드 경기에만 골 시각이 실리고, 스코어와 쪽별 골 수가 맞는다.
    for (const m of final.matches) {
      if (m.round !== LEAGUE_CYCLE || m.forfeit) {
        expect(m.goals).toBeUndefined();
        continue;
      }
      expect(m.goals!.filter((g) => g.side === 'home')).toHaveLength(m.homeGoals!);
      expect(m.goals!.filter((g) => g.side === 'away')).toHaveLength(m.awayGoals!);
      expect(m.goals!.map((g) => g.minute)).toEqual(
        [...m.goals!.map((g) => g.minute)].sort((a, b) => a - b),
      );
    }
    const state = await ctx.env.DB.prepare('SELECT done_at FROM league_state').first<{
      done_at: string | null;
    }>();
    expect(state?.done_at).not.toBeNull();
  }, 60_000); // 14라운드를 다 치러 보는 흐름이라 혼자 돌려도 10초 넘게 걸린다(전체 실행 부하에서 20초 기본값을 넘는다).

  it('T-11-540 마감 전 일정은 최대 기간 끝까지 14라운드를 되풀이하고, 마감이 정해지면 그 뒤 라운드를 지운다', async () => {
    // 시즌 2 마감을 아직 모르는 일정(최대 기간 끝까지).
    applySeasonSchedule([]);
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(1, S2, false));
    const long = planLeague(2, S2);
    expect(long.rounds.length).toBeGreaterThan(LEAGUE_CYCLE);
    for (let i = 0; i < 8; i++) await entrant(8, 80);
    await run(long.drawAt);
    const rounds = async () =>
      (
        await ctx.env.DB.prepare(
          'SELECT round, home_team_id AS h, away_team_id AS a FROM league_matches WHERE season = 2 ORDER BY round, slot',
        ).all<{ round: number; h: string; a: string }>()
      ).results;
    const all = await rounds();
    expect(Math.max(...all.map((m) => m.round))).toBe(long.rounds.length);
    const pairs = (r: number) => all.filter((m) => m.round === r).map((m) => `${m.h}-${m.a}`);
    expect(pairs(LEAGUE_CYCLE + 1)).toEqual(pairs(1));
    // 게이지가 마감을 11/19 00:00 KST로 확정 → 11/18 라운드까지만 남긴다.
    await saveSeasonSchedule(ctx.env.DB, closeSeasonSchedule(2, S3, false));
    await drain(at(long.drawAt, 60_000));
    expect(Math.max(...(await rounds()).map((m) => m.round))).toBe(LEAGUE_CYCLE);
  }, 60_000);

  it('팀이 없어지면 0:3 기권패, 3번 쌓이면 남은 경기는 모두 기권패(forfeited)', async () => {
    const teams = [];
    for (let i = 0; i < 8; i++) teams.push(await entrant(8, 80));
    await run(L.drawAt);
    await drain(at(L.drawAt, 60_000));
    const gone = teams[0]!;
    await ctx.db.delete(ownerTeams).where(eqProfile(gone.profileId));
    // 3라운드까지 한 라운드씩 치른다(라운드마다 알림).
    for (const r of [0, 1, 2]) await drain(L.rounds[r]!);
    const [e] = await ctx.db.select().from(leagueEntries).where(eqEntry(gone.profileId));
    expect(e).toMatchObject({ status: 'forfeited', forfeits: 3 });
    // T-11-430 1 · 2번째 기권패 알림에 쌓인 기권 수와 남은 횟수를 싣는다.
    const bodies = (await notices(gone.profileId)).map((n) => n.body);
    expect(bodies.filter((b) => b.includes('기권패했어요'))).toEqual([
      expect.stringMatching(
        / · 선발 선수가 모자라 기권패했어요\. 기권 1\/3번, 2번 더 기권하면 남은 경기는 모두 0:3 패예요\.$/,
      ),
      expect.stringMatching(/기권 2\/3번, 1번 더 기권하면/),
    ]);
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
  }, 60_000); // 14라운드를 다 치러 본다.

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
    // T-11-430 자격은 갖췄지만 리그를 꾸리지 못해 빠진 신청은 이유가 capacity(화면이 리그 무산으로 그린다).
    vi.setSystemTime(new Date(at(L.drawAt, 90_000)));
    const mine = MeRes.parse(
      await (await call('GET', '/v1/leagues/current/me', { cookie: few[0]!.cookie })).json(),
    ).data;
    expect(mine.placement).toMatchObject({ status: 'dropped', reason: 'capacity' });
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

  it('T-11-418e 다음 시즌 배치: 지난 결산대로 승강, 빈자리는 아래 부 2위부터(스카우트권), 새 팀은 3부부터', async () => {
    const L3 = planLeague(3, '2026-11-25T15:00:00.000Z');
    const t = '2026-11-20T00:00:00.000Z';
    /** 시즌 3 팀과 신청. prev가 있으면 시즌 2 결산 줄도 넣는다. */
    const team3 = async (ovr: number, prev?: { tier: number; rank: number; outcome: string }) => {
      const who = await issueGoogleCookie(ctx, { nickname: `리그${++seq}` });
      const id = `t3-${seq}`;
      await ctx.db.insert(ownerTeams).values({
        id,
        profileId: who.profileId,
        season: 3,
        name: `시즌3팀${seq}`,
        formation: '4-3-3',
        slotsJson: '[]',
        filled: 8,
        ovr,
        createdAt: t,
        updatedAt: t,
      });
      const row = { profileId: who.profileId, status: 'active', createdAt: t, updatedAt: t };
      await ctx.db.insert(leagueEntries).values({ ...row, season: 3 });
      if (prev)
        await ctx.db.insert(leagueEntries).values({
          ...row,
          season: 2,
          tier: prev.tier,
          leagueNo: 1,
          finalRank: prev.rank,
          outcome: prev.outcome,
          rewardedAt: t,
        });
      return { ...who, id };
    };
    const top: Record<number, { profileId: string; id: string }> = {};
    const low: Record<number, { profileId: string; id: string }> = {};
    // 1부 3위는 시즌 3에 신청하지 않았다. 1부 8자리 = 남은 1부 5팀 + 2부 1위, 빈자리 둘(3위 · 강등 두 자리 중 하나).
    for (let r = 1; r <= 8; r++)
      if (r !== 3)
        top[r] = await team3(60, {
          tier: 1,
          rank: r,
          outcome: r === 1 ? 'champion' : r >= 7 ? 'relegated' : 'stayed',
        });
    for (let r = 1; r <= 7; r++)
      low[r] = await team3(50, { tier: 2, rank: r, outcome: r === 1 ? 'promoted' : 'stayed' });
    const star = await team3(99);
    const rookie = await team3(40);

    expect(await runLeague(db(), L3.drawAt, L3)).toMatchObject({ step: 'draw', placed: 16 });
    const rows = await ctx.db.select().from(leagueEntries).where(eq(leagueEntries.season, 3));
    const tierOf = (p: string) => rows.find((r) => r.profileId === p)!.tier;
    for (const r of [1, 2, 4, 5, 6]) expect(tierOf(top[r]!.profileId)).toBe(1);
    expect(tierOf(low[1]!.profileId)).toBe(1);
    // 빈자리 둘은 2부 2 · 3위가 채운다.
    expect([tierOf(low[2]!.profileId), tierOf(low[3]!.profileId)]).toEqual([1, 1]);
    for (const r of [4, 5, 6, 7]) expect(tierOf(low[r]!.profileId)).toBe(2);
    for (const r of [7, 8]) expect(tierOf(top[r]!.profileId)).toBe(2);
    // OVR 99 새 팀도 1부로 바로 가지 않는다(부가 둘뿐이라 2부).
    expect(tierOf(star.profileId)).toBe(2);
    expect(tierOf(rookie.profileId)).toBe(2);
    const scouts = async (p: string) =>
      (
        await ctx.env.DB.prepare(
          `SELECT qty FROM owner_items WHERE profile_id = ? AND item = 'scout'`,
        )
          .bind(p)
          .first<{ qty: number }>()
      )?.qty ?? 0;
    expect([await scouts(low[2]!.profileId), await scouts(low[3]!.profileId)]).toEqual([1, 1]);
    // 1위로 올라간 팀은 결산 때 이미 받았다.
    expect(await scouts(low[1]!.profileId)).toBe(0);
    expect((await notices(low[2]!.profileId)).at(-1)).toMatchObject({
      title: '오프사이드 리그 승격!',
      body: '위 부에 빈자리가 생겨 시즌 3에는 1부에서 뛰어요. 프리미엄 스카우트권 1장을 받았어요.',
    });
  });
});

const eqProfile = (p: string) => eq(ownerTeams.profileId, p);
const eqEntry = (p: string) => eq(leagueEntries.profileId, p);

describe('T-11-430 리그 알림 문구', () => {
  it('기권패 알림 · 빠진 이유 알림을 영어 · 일본어로 옮긴다(라운드 결과 문구와 섞이지 않는다)', () => {
    const ko = cupKo('leagueRoundForfeitBody', { score: 'A 0 : 3 B', n: 1, limit: 3, left: 2 });
    expect(ko).toBe(
      'A 0 : 3 B · 선발 선수가 모자라 기권패했어요. 기권 1/3번, 2번 더 기권하면 남은 경기는 모두 0:3 패예요.',
    );
    expect(cupText(ko, 'en')).toBe(
      'A 0 : 3 B · Forfeited: not enough players in your starting XI. Forfeits 1/3. 2 more and every remaining match is a 0:3 loss.',
    );
    expect(cupText(ko, 'ja')).toContain('棄権1/3回、あと2回');
    expect(cupText(cupKo('leagueRoundBody', { score: 'A 1 : 0 B', rank: 2 }), 'en')).toBe(
      'A 1 : 0 B · Position 2',
    );
    expect(cupText(cupKo('leagueLeftBody', { n: 3 }), 'en')).toContain('enter again next season');
    expect(cupText(cupKo('leagueDroppedBody', { season: 2, n: 8 }), 'ja')).toContain(
      '次のシーズンにまた申し込めます',
    );
  });
});
