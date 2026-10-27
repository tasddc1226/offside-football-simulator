// T-11-441 팀 · 업적 랭킹의 '내 순위로'. 웹 · 앱이 같은 판정을 쓴다.
// 서버는 me=1이면 내 순위가 있는 페이지를 그대로 돌려주고 me를 붙인다.
import type { ApiResult } from './api/client.js';
import type { TeamRankSort } from '@offside/contracts';
import { teamAchText as L } from './i18n/ko/teamAch.js';

/** 버튼을 보일지 — 로그인한(또는 아직 모르는) 구단주만 표시한다. */
export const canJumpToMyRank = (member: boolean, _sort?: TeamRankSort): boolean => member;

export type MyRankJump<T> = { ok: true; data: T; rank: number } | { ok: false; message: string };

/** 응답을 화면이 쓸 결과로 바꾼다. 랭킹에 없으면 그 이유, 실패면 실패 안내. */
export function myRankJump<T extends { me?: { rank: number } | null | undefined }>(
  r: ApiResult<T>,
  kind: 'team' | 'ach',
): MyRankJump<T> {
  if (!r.ok) return { ok: false, message: L.myRankFail };
  const me = r.data.me;
  if (!me) return { ok: false, message: kind === 'team' ? L.myRankTeamNone : L.myRankAchNone };
  return { ok: true, data: r.data, rank: me.rank };
}
