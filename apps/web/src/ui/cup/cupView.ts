// T-11-145 오프사이드 컵 화면이 쓰는 순수 함수(날짜·라벨·대진 묶기). 문구는 app-core i18n `cup` 네임스페이스.
import {
  CUP_GROUP_ROUNDS,
  CUP_KO_ROUNDS,
  type CupRound,
  type CupStage,
} from '@offside/contracts/cup';
import type { CupMatch, CupResponse, CupTeam } from '@offside/app-core/api/cup';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';

const KST = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface KstParts {
  month: number;
  day: number;
  time: string;
  /** 같은 날인지 비교하는 키(KST). */
  dateKey: string;
}

/** 한국 시간 기준 월·일·시각. */
export function kstParts(iso: string | number): KstParts {
  const p = Object.fromEntries(KST.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return {
    month: Number(p.month),
    day: Number(p.day),
    time: `${p.hour}:${p.minute}`,
    dateKey: `${p.year}-${p.month}-${p.day}`,
  };
}

/** "10월 13일 21:00" (언어에 맞는 표기). */
export function whenText(iso: string): string {
  const p = kstParts(iso);
  return L.dayTime({ month: p.month, day: p.day, time: p.time });
}

/** 접수 마감 표시용: closesAt은 마감 다음날 0시라 1분 앞당겨 "23:59"로 보인다. */
export const closeShownAt = (closesAt: string): string =>
  new Date(Date.parse(closesAt) - 60_000).toISOString();

/** 명단 마감 안내: 마감이 오늘이면 "오늘 20:00", 아니면 "10월 14일 20:00". */
export function lockWhen(lockAtIso: string, now: number): string {
  const p = kstParts(lockAtIso);
  return p.dateKey === kstParts(now).dateKey
    ? L.whenToday({ time: p.time })
    : L.dayTime({ month: p.month, day: p.day, time: p.time });
}

const STAGE: Record<CupStage, () => string> = {
  champion: () => L.stageChampion,
  runnerup: () => L.stageRunnerup,
  sf: () => L.stageSf,
  qf: () => L.stageQf,
  r16: () => L.stageR16,
  r32: () => L.stageR32,
  group: () => L.stageGroup,
};
export const stageLabel = (s: CupStage): string => STAGE[s]();

const ROUND: Record<CupRound, () => string> = {
  g1: () => L.roundG1,
  g2: () => L.roundG2,
  g3: () => L.roundG3,
  r32: () => L.roundR32,
  r16: () => L.roundR16,
  qf: () => L.roundQf,
  sf: () => L.roundSf,
  f: () => L.roundF,
};
export const roundLabel = (r: CupRound): string => ROUND[r]();

export const phaseLabel = (phase: CupResponse['phase']): string =>
  ({
    soon: L.phaseSoon,
    open: L.phaseOpen,
    closed: L.phaseClosed,
    group: L.phaseGroup,
    knockout: L.phaseKnockout,
    done: L.phaseDone,
    cancelled: L.phaseCancelled,
  })[phase];

export const teamMap = (teams: readonly CupTeam[]): Map<string, CupTeam> =>
  new Map(teams.map((t) => [t.teamId, t]));

/** 팀 이름(대진이 아직 안 정해졌으면 "미정"). */
export const teamName = (m: ReadonlyMap<string, CupTeam>, id: string | null): string =>
  id ? (m.get(id)?.name ?? L.tbd) : L.tbd;

/** 토너먼트 라운드별 경기(대진 순서). 경기가 하나도 없는 라운드는 뺀다. */
export function bracketRounds(
  matches: readonly CupMatch[],
): { round: CupRound; matches: CupMatch[] }[] {
  return CUP_KO_ROUNDS.map((round) => ({
    round,
    matches: matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot),
  })).filter((r) => r.matches.length > 0);
}

/** 조별 경기(라운드 순). */
export const groupMatches = (matches: readonly CupMatch[], group: number): CupMatch[] =>
  matches
    .filter((m) => m.group === group && CUP_GROUP_ROUNDS.includes(m.round))
    .sort(
      (a, b) =>
        CUP_GROUP_ROUNDS.indexOf(a.round) - CUP_GROUP_ROUNDS.indexOf(b.round) ||
        a.at.localeCompare(b.at),
    );

/** 그 경기의 명단 마감 시각(대회 일정에서 찾는다). */
export const lockAtOf = (cup: CupResponse['cup'], round: CupRound): string | null =>
  cup.rounds.find((r) => r.round === round)?.lockAt ?? null;

export const involves = (m: CupMatch, teamId: string | null | undefined): boolean =>
  !!teamId && (m.homeTeamId === teamId || m.awayTeamId === teamId);

/** 지금 진행 단계를 한 줄로(토너먼트면 가장 최근에 열린 라운드). */
export function currentKnockoutRound(matches: readonly CupMatch[]): CupRound | null {
  const open = bracketRounds(matches).find((r) => r.matches.some((m) => !m.played));
  return open?.round ?? bracketRounds(matches).at(-1)?.round ?? null;
}

/** 승부차기를 포함한 승자 쪽(무승부·미정이면 null). */
export function winnerSide(m: CupMatch): 'home' | 'away' | null {
  if (!m.played) return null;
  if (m.winnerTeamId) return m.winnerTeamId === m.homeTeamId ? 'home' : 'away';
  if (m.homeGoals === null || m.awayGoals === null || m.homeGoals === m.awayGoals) return null;
  return m.homeGoals > m.awayGoals ? 'home' : 'away';
}

/** 대회 단계별 한 줄 안내. */
export function phaseLine(c: CupResponse): string {
  const names = teamMap(c.teams);
  switch (c.phase) {
    case 'soon':
      return L.soonLine({ at: whenText(c.cup.opensAt) });
    case 'open':
      return L.openLine({
        entries: c.entries,
        cap: c.cup.capacity,
        until: whenText(closeShownAt(c.cup.closesAt)),
      });
    case 'closed':
      return L.closedLine({ at: whenText(c.cup.drawAt) });
    case 'group':
      return L.groupLine({ teams: c.teams.length });
    case 'knockout': {
      const r = currentKnockoutRound(c.matches);
      return L.knockoutLine({ round: r ? roundLabel(r) : L.phaseKnockout });
    }
    case 'done':
      return L.doneLine({ team: teamName(names, c.championTeamId) });
    case 'cancelled':
      return L.cancelledLine;
  }
}
