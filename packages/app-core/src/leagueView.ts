// T-11-418 오프사이드 리그 화면 규칙(웹 · 앱 공통): 단계 이름, 배너 한 줄, 일정 줄, 신청 불가 이유. 날짜는 한국 시간이다.
import { KST_MS } from '@offside/contracts/kst';
import {
  LEAGUE_FORFEIT_GOALS,
  LEAGUE_FORFEIT_LIMIT,
  LEAGUE_ROUNDS,
  LEAGUE_SIZE,
} from '@offside/contracts/league';
import type {
  LeagueMatch,
  LeagueMeResponse,
  LeagueResponse,
  LeagueStanding,
  LeagueTableResponse,
} from './api/league.js';
import { cupText as C } from './i18n/ko/cup';
import { leagueText as L } from './i18n/ko/league';

type Phase = LeagueResponse['phase'];

const kst = (iso: string) => {
  const d = new Date(Date.parse(iso) + KST_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate(), time: `${hh}:${mm}` };
};

/** "11월 5일 13:00"(한국 시간). */
export const leagueWhen = (iso: string) => C.dayTime(kst(iso));
/** "11월 5일"(한국 시간). */
const leagueDate = (iso: string) => L.date(kst(iso));
/** 접수 마감 표시: closesAt은 마감 다음날 0시라 1분 앞당겨 "23:59"로 보인다. */
export const leagueUntil = (closesAt: string) =>
  leagueWhen(new Date(Date.parse(closesAt) - 60_000).toISOString());

export const leaguePhaseLabel = (phase: Phase) =>
  ({
    soon: L.phaseSoon,
    open: L.phaseOpen,
    closed: L.phaseClosed,
    running: L.phaseRunning,
    done: L.phaseDone,
  })[phase];

/** 배너 · 화면 머리의 한 줄. */
export function leagueLine(data: LeagueResponse): string {
  const l = data.league;
  switch (data.phase) {
    case 'soon':
      return L.soonLine({ at: leagueWhen(l.opensAt) });
    case 'open':
      return L.openLine({ entries: data.entries, until: leagueUntil(l.closesAt) });
    case 'closed':
      return L.closedLine({ at: leagueWhen(l.drawAt) });
    case 'running':
      return data.playedRounds
        ? L.runningRounds({ n: data.playedRounds, total: LEAGUE_ROUNDS })
        : L.runningLine;
    case 'done':
      return L.doneLine;
  }
}

/** 일정 세 줄(신청 · 배치 · 라운드). */
export function leagueSchedule(l: LeagueResponse['league']) {
  const first = l.rounds[0];
  const last = l.rounds.at(-1);
  return [
    {
      label: L.scheduleEntry,
      text: L.range({ from: leagueWhen(l.opensAt), to: leagueUntil(l.closesAt) }),
    },
    { label: L.scheduleSeason({ season: l.season }), text: leagueWhen(l.startsAt) },
    { label: L.scheduleDraw, text: leagueWhen(l.drawAt) },
    ...(first && last
      ? [
          {
            label: L.scheduleRounds,
            text: L.daily({ from: leagueDate(first), to: leagueDate(last), time: kst(first).time }),
          },
        ]
      : []),
  ];
}

/** 규칙 목록(화면 순서). */
export const leagueRules = () => [
  L.ruleEntry,
  L.ruleTiers,
  L.rulePoints,
  L.ruleMove,
  L.ruleLock,
  L.ruleForfeit,
  L.ruleReward,
];

/** 홈 배너를 보일지: 리그가 끝나면 숨긴다. */
export const leagueOnHome = (data: Pick<LeagueResponse, 'phase'>) => data.phase !== 'done';

/** 개막 전 사전 신청 기간인가. */
export const leaguePresign = (data: LeagueResponse, now = Date.now()) =>
  data.phase === 'open' && now < Date.parse(data.league.startsAt);

/**
 * 배치 준비 상태 한 줄(배치 때 그 시즌 팀 선발 실카드 수로 자격을 본다). 개막 전이라 그 시즌 팀을 아직 만들 수 없거나,
 * 접수가 끝났으면 null.
 */
export function leagueReadiness(
  data: LeagueResponse,
  me: LeagueMeResponse | null,
  now = Date.now(),
): { ok: boolean; text: string } | null {
  if (!me || data.phase !== 'open' || leaguePresign(data, now)) return null;
  const min = data.league.minFilled;
  if (!me.team) return { ok: false, text: L.readyNoTeam({ season: data.league.season, min }) };
  return me.team.filled >= min
    ? { ok: true, text: L.readyOk({ filled: me.team.filled }) }
    : { ok: false, text: L.readyShort({ filled: me.team.filled, min }) };
}

// ───────── T-11-418b 배치 뒤 ─────────

/** 내 배치 한 줄(배치 전 · 신청 없음은 null). */
export function leaguePlacementLine(
  me: LeagueMeResponse | null,
): { ok: boolean; text: string } | null {
  const p = me?.placement;
  if (!p) return null;
  if (p.status === 'dropped') return { ok: false, text: L.droppedLine };
  if (p.status === 'forfeited') return { ok: false, text: L.forfeitedLine };
  const at = { tier: p.tier ?? 1, league: p.league ?? 1 };
  return {
    ok: true,
    text: p.rank ? L.placedLine({ ...at, rank: p.rank }) : L.leagueName(at),
  };
}

/** T-11-418e 내 결산(14라운드 뒤). 결과 알약 · 최종 순위 · 받은 보상 · 다음 시즌 부 · 1부 우승 칭호 줄. 결산 전은 null. */
export function leagueFinalView(me: LeagueMeResponse | null, season: number) {
  const p = me?.placement;
  const f = p?.final;
  if (!p || !f) return null;
  const outcome = {
    champion: L.outcomeChampion,
    promoted: L.outcomePromoted,
    stayed: L.outcomeStayed,
    relegated: L.outcomeRelegated,
    forfeited: L.outcomeForfeited,
  }[f.outcome];
  const reward = [
    ...(f.rerolls ? [L.rewardReroll({ n: f.rerolls })] : []),
    ...(f.scouts ? [L.rewardScout({ n: f.scouts })] : []),
    ...(f.boosts ? [L.rewardBoost({ n: f.boosts })] : []),
  ];
  return {
    outcome: f.outcome,
    label: outcome,
    line: L.finalLine({ tier: p.tier ?? 1, league: p.league ?? 1, rank: f.rank }),
    reward: reward.length ? reward.join(' · ') : L.rewardNone,
    next: f.nextTier === null ? L.finalNextBottom : L.finalNext({ tier: f.nextTier }),
    title: f.outcome === 'champion' ? L.finalChampionTitle({ season }) : null,
  };
}
export type LeagueFinalView = NonNullable<ReturnType<typeof leagueFinalView>>;

export type LeaguePick = { tier: number; league: number };

/** 고를 수 있는 리그(1부 1리그부터). */
export const leagueChoices = (data: Pick<LeagueResponse, 'tiers'>): LeaguePick[] =>
  (data.tiers ?? []).flatMap((t) =>
    Array.from({ length: t.leagues }, (_, i) => ({ tier: t.tier, league: i + 1 })),
  );

/** 처음 보여 줄 리그: 내 리그, 없으면 1부 1리그. 배치 전이면 null. */
export function leagueDefaultPick(
  data: Pick<LeagueResponse, 'tiers'>,
  me: LeagueMeResponse | null,
): LeaguePick | null {
  const p = me?.placement;
  if (p && p.status !== 'dropped' && p.tier && p.league) return { tier: p.tier, league: p.league };
  return leagueChoices(data)[0] ?? null;
}

/**
 * 순위 칸의 표시: 1위는 승격권(1부는 우승), 7 · 8위는 강등권(맨 아래 부는 내려갈 곳이 없다). 7팀 리그는 7위만 강등권.
 * 승강 확정 규칙은 시즌 결산(4차)에서 정한다 — 여기선 지금 순위로 칠만 한다.
 */
export function leagueZone(
  rank: number,
  size: number,
  tier: number,
  bottomTier: number,
): 'up' | 'down' | null {
  if (rank === 1 && tier > 1) return 'up';
  if (tier < bottomTier && rank >= LEAGUE_SIZE - 1 && rank <= size) return 'down';
  return null;
}

/** 처음 보여 줄 라운드: 다음에 치를 라운드(다 끝났으면 마지막). */
export const leagueDefaultRound = (data: Pick<LeagueResponse, 'playedRounds'>) =>
  Math.min(LEAGUE_ROUNDS, (data.playedRounds ?? 0) + 1);

/** 한 라운드의 경기와 쉬는 팀(7팀 리그). */
export function leagueRound(table: LeagueTableResponse, round: number) {
  const matches = table.matches.filter((m) => m.round === round);
  const playing = new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]));
  return { matches, resting: table.teams.filter((t) => !playing.has(t.teamId)) };
}

/** 경기 줄의 가운데: 끝났으면 스코어, 아니면 시각(KST HH:MM). */
export const leagueMatchMid = (m: LeagueMatch) =>
  m.played ? `${m.homeGoals ?? 0} : ${m.awayGoals ?? 0}` : kst(m.at).time;

// ───────── T-11-418d 확정 배지 · 리그 기록 · 마지막 라운드 동시 중계 ─────────

export type LeagueClinch = 'champion' | 'up' | 'safe' | 'down';

/** 강등권이 시작하는 순위(7위). 7팀 리그도 7위 한 팀만 강등권이다. */
const DOWN_FROM = LEAGUE_SIZE - 1;

/**
 * 남은 경기로 바뀔 수 없는 자리(우승 · 승격 · 잔류 · 강등 확정). 동률은 가르는 규칙(득실 · 다득점 …)을 미리 알 수 없어 따라잡힐
 * 수 있는 것으로 친다 — 그래서 확정이 실제보다 늦게 붙을 수는 있어도 틀리게 붙지는 않는다. 남은 경기에서 서로 맞붙는 두 팀이
 * 둘 다 이기는 경우도 셈에 넣으니 마찬가지로 보수적이다. 기권이 쌓여 남은 경기가 모두 기권패인 팀은 더 오르지 않는다.
 * 모든 경기가 끝나면 최종 순위대로 붙는다. 잔류는 강등이 있는 부(맨 아래 부가 아닌 곳)에만, 승격은 1부가 아닌 곳에만 붙는다.
 */
export function leagueClinches(
  table: Pick<LeagueTableResponse, 'standings' | 'matches'>,
  tier: number,
  bottomTier: number,
): Map<string, LeagueClinch> {
  const left = new Map<string, number>();
  for (const m of table.matches)
    if (!m.played)
      for (const id of [m.homeTeamId, m.awayTeamId]) left.set(id, (left.get(id) ?? 0) + 1);
  const done = left.size === 0;
  const max = (s: LeagueStanding) =>
    s.forfeits >= LEAGUE_FORFEIT_LIMIT ? s.pts : s.pts + 3 * (left.get(s.teamId) ?? 0);
  const relegation = tier < bottomTier;
  const out = new Map<string, LeagueClinch>();
  for (const s of table.standings) {
    const others = table.standings.filter((o) => o.teamId !== s.teamId);
    // 나보다 위로 끝날 수 있는 팀 수 · 반드시 위로 끝나는 팀 수.
    const best = done ? s.rank - 1 : others.filter((o) => max(o) >= s.pts).length;
    const worst = done ? s.rank - 1 : others.filter((o) => o.pts > max(s)).length;
    if (best === 0) out.set(s.teamId, tier === 1 ? 'champion' : 'up');
    else if (relegation && worst >= DOWN_FROM - 1) out.set(s.teamId, 'down');
    else if (relegation && best <= DOWN_FROM - 2) out.set(s.teamId, 'safe');
  }
  return out;
}

type Outcome = 'w' | 'd' | 'l';

/** 한 팀 쪽에서 본 끝난 경기 결과. 둘 다 기권한 경기(0:0으로 남는다)는 둘 다 패다. */
function outcomeOf(m: LeagueMatch, teamId: string): Outcome {
  const home = m.homeTeamId === teamId;
  const mine = (home ? m.homeGoals : m.awayGoals) ?? 0;
  const theirs = (home ? m.awayGoals : m.homeGoals) ?? 0;
  if (m.forfeit && mine === theirs) return 'l';
  return mine > theirs ? 'w' : mine < theirs ? 'l' : 'd';
}

export type LeagueRun = { teamId: string; n: number };

/**
 * 리그 기록: 가장 긴 연승 · 가장 긴 무패(라운드 순, 쉬는 라운드는 끊지 않는다). 두 경기 이상일 때만 싣고, 같으면 지금 순위가
 * 높은 팀.
 */
export function leagueRecords(table: Pick<LeagueTableResponse, 'standings' | 'matches'>): {
  winStreak: LeagueRun | null;
  unbeaten: LeagueRun | null;
} {
  const played = table.matches.filter((m) => m.played).sort((a, b) => a.round - b.round);
  const byRank = [...table.standings].sort((a, b) => a.rank - b.rank);
  let winStreak: LeagueRun | null = null;
  let unbeaten: LeagueRun | null = null;
  for (const s of byRank) {
    let w = 0;
    let u = 0;
    let bestW = 0;
    let bestU = 0;
    for (const m of played) {
      if (m.homeTeamId !== s.teamId && m.awayTeamId !== s.teamId) continue;
      const o = outcomeOf(m, s.teamId);
      w = o === 'w' ? w + 1 : 0;
      u = o === 'l' ? 0 : u + 1;
      bestW = Math.max(bestW, w);
      bestU = Math.max(bestU, u);
    }
    if (bestW >= 2 && bestW > (winStreak?.n ?? 0)) winStreak = { teamId: s.teamId, n: bestW };
    if (bestU >= 2 && bestU > (unbeaten?.n ?? 0)) unbeaten = { teamId: s.teamId, n: bestU };
  }
  return { winStreak, unbeaten };
}

/** 마지막 라운드 동시 중계를 열 수 있는가: 그 라운드를 다 치렀고 골 시각이 실려 있다. */
export function leagueFinalReady(table: Pick<LeagueTableResponse, 'matches'>) {
  const last = table.matches.filter((m) => m.round === LEAGUE_ROUNDS);
  return last.length > 0 && last.every((m) => m.played && (m.forfeit || m.goals));
}

/** 동시 중계 시계의 끝(분). */
export const LEAGUE_LIVE_END = 90;

export type LeagueLiveRow = LeagueStanding & { move: number };

/**
 * 동시 중계의 minute분 상황: 마지막 라운드 경기마다 그때까지의 스코어와, 그 스코어로 다시 센 순위표. 마지막 라운드 전 순위에서
 * 몇 칸 움직였는지(move, 위로 +)도 붙인다. 기권 경기는 처음부터 결과대로다. 같은 승점은 득실 · 다득점, 그다음은 최종 순위로
 * 가른다(승자승 · 추첨은 화면에서 다시 세지 않는다).
 */
export function leagueLive(
  table: Pick<LeagueTableResponse, 'standings' | 'matches'>,
  minute: number,
) {
  const last = table.matches.filter((m) => m.round === LEAGUE_ROUNDS);
  const scores = new Map(
    last.map((m) => {
      if (m.forfeit || !m.goals) return [m.id, { home: m.homeGoals ?? 0, away: m.awayGoals ?? 0 }];
      const upTo = m.goals.filter((g) => g.minute <= minute);
      return [
        m.id,
        {
          home: upTo.filter((g) => g.side === 'home').length,
          away: upTo.filter((g) => g.side === 'away').length,
        },
      ];
    }),
  );
  const finalRank = new Map(table.standings.map((s) => [s.teamId, s.rank]));
  const count = (withLast: boolean) => {
    const rows = new Map(
      table.standings.map((s) => [
        s.teamId,
        { ...s, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, rank: 0 },
      ]),
    );
    for (const m of table.matches) {
      if (!m.played) continue;
      const live = m.round === LEAGUE_ROUNDS;
      if (live && !withLast) continue;
      const sc = live ? scores.get(m.id)! : { home: m.homeGoals ?? 0, away: m.awayGoals ?? 0 };
      const view = { ...m, homeGoals: sc.home, awayGoals: sc.away };
      for (const [id, gf, ga] of [
        [m.homeTeamId, sc.home, sc.away],
        [m.awayTeamId, sc.away, sc.home],
      ] as const) {
        const r = rows.get(id);
        if (!r) continue;
        // 둘 다 기권하면 서로 0:3으로 진 것으로 센다(서버 순위표와 같다).
        const bothOut = m.forfeit && sc.home === sc.away;
        const o = outcomeOf(view, id);
        r.p++;
        r.gf += bothOut ? 0 : gf;
        r.ga += bothOut ? LEAGUE_FORFEIT_GOALS : ga;
        if (o === 'w') r.w++;
        else if (o === 'd') r.d++;
        else r.l++;
        r.pts += o === 'w' ? 3 : o === 'd' ? 1 : 0;
      }
    }
    const sorted = [...rows.values()].sort(
      (a, b) =>
        b.pts - a.pts ||
        b.gf - b.ga - (a.gf - a.ga) ||
        b.gf - a.gf ||
        finalRank.get(a.teamId)! - finalRank.get(b.teamId)!,
    );
    sorted.forEach((r, i) => (r.rank = i + 1));
    return sorted;
  };
  const before = new Map(count(false).map((r) => [r.teamId, r.rank]));
  const rows: LeagueLiveRow[] = count(true).map((r) => ({
    ...r,
    move: before.get(r.teamId)! - r.rank,
  }));
  return { scores, rows };
}
