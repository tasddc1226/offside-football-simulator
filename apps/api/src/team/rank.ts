import {
  RANK_MATCH_REPICKS,
  rankPoints,
  ratingChange,
  usesRankLadder,
} from '@offside/contracts/owner-team';

// T-11-510 랭크 경기 한 판의 점수 변화와 자동 매칭. 시즌 2부터 RP 사다리(받은 쪽은 깎일 때 절반, 감점은 디비전마다),
// 그 전 시즌은 엘로.

type RankSide = { rating: number; division: number };

export function matchRatingChange(
  season: number,
  home: RankSide,
  away: RankSide,
  score: 0 | 0.5 | 1,
  meetings: number,
): { home: number; away: number } {
  if (!usesRankLadder(season)) return ratingChange(home.rating, away.rating, score, meetings);
  return {
    home: rankPoints(home.rating, away.rating, score, home.division),
    away: rankPoints(away.rating, home.rating, (1 - score) as 0 | 0.5 | 1, away.division, true),
  };
}

/** 자동 매칭 후보 수(가까운 순)와 경기 시작 때 다시 확인하는 여유 범위. 한 경기마다 다른 상대를 고를 수 있는 횟수. */
export const MATCH_POOL = 8;
export const MATCH_POOL_CHECK = 12;
export const MATCH_REPICKS = RANK_MATCH_REPICKS;

type Candidate = { id: string; rating: number; ovr: number };

/** 가까운 순 후보: |RP 차| + 2 × |OVR 차|가 작은 팀부터(같으면 id 순). */
export function nearestCandidates<T extends Candidate>(
  list: readonly T[],
  mine: { rating: number; ovr: number },
  n: number,
): T[] {
  const gap = (t: T) => Math.abs(t.rating - mine.rating) + 2 * Math.abs(t.ovr - mine.ovr);
  return [...list].sort((a, b) => gap(a) - gap(b) || (a.id < b.id ? -1 : 1)).slice(0, n);
}

/** 문자열 시드로 후보 하나를 고른다(같은 시드면 같은 상대). */
export function pickCandidate<T>(list: readonly T[], seed: string): T | undefined {
  if (!list.length) return undefined;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return list[(h >>> 0) % list.length];
}
