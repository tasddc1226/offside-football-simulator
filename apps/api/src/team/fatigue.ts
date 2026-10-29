// T-11-571 리그 체력. 직전 리그 경기들의 선발(경기 상세 xi)로 선수마다 연속 선발 수를 세고, 이번 경기 자리 실력을
// 밸런스 leagueFatigue 비율 × 단계만큼 깎는다. 체력을 따로 저장하지 않는다(경기 기록에서 바로 센다). 기획은
// docs/tracking/league-fatigue-plan.md.
import {
  LEAGUE_FATIGUE_FREE,
  LEAGUE_FATIGUE_MAX_STEPS,
  leagueFatiguePenalty,
} from '@offside/contracts/league';
import type { MatchDetail } from '../db/repos/ownerTeams.js';
import type { LineupSlot } from './sim.js';

/** 단계가 끝까지 오르는 데 필요한 만큼만 거슬러 본다(그보다 긴 연속은 단계가 같다). */
export const FATIGUE_LOOKBACK = LEAGUE_FATIGUE_FREE + LEAGUE_FATIGUE_MAX_STEPS - 1;

export type PlayedLeagueMatch = {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  detailJson: string | null;
};

/** 그 경기에서 이 팀의 선발(커리어 id). 기권 · 선발 기록이 없는 경기는 null(쉰 경기로 본다). */
export function xiOf(m: PlayedLeagueMatch, teamId: string): string[] | null {
  if (!m.detailJson) return null;
  try {
    const d = JSON.parse(m.detailJson) as MatchDetail;
    const side = d.home?.teamId === teamId ? d.home : d.away?.teamId === teamId ? d.away : null;
    return side?.xi ? Object.keys(side.xi) : null;
  } catch {
    return null;
  }
}

/**
 * 이 팀이 round 직전까지 연속으로 선발에 든 수(선수별). 바로 앞 라운드부터 FATIGUE_LOOKBACK 라운드를 거슬러 보고, 그 라운드
 * 경기가 없거나(아직 · 기권) 선발에 없으면 거기서 끊긴다.
 */
export function startStreaks(
  played: readonly PlayedLeagueMatch[],
  teamId: string,
  round: number,
): Map<string, number> {
  const rounds: (string[] | null)[] = [];
  for (let r = round - 1; r >= Math.max(1, round - FATIGUE_LOOKBACK); r--) {
    const m = played.find(
      (x) => x.round === r && (x.homeTeamId === teamId || x.awayTeamId === teamId),
    );
    rounds.push(m ? xiOf(m, teamId) : null);
  }
  const out = new Map<string, number>();
  for (const id of rounds[0] ?? []) {
    let n = 0;
    for (const xi of rounds) {
      if (!xi?.includes(id)) break;
      n++;
    }
    out.set(id, n);
  }
  return out;
}

/** 지친 선수의 자리 실력을 깎은 선발(rate가 0이면 그대로). 유스 자리는 그대로다. */
export function withFatigue(
  lineup: readonly LineupSlot[],
  streaks: ReadonlyMap<string, number>,
  rate: number,
): LineupSlot[] {
  if (rate <= 0) return [...lineup];
  return lineup.map((s) => {
    const p = s.careerId ? leagueFatiguePenalty(streaks.get(s.careerId) ?? 0, rate) : 0;
    return p > 0 ? { ...s, rating: Math.round(s.rating * (1 - p)) } : s;
  });
}
