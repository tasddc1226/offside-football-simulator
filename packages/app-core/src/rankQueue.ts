// T-11-603 랭크 매칭 큐(웹 team/TeamRankQueue · TeamRankInfo, 앱 screens/owner/TeamRankQueue · TeamRankInfo)가 함께 쓰는 규칙.
// 상대는 서버가 바로 고른다. 찾는 시간은 연출이라 화면이 정하고, 경기 결과나 상대에는 영향을 주지 않는다.
import { kstDay } from '@offside/contracts/kst';
import { RANK_REPICKS_DAILY, rankPoints } from '@offside/contracts/owner-team';
import { clampDivision, nextDivision, type DivisionRules } from '@offside/contracts/team-division';
import type { TeamMatch, TeamRecord } from './api/team.js';
import { teamMatchText as L } from './i18n/ko/teamMatch.js';
import { currentDivisionRules, divisionName } from './teamDivision.js';

/** 찾는 화면을 보여 주는 시간(ms). 매번 다르고 짧은 쪽이 더 자주 나온다(하루 10경기를 매번 오래 기다리지 않게). 10초를 넘지 않는다.
 * 다시 찾기는 더 짧고, 움직임 줄이기면 잠깐만 보여 준다. */
export function queueWaitMs(
  opts: { repick?: boolean; motionOK?: boolean } = {},
  rng: () => number = Math.random,
): number {
  if (opts.motionOK === false) return 700;
  const [min, max] = opts.repick ? [1500, 5000] : [3000, 9800];
  return Math.round(min + (max - min) * rng() ** 2);
}

/** 찾은 시간 표시(00:03). */
export const queueClock = (sec: number): string => {
  const s = Math.max(0, Math.trunc(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** 찾는 동안 지나간 시간에 맞는 안내 문구. */
export const queueStep = (sec: number): string =>
  [L.queueStep0, L.queueStep1, L.queueStep2][Math.min(2, Math.floor(Math.max(0, sec) / 2))]!;

export type FormPip = 'w' | 'd' | 'l';

/** 최근 랭크 경기(최신 먼저, 친선전 제외). */
export const recentRanked = (matches: readonly TeamMatch[], n = 5): TeamMatch[] =>
  matches.filter((m) => !m.friendly).slice(0, n);

/** 랭크 경기들의 결과. */
export function recentForm(matches: readonly TeamMatch[], n = 5): FormPip[] {
  return recentRanked(matches, n).map((m) => {
    const me = m.mine === 'home' ? m.home.goals : m.away.goals;
    const opp = m.mine === 'home' ? m.away.goals : m.home.goals;
    return me > opp ? 'w' : me < opp ? 'l' : 'd';
  });
}

/** 지금 이어지는 연승 · 연패 문구(2경기부터). */
export function formStreak(form: readonly FormPip[]): string | null {
  const first = form[0];
  if (!first || first === 'd') return null;
  const end = form.findIndex((p) => p !== first);
  const n = end < 0 ? form.length : end;
  if (n < 2) return null;
  return first === 'w' ? L.infoStreakWin({ n }) : L.infoStreakLoss({ n });
}

/** 시즌 승률(%). 치른 경기가 없으면 null. */
export function winRate(r: TeamRecord): number | null {
  const played = r.w + r.d + r.l;
  return played ? Math.round((r.w / played) * 100) : null;
}

export type RankStakes = {
  win: number;
  draw: number;
  loss: number;
  /** 이 경기로 디비전이 바뀌면 그 안내(이기면 승격 · 지면 강등). */
  promote: string | null;
  relegate: string | null;
};

/** 상대를 건 내 팀이 이 경기로 얻고 잃는 RP(서버 matchRatingChange의 건 쪽과 같은 식)와 디비전 변화. */
export function rankStakes(
  me: { rating: number; division?: number | undefined },
  oppRating: number,
  rules: DivisionRules = currentDivisionRules(),
): RankStakes {
  const d = clampDivision(me.division ?? 0);
  const win = rankPoints(me.rating, oppRating, 1, d);
  const draw = rankPoints(me.rating, oppRating, 0.5, d);
  const loss = rankPoints(me.rating, oppRating, 0, d);
  const up = nextDivision(me.rating + win, d, rules);
  const down = nextDivision(me.rating + loss, d, rules);
  return {
    win,
    draw,
    loss,
    promote: up > d ? L.stakesPromote({ name: divisionName(up) }) : null,
    relegate: down < d ? L.stakesRelegate({ name: divisionName(down) }) : null,
  };
}

// T-11-701 다른 상대 찾기 하루 횟수. 서버는 광고 시청을 확인할 수 없어 이 기기에만 센다(ad-reroll과 같은 방식).
type RepickLog = { day: string; n: number };

function parseRepicks(raw: string | null | undefined): RepickLog | null {
  try {
    const v = JSON.parse(raw ?? '') as Partial<RepickLog>;
    return typeof v.day === 'string' && Number.isInteger(v.n) ? { day: v.day, n: v.n! } : null;
  } catch {
    return null;
  }
}

/** 오늘 남은 다른 상대 찾기 횟수. 기록이 없거나 다른 날이면 하루치 전부. */
export function repicksLeft(raw: string | null | undefined, now = new Date()): number {
  const log = parseRepicks(raw);
  const used = log && log.day === kstDay(now.toISOString()) ? log.n : 0;
  return Math.max(0, RANK_REPICKS_DAILY - used);
}

/** 한 번 찾은 뒤 저장할 값. */
export function spendRepick(raw: string | null | undefined, now = new Date()): string {
  const n = RANK_REPICKS_DAILY - repicksLeft(raw, now) + 1;
  return JSON.stringify({ day: kstDay(now.toISOString()), n });
}
