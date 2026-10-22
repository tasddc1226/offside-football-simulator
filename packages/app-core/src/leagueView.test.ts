import { LEAGUE_ROUNDS, planLeague } from '@offside/contracts/league';
import { describe, expect, it } from 'vitest';
import type { LeagueMeResponse, LeagueResponse } from './api/league.js';
import type { LeagueMatch, LeagueStanding, LeagueTableResponse } from './api/league.js';
import {
  leagueChoices,
  leagueClinches,
  leagueFinalReady,
  leagueLive,
  leagueRecords,
  leagueCancelled,
  leagueDefaultPick,
  leagueDefaultRound,
  leagueEnterAsk,
  leagueEntryCard,
  leagueEntryRules,
  leagueFinalView,
  leagueLastFinalView,
  leagueLegend,
  leagueOutcomeTone,
  leaguePhaseActive,
  leagueRoundAt,
  leagueRules,
  leagueZoneLabel,
  leagueForfeitsTag,
  leagueLine,
  leaguePlacementLine,
  leagueReadiness,
  leagueRound,
  leagueSchedule,
  leagueTeamAction,
  leagueZone,
} from './leagueView.js';

const plan = planLeague(2, '2026-10-30T15:00:00.000Z');
const league = { ...plan, rounds: [...plan.rounds] };
const data = (phase: LeagueResponse['phase']): LeagueResponse => ({ league, phase, entries: 12 });

describe('leagueView (T-11-418)', () => {
  it('일정은 한국 시간으로 신청 · 배치 · 라운드를 보인다', () => {
    expect(leagueSchedule(league).map((r) => r.text)).toEqual([
      '10월 24일 00:00 ~ 11월 4일 23:59',
      '10월 31일 00:00',
      '11월 5일 09:00',
      '11월 5일 ~ 11월 18일, 매일 13:00',
    ]);
  });
  it('단계마다 배너 한 줄', () => {
    expect(leagueLine(data('soon'))).toBe('10월 24일 00:00부터 신청받아요.');
    expect(leagueLine(data('open'))).toBe('12팀 신청 · 11월 4일 23:59까지');
    expect(leagueLine(data('closed'))).toBe('11월 5일 09:00에 부와 리그 배치를 발표해요.');
  });
  it('준비 상태: 개막 전엔 없음, 팀 없음 · 모자람 · 준비 완료', () => {
    const me = (team: { filled: number } | null) => ({
      entry: null,
      canEnter: true,
      team: team && { teamId: 'tem_1', filled: team.filled, ovr: 80 },
    });
    const before = Date.parse('2026-10-28T00:00:00.000Z');
    const after = Date.parse('2026-11-01T00:00:00.000Z');
    expect(leagueReadiness(data('open'), me(null), before)).toBeNull();
    expect(leagueReadiness(data('open'), me(null), after)?.text).toBe(
      '아직 시즌 2 팀이 없어요. 배치 전까지 팀을 만들고 선발에 내 은퇴 선수 8명을 채워야 리그에 들어가요.',
    );
    expect(leagueReadiness(data('open'), me({ filled: 6 }), after)).toEqual({
      ok: false,
      text: '선발에 내 은퇴 선수가 6/8명이에요. 배치 전까지 8명을 채워야 리그에 들어가요.',
    });
    expect(leagueReadiness(data('open'), me({ filled: 9 }), after)).toEqual({
      ok: true,
      text: '준비 완료 · 선발에 내 은퇴 선수 9명(자격 8명)',
    });
  });

  it('T-11-430 신청 카드: 사전 신청엔 지금 시즌 팀 n/8, 배치 대기에도 준비 상태, 자격 · 기권 규칙, 팀 선발 고치기', () => {
    const before = Date.parse('2026-10-28T00:00:00.000Z');
    const after = Date.parse('2026-11-01T00:00:00.000Z');
    const closedAt = Date.parse('2026-11-04T16:00:00.000Z');
    const me = (o: Partial<LeagueMeResponse>): LeagueMeResponse => ({
      entry: null,
      canEnter: true,
      team: null,
      ...o,
    });
    // 사전 신청: 시즌 2 팀은 아직 없어 지금 시즌 1 팀 선발 수를 참고로 보인다.
    expect(
      leagueReadiness(data('open'), me({ lastTeam: { season: 1, filled: 6 } }), before),
    ).toEqual({
      ok: false,
      text: '지금 시즌 1 팀 선발에 내 은퇴 선수가 6명이에요. 시즌 2 팀은 개막 뒤에 만들고, 배치 전까지 선발에 8명을 채워야 리그에 들어가요.',
    });
    expect(leagueReadiness(data('open'), me({ lastTeam: null }), before)).toBeNull();
    // 접수 마감 뒤 배치 전: 신청했으면 준비 상태를 그대로 보인다(신청 안 했으면 없음).
    const entered = { entry: { createdAt: '2026-11-01T00:00:00.000Z' }, canEnter: false };
    const short = me({ ...entered, team: { teamId: 'tem_1', filled: 7, ovr: 80 } });
    expect(leagueReadiness(data('closed'), short, closedAt)?.text).toBe(
      '선발에 내 은퇴 선수가 7/8명이에요. 배치 전까지 8명을 채워야 리그에 들어가요.',
    );
    expect(
      leagueReadiness(data('closed'), { ...short, entry: null, canEnter: false }, closedAt),
    ).toBeNull();
    expect(leagueReadiness(data('running'), short, closedAt)).toBeNull();
    // 팀 화면 버튼: 신청했고 배치 전(사전 신청 기간 빼고). 팀이 없으면 '팀 만들기'.
    expect(leagueTeamAction(data('closed'), short, closedAt)).toBe('팀 선발 고치기');
    expect(leagueTeamAction(data('open'), short, after)).toBe('팀 선발 고치기');
    expect(leagueTeamAction(data('open'), me({ ...entered }), after)).toBe('팀 만들기');
    expect(leagueTeamAction(data('open'), short, before)).toBeNull();
    expect(leagueTeamAction(data('open'), me({ team: short.team }), after)).toBeNull();
    expect(leagueTeamAction(data('running'), short, closedAt)).toBeNull();
    // 자격 · 기권 규칙은 배치 전에만.
    expect(leagueEntryRules(data('open'))).toEqual([
      '참가 자격: 배치 때 시즌 2 팀 선발에 내 은퇴 선수가 8명 있어야 해요. 모자라면 리그에서 빠져요.',
      '기권: 경기 때 선발에 내 은퇴 선수가 8명보다 적으면 0:3 패예요. 3번 기권하면 남은 경기도 모두 0:3 패가 되고, 다음 시즌은 맨 아래 부에서 시작해요.',
    ]);
    expect(leagueEntryRules(data('soon'))).toHaveLength(2);
    expect(leagueEntryRules(data('running'))).toEqual([]);
  });

  it('T-11-430 빠진 이유: 자격 부족 · 팀 수 조정 · 리그 무산, 진행 중 내 줄에 기권 n/3', () => {
    const dropped = (reason?: 'short' | 'capacity') => ({
      entry: null,
      canEnter: false,
      team: null,
      placement: {
        status: 'dropped' as const,
        tier: null,
        league: null,
        teamId: null,
        rank: null,
        ...(reason ? { reason } : {}),
      },
    });
    expect(leaguePlacementLine(dropped('short'))?.text).toBe(
      '배치 때 선발에 내 은퇴 선수가 모자라 이번 시즌 리그에 들어가지 못했어요. 다음 시즌에 다시 신청할 수 있어요.',
    );
    expect(leaguePlacementLine(dropped('capacity'))?.text).toBe(
      '자격은 갖췄지만 참가 팀 수에 맞춰 리그를 꾸리면서 빠졌어요. 다음 시즌에 다시 신청할 수 있어요.',
    );
    expect(leaguePlacementLine(dropped('capacity'), true)?.text).toBe(
      '참가 팀이 모자라 이번 시즌 리그가 열리지 않았어요. 다음 시즌에 다시 신청할 수 있어요.',
    );
    // 옛 응답(이유 없음)은 자격 탓으로 단정하지 않는다.
    expect(leaguePlacementLine(dropped())?.text).toBe(
      '이번 시즌 리그에 들어가지 못했어요. 다음 시즌에 다시 신청할 수 있어요.',
    );
    expect(leagueCancelled({ tiers: [] })).toBe(true);
    expect(leagueCancelled({ tiers: undefined })).toBe(false);
    const placed = (forfeits?: number) => ({
      entry: null,
      canEnter: false,
      team: null,
      placement: { status: 'placed' as const, tier: 2, league: 1, teamId: 't', rank: 3, forfeits },
    });
    expect(leaguePlacementLine(placed(0))?.text).toBe('2부 1리그 · 지금 3위');
    expect(leaguePlacementLine(placed(2))?.text).toBe('2부 1리그 · 지금 3위 · 기권 2/3');
    expect(leagueForfeitsTag(1)).toBe('기권 1/3');
  });

  it('T-11-418b 배치 뒤: 진행 한 줄 · 내 배치 · 리그 고르기 · 승강권 · 라운드', () => {
    const tiers = [
      { tier: 1, leagues: 1, teams: 8 },
      { tier: 2, leagues: 2, teams: 15 },
    ];
    const running = { ...data('running'), tiers, playedRounds: 3 };
    expect(leagueLine(running)).toBe('14라운드 중 3라운드를 치렀어요.');
    const me = (
      placement: NonNullable<Parameters<typeof leaguePlacementLine>[0]>['placement'],
    ) => ({
      entry: null,
      canEnter: false,
      team: null,
      placement,
    });
    expect(leaguePlacementLine(me(null))).toBeNull();
    expect(
      leaguePlacementLine(me({ status: 'placed', tier: 2, league: 1, teamId: 't', rank: 3 })),
    ).toEqual({ ok: true, text: '2부 1리그 · 지금 3위' });
    expect(
      leaguePlacementLine(
        me({ status: 'dropped', tier: null, league: null, teamId: null, rank: null }),
      )?.ok,
    ).toBe(false);
    expect(leagueChoices(running)).toEqual([
      { tier: 1, league: 1 },
      { tier: 2, league: 1 },
      { tier: 2, league: 2 },
    ]);
    expect(
      leagueDefaultPick(
        running,
        me({ status: 'placed', tier: 2, league: 2, teamId: 't', rank: 1 }),
      ),
    ).toEqual({ tier: 2, league: 2 });
    expect(leagueDefaultPick(running, null)).toEqual({ tier: 1, league: 1 });
    expect(leagueDefaultPick({ tiers: undefined }, null)).toBeNull();
    // 1부 1위는 우승(승격권 아님), 맨 아래 부는 강등권 없음.
    expect([1, 2, 7, 8].map((r) => leagueZone(r, 8, 1, 2))).toEqual([null, null, 'down', 'down']);
    expect([1, 7].map((r) => leagueZone(r, 7, 2, 2))).toEqual(['up', null]);
    expect(leagueDefaultRound(running)).toBe(4);
    expect(leagueDefaultRound({ playedRounds: 14 })).toBe(14);
    const team = (id: string) => ({ teamId: id, name: id, owner: 'o', logo: null, ovr: 80 });
    const table = {
      teams: ['a', 'b', 'c'].map(team),
      matches: [
        {
          id: 'm',
          round: 1,
          homeTeamId: 'a',
          awayTeamId: 'b',
          at: league.rounds[0]!,
          played: false,
          homeGoals: null,
          awayGoals: null,
          forfeit: false,
        },
      ],
    } as unknown as LeagueTableResponse;
    expect(leagueRound(table, 1).resting.map((t) => t.teamId)).toEqual(['c']);
  });

  // T-11-418d 확정 배지 · 기록 · 동시 중계.
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const row = (teamId: string, pts: number, rank: number, forfeits = 0): LeagueStanding => ({
    teamId,
    p: 12,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    pts,
    rank,
    forfeits,
  });
  let mid = 0;
  const match = (
    round: number,
    home: string,
    away: string,
    score: [number, number] | null,
    extra: Partial<LeagueMatch> = {},
  ): LeagueMatch => ({
    id: `m${++mid}`,
    round,
    homeTeamId: home,
    awayTeamId: away,
    at: league.rounds[round - 1]!,
    played: !!score,
    homeGoals: score?.[0] ?? null,
    awayGoals: score?.[1] ?? null,
    forfeit: false,
    ...extra,
  });
  /** 13 · 14라운드를 아직 치르지 않은 8팀(팀마다 2경기 남음). */
  const twoLeft = (pts: number[]) => ({
    standings: ids.map((id, i) => row(id, pts[i]!, i + 1)),
    matches: [13, 14].flatMap((r) => [0, 2, 4, 6].map((i) => match(r, ids[i]!, ids[i + 1]!, null))),
  });

  it('T-11-418d 확정 배지: 따라잡힐 수 없을 때만, 동률은 따라잡힐 수 있는 것으로', () => {
    // a 36 · b 29(최대 35)라 a는 확정. h 4(최대 10)는 위 6팀이 이미 10점보다 많아 강등 확정.
    // g 5(최대 11)는 f 11과 같아질 수 있어 아직 아니다. e 18은 위로 끝날 수 있는 팀이 a ~ d 4팀뿐(f 최대 17)이라 잔류 확정,
    // f 11은 g(최대 11)까지 5팀이 같아지거나 앞설 수 있어 아직 아니다.
    const t = twoLeft([36, 29, 28, 22, 18, 11, 5, 4]);
    const c2 = leagueClinches(t, 2, 3);
    expect(Object.fromEntries(c2)).toEqual({
      a: 'up',
      b: 'safe',
      c: 'safe',
      d: 'safe',
      e: 'safe',
      h: 'down',
    });
    // 1부 1위는 우승 확정, 맨 아래 부는 강등 · 잔류가 없다.
    expect(leagueClinches(t, 1, 3).get('a')).toBe('champion');
    expect(Object.fromEntries(leagueClinches(t, 3, 3))).toEqual({ a: 'up' });
    // 같은 승점까지 따라올 수 있으면 승격 확정이 아니다(잔류만 확정).
    expect(leagueClinches(twoLeft([35, 29, 28, 22, 18, 11, 5, 4]), 2, 3).get('a')).toBe('safe');
    // 기권이 쌓인 팀은 더 오르지 않는다: g(5, 기권 3번)는 h보다 위로 갈 수 없고 f 11보다 아래라 강등 확정.
    const out = twoLeft([36, 29, 28, 22, 18, 11, 5, 4]);
    out.standings[6] = row('g', 5, 7, 3);
    expect(leagueClinches(out, 2, 3).get('g')).toBe('down');
    // 다 끝나면 최종 순위대로.
    const done = {
      standings: ids.map((id, i) => row(id, 30 - i, i + 1)),
      matches: [match(14, 'a', 'b', [1, 0])],
    };
    expect(Object.fromEntries(leagueClinches(done, 2, 3))).toEqual({
      a: 'up',
      b: 'safe',
      c: 'safe',
      d: 'safe',
      e: 'safe',
      f: 'safe',
      g: 'down',
      h: 'down',
    });
  });

  it('T-11-418d 리그 기록: 가장 긴 연승 · 무패(두 경기 이상), 같으면 순위가 높은 팀', () => {
    const t = {
      standings: [row('a', 9, 1), row('b', 5, 2), row('c', 1, 3)],
      matches: [
        match(1, 'a', 'b', [2, 0]),
        match(2, 'c', 'a', [0, 1]),
        match(3, 'a', 'b', [1, 1]),
        match(4, 'b', 'c', [3, 0]),
        match(5, 'b', 'a', [2, 0]),
        match(6, 'c', 'b', [0, 0], { forfeit: true }),
        match(7, 'a', 'c', null),
      ],
    };
    // a: 승 승 무 패 → 연승 2 · 무패 3. b: 패 무 승 승 패(0:0 기권은 둘 다 패) → 연승 2지만 a가 순위가 높다.
    expect(leagueRecords(t)).toEqual({
      winStreak: { teamId: 'a', n: 2 },
      unbeaten: { teamId: 'a', n: 3 },
    });
    expect(leagueRecords({ standings: [row('a', 0, 1)], matches: [] })).toEqual({
      winStreak: null,
      unbeaten: null,
    });
  });

  it('T-11-418d 마지막 라운드 동시 중계: 분마다 스코어와 순위가 움직인다', () => {
    // 13라운드까지 a 3 · b 3 · d 0 · c 0(득실로 a > b > d > c). 14라운드 a-c, b-d. 0분은 0:0 무승부로 센다.
    const before = [match(13, 'a', 'c', [2, 0]), match(13, 'b', 'd', [1, 0])];
    const last = [
      match(LEAGUE_ROUNDS, 'a', 'c', [0, 2], {
        goals: [
          { minute: 30, side: 'away' },
          { minute: 80, side: 'away' },
        ],
      }),
      match(LEAGUE_ROUNDS, 'b', 'd', [1, 0], { goals: [{ minute: 60, side: 'home' }] }),
    ];
    const t = {
      standings: [row('b', 6, 1), row('c', 3, 2), row('a', 3, 3), row('d', 0, 4)],
      matches: [...before, ...last],
    };
    expect(leagueFinalReady(t)).toBe(true);
    expect(leagueFinalReady({ matches: [{ ...last[0]!, goals: undefined }] })).toBe(false);
    const at0 = leagueLive(t, 0);
    expect(at0.rows.map((r) => [r.teamId, r.pts])).toEqual([
      ['a', 4],
      ['b', 4],
      ['d', 1],
      ['c', 1],
    ]);
    const at30 = leagueLive(t, 30);
    expect(at30.scores.get(last[0]!.id)).toEqual({ home: 0, away: 1 });
    expect(at30.rows.map((r) => [r.teamId, r.pts])).toEqual([
      ['b', 4],
      ['a', 3],
      ['c', 3],
      ['d', 1],
    ]);
    // 90분: a · c 승점 · 득실 · 다득점이 같아 최종 순위(c 2위)로 가른다.
    const end = leagueLive(t, 90);
    expect(end.rows.map((r) => r.teamId)).toEqual(['b', 'c', 'a', 'd']);
    expect(end.rows.map((r) => r.move)).toEqual([1, 2, -2, -1]);
  });

  it('T-11-418e 결산: 결과 · 최종 순위 · 받은 보상 · 다음 시즌 부', () => {
    const me = (final: NonNullable<NonNullable<LeagueMeResponse['placement']>['final']>) =>
      ({
        entry: { createdAt: league.opensAt },
        canEnter: false,
        team: null,
        placement: { status: 'placed', tier: 2, league: 3, teamId: 't1', rank: final.rank, final },
      }) as unknown as LeagueMeResponse;
    expect(leagueFinalView(null, 2)).toBeNull();
    expect(
      leagueFinalView(
        me({ rank: 1, outcome: 'promoted', rerolls: 9, scouts: 1, boosts: 1, nextTier: 1 }),
        2,
      ),
    ).toEqual({
      outcome: 'promoted',
      label: '승격',
      line: '2부 3리그 최종 1위',
      reward: '리롤권 9장 · 프리미엄 스카우트권 1장 · 잠재력 강화권 1장',
      next: '다음 시즌에 신청하면 1부에서 시작해요.',
      title: null,
    });
    expect(
      leagueFinalView(
        me({ rank: 8, outcome: 'forfeited', rerolls: 0, scouts: 0, boosts: 0, nextTier: null }),
        2,
      ),
    ).toMatchObject({
      label: '기권 퇴출',
      reward: '보상 없음',
      next: expect.stringContaining('맨 아래'),
    });
  });
});

describe('leagueView (T-11-444)', () => {
  const me = (o: Partial<LeagueMeResponse>): LeagueMeResponse => ({
    entry: null,
    canEnter: false,
    team: null,
    ...o,
  });
  const entry = { createdAt: '2026-11-01T00:00:00.000Z' };

  it('신청 카드 단계별 노출: 계정을 모르면 숨기고, 로그인 안내는 접수 예정 · 접수 중에만', () => {
    expect(leagueEntryCard(data('open'), 'unknown', null)).toEqual({ kind: 'hidden' });
    expect(leagueEntryCard(data('soon'), 'guest', null).kind).toBe('login');
    expect(leagueEntryCard(data('open'), 'guest', null).kind).toBe('login');
    expect(leagueEntryCard(data('running'), 'guest', null)).toEqual({ kind: 'hidden' });
    expect(leagueEntryCard(data('done'), 'guest', null)).toEqual({ kind: 'hidden' });
  });

  it('내 신청을 불러오지 못하면 오류(다시 시도), 불러오는 중이면 숨긴다', () => {
    expect(leagueEntryCard(data('open'), 'member', null, true)).toEqual({
      kind: 'error',
      text: '내 신청 정보를 불러오지 못했어요.',
    });
    expect(leagueEntryCard(data('open'), 'member', null)).toEqual({ kind: 'hidden' });
  });

  it('신청 카드: 접수 중엔 신청 · 취소, 마감 뒤엔 취소할 수 없다고 적고, 배치 뒤엔 배치 줄에 맡긴다', () => {
    expect(leagueEntryCard(data('open'), 'member', me({ canEnter: true }))).toMatchObject({
      kind: 'mine',
      entered: false,
      action: 'enter',
      note: '11월 5일 09:00에 배치를 발표해요. 그때 팀 OVR로 부와 리그가 정해져요.',
    });
    expect(leagueEntryCard(data('open'), 'member', me({ entry }))).toMatchObject({
      entered: true,
      action: 'withdraw',
    });
    expect(leagueEntryCard(data('closed'), 'member', me({ entry }))).toMatchObject({
      entered: true,
      action: null,
      note: '접수가 끝나 신청을 취소할 수 없어요. 11월 5일 09:00에 부와 리그 배치를 발표해요.',
    });
    expect(leagueEntryCard(data('running'), 'member', me({ entry }))).toMatchObject({
      note: '배치 · 대진은 발표 뒤 이 화면에 올라와요.',
    });
    const placed = me({
      entry,
      placement: { status: 'placed', tier: 1, league: 1, teamId: 'tem_1', rank: 2 },
    });
    expect(leagueEntryCard(data('running'), 'member', placed)).toMatchObject({ note: null });
    expect(leagueEntryCard(data('soon'), 'member', me({}))).toMatchObject({
      action: null,
      note: null,
    });
    expect(leagueEntryCard(data('closed'), 'member', me({}))).toMatchObject({
      note: '이번 시즌 리그에 신청하지 않았어요.',
    });
    // 접수 중에만 지금 팀 OVR.
    const team = { teamId: 'tem_1', filled: 8, ovr: 77 };
    expect(leagueEntryCard(data('open'), 'member', me({ entry, team }))).toMatchObject({
      ovr: '지금 내 팀 OVR 77',
    });
    expect(leagueEntryCard(data('closed'), 'member', me({ entry, team }))).toMatchObject({
      ovr: null,
    });
  });

  it('단계 알약 강조는 접수 중 · 진행 중', () => {
    expect((['soon', 'open', 'closed', 'running', 'done'] as const).map(leaguePhaseActive)).toEqual(
      [false, true, false, true, false],
    );
  });

  it('신청 확인: 자격 · 기권 규칙과 취소 마감', () => {
    const ask = leagueEnterAsk(data('open'));
    expect(ask.title).toBe('리그에 신청할까요?');
    expect(ask.lines).toHaveLength(3);
    expect(ask.lines[0]).toContain('참가 자격');
    expect(ask.lines[1]).toContain('기권');
    expect(ask.lines[2]).toBe(
      '11월 4일 23:59까지는 신청을 취소할 수 있어요. 접수가 끝나면 취소할 수 없어요.',
    );
  });

  it('라운드 시각은 날짜와 한국 시간으로', () => {
    expect(leagueRoundAt([{ at: league.rounds[2]! }])).toBe('11월 7일 13:00 한국 시간');
    expect(leagueRoundAt([])).toBeNull();
  });

  it('지난 시즌 결산: 최종 순위 · 결과 · 이번 시즌 시작 부', () => {
    expect(leagueLastFinalView(me({}))).toBeNull();
    const v = leagueLastFinalView(
      me({
        lastFinal: { season: 2, tier: 2, league: 1, rank: 1, outcome: 'promoted', nextTier: 1 },
      }),
    );
    expect(v).toEqual({
      outcome: 'promoted',
      title: '시즌 2 결산',
      label: '승격',
      line: '2부 1리그 최종 1위',
      next: '이번 시즌에 신청하면 1부에서 시작해요.',
    });
    expect(
      leagueLastFinalView(
        me({
          lastFinal: {
            season: 2,
            tier: 3,
            league: 2,
            rank: 8,
            outcome: 'forfeited',
            nextTier: null,
          },
        }),
      )?.next,
    ).toBe('기권이 쌓여 이번 시즌은 맨 아래 부에서 시작해요.');
    expect(leagueOutcomeTone('champion')).toBe('good');
    expect(leagueOutcomeTone('stayed')).toBeNull();
    expect(leagueOutcomeTone('relegated')).toBe('warn');
  });

  it('범례는 부에 맞춰: 부가 하나 · 1부 · 가운데 부 · 맨 아래 부', () => {
    expect(leagueLegend(1, 1)).toEqual({
      up: false,
      down: false,
      move: '부가 하나뿐이라 오르내리는 팀은 없어요. 1위가 우승이에요.',
    });
    expect(leagueLegend(1, 3)).toEqual({
      up: false,
      down: true,
      move: '1위는 우승, 7 · 8위는 다음 시즌 2부로 내려가요.',
    });
    expect(leagueLegend(2, 3).move).toBe(
      '1위는 다음 시즌 1부로 올라가고, 7 · 8위는 3부로 내려가요.',
    );
    expect(leagueLegend(3, 3)).toEqual({
      up: true,
      down: false,
      move: '1위는 다음 시즌 2부로 올라가요. 맨 아래 부라 강등은 없어요.',
    });
  });

  it('내 자리 이름은 확정 배지가 없을 때만, 규칙은 부 · 리그 용어로 시작한다', () => {
    expect(leagueZoneLabel('up', false)).toBe('승격권');
    expect(leagueZoneLabel('down', false)).toBe('강등권');
    expect(leagueZoneLabel('down', true)).toBeNull();
    expect(leagueZoneLabel(null, false)).toBeNull();
    expect(leagueRules().slice(0, 2)).toEqual([
      '부: 실력 단계예요. 1부가 가장 높아요.',
      '리그: 한 부 안에서 7 ~ 8팀씩 나눈 묶음이에요. 아래 부로 갈수록 리그가 많아요.',
    ]);
  });
});
