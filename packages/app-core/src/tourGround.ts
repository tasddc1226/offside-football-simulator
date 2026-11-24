// T-11-827 원정 투어 작전 경기의 2D 그라운드. 랭크 경기 문자중계와 같은 말판 움직임(matchGround)을 쓴다. 서버는 구간마다 골만
// 돌려주므로 그 사이 줄은 teamLive.segmentScript가 채운다. 위치와 줄은 연출이고 결과를 바꾸지 않는다. home = 상대(AI 구단), away = 나.
import type { TourMatchView } from '@offside/contracts';
import type { FormationId } from '@offside/contracts/owner-team';
import { GroundPlay } from './matchGround.js';
import { segmentScript, type LiveLine } from './teamLive.js';
import { tourSpan } from './tour.js';

/** 그 경기의 그라운드 상태(두 팀 22명의 기본 자리). */
export const tourGroundPlay = (
  match: Pick<TourMatchView, 'id' | 'formation'>,
  oppFormation: FormationId,
): GroundPlay =>
  new GroundPlay({
    id: match.id,
    home: { formation: oppFormation },
    away: { formation: match.formation },
  });

/**
 * 말판 이름표: 내 선발 11명(그라운드 선수 키 a0~a10)과 상대 구단 선발(h0~h10). 교체로 들어온 선수는 그 자리의 이름이 바뀐다.
 */
export function tourGroundNames(
  slotIds: readonly (string | null)[],
  nameOf: (id: string | null) => string,
  opp: readonly string[] = [],
): Record<string, string> {
  return Object.fromEntries([
    ...slotIds.map((id, i) => [`a${i}`, nameOf(id)] as const),
    ...opp.map((name, i) => [`h${i}`, name] as const),
  ]);
}

/**
 * 방금 끝난 구간(match.done번째)의 중계 줄. oppShare는 상대가 기회를 잡는 몫(0~1) — 상대 실력과 내 선발 평균의 차이로 정한다.
 */
export function tourSegmentLines(
  match: Pick<TourMatchView, 'id' | 'done' | 'events'>,
  team: { opp: string; mine: string },
  name: (id: string | null, fallback: string) => string,
  oppShare = 0.5,
): LiveLine[] {
  return segmentScript(
    match.id,
    match.events,
    { home: team.opp, away: team.mine },
    name,
    tourSpan(match.done - 1),
    oppShare,
  );
}

/** 상대가 기회를 잡는 몫: 실력 차 1마다 2%p(25~75%). */
export const tourOppShare = (opp: number, mine: number): number =>
  Math.min(0.75, Math.max(0.25, 0.5 + (opp - mine) * 0.02));
