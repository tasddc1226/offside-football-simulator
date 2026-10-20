// T-11-418 오프사이드 리그. 시즌마다 신청한 구단을 8팀 리그로 나눠 홈 · 원정 두 번씩 14라운드를 치르고, 순위로 다음
// 시즌 부(1부 · 2부 …)가 오르내린다. 기획은 docs/tracking/offside-league-plan.md. 시각은 모두 UTC ISO.
// zod 없는 서브패스(`@offside/contracts/league`) — API 모양은 league-api.ts.
import { DAY_MS, KST_MS, kstDay } from './kst.js';
import { SEASON_GAUGE } from './season-gauge.js';
import { SERVICE_SEASONS, type ServiceSeason } from './service-seasons.js';

/** 리그를 여는 첫 시즌. */
export const LEAGUE_FROM_SEASON = 2;
/** 리그 하나의 팀 수. */
export const LEAGUE_SIZE = 8;
/** 라운드 수(같은 리그 7팀과 홈 · 원정 한 번씩). */
export const LEAGUE_ROUNDS = (LEAGUE_SIZE - 1) * 2;

/**
 * 시즌 일정의 기본값: 개막 7일 전(앞 시즌 막바지)부터 사전 신청을 받고, 개막 뒤 5일은 새 시즌 팀을 꾸리며 계속 받는다.
 * 마감일 09:00에 그때 팀으로 자격을 보고 배치, 그날부터 매일 13:00(KST)에 한 라운드. 새 시즌 팀은 지난 시즌 선수를
 * 제한(와일드카드 · 급여 예산) 안에서만 쓰고 나머지는 그 시즌 카드로 채워야 해서, 개막 바로 경기하지 않고 팀을 꾸릴 날을 둔다.
 */
export const LEAGUE_PLAN_DEFAULTS = {
  presignDays: 7,
  entryDays: 5,
  drawHour: 9,
  matchHour: 13,
  /** 참가 자격: 선발에 든 실제 선수 수. */
  minFilled: 8,
} as const;

export interface LeagueDef {
  /** 서비스 시즌(이 시즌 팀만 참가). 시즌마다 리그 일정 하나. */
  season: number;
  /** 그 시즌 개막. 이보다 앞선 신청은 사전 신청이다. */
  startsAt: string;
  opensAt: string;
  closesAt: string;
  /** 배치 · 대진 발표. */
  drawAt: string;
  /** 라운드별 경기 시각(1라운드부터). */
  rounds: readonly string[];
  minFilled: number;
}

/**
 * 개막 시각 하나로 리그 일정을 만든다. 접수는 개막 presignDays일 전 00:00(KST)부터 개막 entryDays일 뒤 00:00까지, 배치는
 * 그날 drawHour시, 라운드는 그날부터 하루 한 라운드 matchHour시. 시즌 2(10/31 00:00 개막) = 접수 10/24~11/4,
 * 배치 11/5 09:00, 경기 11/5~11/18 13:00.
 */
export function planLeague(season: number, startsAt: string): LeagueDef {
  const d = LEAGUE_PLAN_DEFAULTS;
  // 개막한 날(KST) 00:00을 기준으로 날짜를 센다.
  const base = Date.parse(`${kstDay(startsAt)}T00:00:00.000Z`) - KST_MS;
  const at = (day: number, hour: number) =>
    new Date(base + day * DAY_MS + hour * 3_600_000).toISOString();
  return {
    season,
    startsAt,
    opensAt: at(-d.presignDays, 0),
    closesAt: at(d.entryDays, 0),
    drawAt: at(d.entryDays, d.drawHour),
    rounds: Array.from({ length: LEAGUE_ROUNDS }, (_, i) => at(d.entryDays + i, d.matchHour)),
    minFilled: d.minFilled,
  };
}

/**
 * T-11-418c 아직 시즌 일정에 오르지 않은 다음 시즌(잠정). 다음 시즌은 지금 시즌 게이지가 마감을 확정해야 일정에 오르는데,
 * 사전 신청은 그 전에 열어야 한다 — 마감이 아직 없으면 지금 시즌의 최대 기간 끝(개막 + maxDays)을 잠정 개막으로 쓴다.
 * 게이지가 먼저 차 마감이 당겨지면 일정에 오른 실제 개막으로 리그 일정도 함께 당겨진다(신청은 시즌 번호로 남는다).
 */
export function provisionalNextSeason(started: ServiceSeason | undefined): ServiceSeason | null {
  if (!started) return null;
  const startsAt =
    started.endsAt ??
    new Date(Date.parse(started.startsAt) + SEASON_GAUGE.maxDays * DAY_MS).toISOString();
  // 이름은 화면에 쓰지 않는다(리그 일정 계산에만 쓴다).
  return { ...started, id: started.id + 1, name: '', startsAt, endsAt: null };
}

/**
 * now에 보여 줄 리그의 시즌: 개막한 시즌 중 가장 최근(리그를 여는 시즌부터)의 리그가 아직 끝나지 않았으면 그 시즌, 아니면
 * 다음 시즌(일정에 없으면 잠정 다음 시즌). 리그를 여는 시즌이 아직 없으면 null.
 */
export function leagueSeasonAt(
  now: string,
  seasons: readonly ServiceSeason[] = SERVICE_SEASONS,
): ServiceSeason | null {
  const started = seasons.filter((s) => s.startsAt <= now).at(-1);
  const next = seasons.find((s) => s.startsAt > now) ?? provisionalNextSeason(started);
  const cur = started && started.id >= LEAGUE_FROM_SEASON ? started : null;
  const upcoming = next && next.id >= LEAGUE_FROM_SEASON ? next : null;
  if (cur && (!upcoming || leaguePhase(planLeague(cur.id, cur.startsAt), now) !== 'done'))
    return cur;
  return upcoming;
}

export const leagueFinalAt = (l: LeagueDef) => l.rounds.at(-1)!;

/** 끝난 리그를 '지난 시즌 리그'로 보여 주는 동안(마지막 라운드 뒤 하루)은 'running'으로 둔다 — 결산이 그 안에 끝난다. */
export const LEAGUE_AFTERGLOW_MS = DAY_MS;

export type LeaguePhase = 'soon' | 'open' | 'closed' | 'running' | 'done';

/** 접수 전 · 접수 중 · 배치 기다림 · 라운드 진행 · 끝. */
export function leaguePhase(l: LeagueDef, now: string): LeaguePhase {
  if (now < l.opensAt) return 'soon';
  if (now < l.closesAt) return 'open';
  if (now < l.drawAt) return 'closed';
  if (Date.parse(now) < Date.parse(leagueFinalAt(l)) + LEAGUE_AFTERGLOW_MS) return 'running';
  return 'done';
}
