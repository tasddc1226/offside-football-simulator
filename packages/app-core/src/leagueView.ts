// T-11-418 오프사이드 리그 화면 규칙(웹 · 앱 공통): 단계 이름, 배너 한 줄, 일정 줄, 신청 불가 이유. 날짜는 한국 시간이다.
import { KST_MS } from '@offside/contracts/kst';
import { LEAGUE_ROUNDS, LEAGUE_SIZE } from '@offside/contracts/league';
import type {
  LeagueMatch,
  LeagueMeResponse,
  LeagueResponse,
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
