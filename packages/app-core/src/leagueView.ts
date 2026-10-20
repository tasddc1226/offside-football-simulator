// T-11-418 오프사이드 리그 화면 규칙(웹 · 앱 공통): 단계 이름, 배너 한 줄, 일정 줄, 신청 불가 이유. 날짜는 한국 시간이다.
import { KST_MS } from '@offside/contracts/kst';
import type { LeagueMeResponse, LeagueResponse } from './api/league.js';
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
      return L.runningLine;
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
