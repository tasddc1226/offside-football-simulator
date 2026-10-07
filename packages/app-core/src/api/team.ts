// T-10-092 구단주 팀 · 라이브 랭킹 API. 팀 화면·기록실(지연 청크)만 import한다. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  AchRankResponse,
  ClubAchievementsResponse,
  OwnerTeamResponse,
  PlayTeamMatchResponse,
  PutOwnerTeamBody,
  PutOwnerTeamResponse,
  TeamLikeResponse,
  TeamMatchesResponse,
  TeamOpponentsResponse,
  TeamProfileResponse,
  TeamRankResponse,
  TeamRankSort,
} from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';
import { noteOwnerResult } from './friendPending.js';

export type {
  AchRankItem,
  AchRankResponse,
  ClubAchievement,
  ClubAchievementGroup,
  ClubAchievementsResponse,
  OwnerTeam,
  OwnerTeamResponse,
  TeamMatch,
  TeamOpponent,
  TeamPlayer,
  TeamProfile,
  TeamRankItem,
  TeamRankResponse,
  TeamRankSort,
  TeamLines,
  TeamRecord,
  TeamSlot,
} from '@offside/contracts';

/** `?season=` 꼬리(없으면 지금 시즌). */
const seasonQ = (season?: number) => (season === undefined ? '' : `?season=${season}`);

/** 그 시즌 내 팀 + 넣을 수 있는 은퇴 선수. 팀을 저장하거나 경기를 치르면(쓰기) 메모가 비워진다. */
export const fetchOwnerTeam = (season?: number) =>
  cachedGet<OwnerTeamResponse>(`/v1/owner-team${seasonQ(season)}`, 60_000).then(
    (r) => (noteOwnerResult(r), r),
  );
export const saveOwnerTeam = (body: PutOwnerTeamBody) =>
  apiFetch<PutOwnerTeamResponse>('/v1/owner-team', { method: 'PUT', body: JSON.stringify(body) });
/** 상대 후보는 서버가 섞어 준다 — '다른 상대 보기'가 새로 받게 메모하지 않는다. */
export const fetchOpponents = () => apiFetch<TeamOpponentsResponse>('/v1/owner-team/opponents');
export const playMatch = (opponentTeamId: string) =>
  apiFetch<PlayTeamMatchResponse>('/v1/owner-team/matches', {
    method: 'POST',
    body: JSON.stringify({ opponentTeamId }),
  });
export const fetchTeamMatches = (season?: number) =>
  cachedGet<TeamMatchesResponse>(`/v1/owner-team/matches${seasonQ(season)}`, 60_000);
/** 구단 시즌 업적. season: 팀 시즌(0 = 프리시즌), 없으면 지금 시즌. */
export const fetchClubAchievements = (season?: number) =>
  cachedGet<ClubAchievementsResponse>(`/v1/owner-team/achievements${seasonQ(season)}`, 60_000);

/** 라이브 랭킹(팀 랭킹). 서버가 5분마다 새로 센다. */
export const fetchTeamRanking = (season: number | undefined, sort: TeamRankSort, page: number) =>
  cachedGet<TeamRankResponse>(
    `/v1/teams?${season === undefined ? '' : `season=${season}&`}sort=${sort}&page=${page}`,
    60_000,
  );
/** T-11-028 업적 랭킹(기록실). 서버가 5분마다 새로 센다. */
export const fetchAchRanking = (season: number | undefined, page: number) =>
  cachedGet<AchRankResponse>(
    `/v1/achievements/ranking?${season === undefined ? '' : `season=${season}&`}page=${page}`,
    60_000,
  );
/** 팀 프로필(좋아요 여부가 사람마다 달라 메모하지 않는다). */
export const fetchTeamProfile = (id: string) => apiFetch<TeamProfileResponse>(`/v1/teams/${id}`);
export const viewTeam = (id: string) =>
  apiFetch<undefined>(`/v1/teams/${id}/views`, { method: 'POST', keepCache: true });
export const likeTeam = (id: string, like: boolean) =>
  apiFetch<TeamLikeResponse>(`/v1/teams/${id}/like`, { method: like ? 'PUT' : 'DELETE' });
