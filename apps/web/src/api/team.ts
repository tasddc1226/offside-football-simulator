// T-10-092 구단주 팀 API. 팀 화면(지연 청크)만 import한다. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  OwnerTeamResponse,
  PlayTeamMatchResponse,
  PutOwnerTeamBody,
  PutOwnerTeamResponse,
  TeamMatchesResponse,
  TeamOpponentsResponse,
} from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';

export type {
  OwnerTeam,
  OwnerTeamResponse,
  TeamMatch,
  TeamOpponent,
  TeamPlayer,
  TeamRecord,
} from '@offside/contracts';

/** 내 팀 + 넣을 수 있는 은퇴 선수. 팀을 저장하거나 경기를 치르면(쓰기) 메모가 비워진다. */
export const fetchOwnerTeam = () => cachedGet<OwnerTeamResponse>('/v1/owner-team', 60_000);
export const saveOwnerTeam = (body: PutOwnerTeamBody) =>
  apiFetch<PutOwnerTeamResponse>('/v1/owner-team', { method: 'PUT', body: JSON.stringify(body) });
/** 상대 후보는 서버가 섞어 준다 — '다른 상대 보기'가 새로 받게 메모하지 않는다. */
export const fetchOpponents = () => apiFetch<TeamOpponentsResponse>('/v1/owner-team/opponents');
export const playMatch = (opponentTeamId: string) =>
  apiFetch<PlayTeamMatchResponse>('/v1/owner-team/matches', {
    method: 'POST',
    body: JSON.stringify({ opponentTeamId }),
  });
export const fetchTeamMatches = () =>
  cachedGet<TeamMatchesResponse>('/v1/owner-team/matches', 60_000);
