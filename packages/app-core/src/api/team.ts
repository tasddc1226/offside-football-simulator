// T-10-092 구단주 팀 · 라이브 랭킹 API. 팀 화면·기록실(지연 청크)만 import한다. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  Comment,
  CommentInput,
  TeamCommentsResponse,
  AchRankResponse,
  ClubAchievementsResponse,
  ClubAchievementNotifications,
  OwnerTeamResponse,
  PlayTeamMatchResponse,
  PutOwnerTeamBody,
  PutOwnerTeamResponse,
  PutTeamPresetsBody,
  PutTeamPresetsResponse,
  TeamLikeResponse,
  TeamMatchesResponse,
  TeamOpponentsResponse,
  TeamProfileResponse,
  TeamRankResponse,
  TeamRankSort,
  TeamStatsResponse,
  TeamMomentResponse,
} from '@offside/contracts';
import { apiFetch, cachedGet, ownerCachedGet } from './client.js';
import { withOwnerHint } from './friendPending.js';

export type {
  AchRankItem,
  AchRankResponse,
  ClubAchievement,
  ClubAchievementGroup,
  ClubAchievementsResponse,
  ClubAchievementNotifications,
  OwnerTeam,
  OwnerTeamResponse,
  PlayTeamMatchResponse,
  TeamMatch,
  TeamMatchEvent,
  TeamMoment,
  TeamMomentChoice,
  TeamMomentResponse,
  TeamLive,
  TeamOpponent,
  TeamPlayer,
  TeamPreset,
  TeamProfile,
  TeamRankItem,
  TeamRankResponse,
  TeamRankSort,
  TeamLines,
  TeamRecord,
  TeamSlot,
  TeamForm,
  TeamStatsDay,
  TeamStatsMatch,
  TeamStatsOpponent,
  TeamStatsPlayer,
  TeamStatsReport,
  TeamStatsResponse,
  TeamStatsSummary,
} from '@offside/contracts';

/** `?season=` 꼬리(없으면 지금 시즌). */
const seasonQ = (season?: number) => (season === undefined ? '' : `?season=${season}`);

/** 그 시즌 내 팀 + 넣을 수 있는 은퇴 선수. 팀을 저장하거나 경기를 치르면(쓰기) 메모가 비워진다. */
export const fetchOwnerTeam = (season?: number) =>
  withOwnerHint(cachedGet<OwnerTeamResponse>(`/v1/owner-team${seasonQ(season)}`, 60_000));
export const saveOwnerTeam = (body: PutOwnerTeamBody) =>
  apiFetch<PutOwnerTeamResponse>('/v1/owner-team', { method: 'PUT', body: JSON.stringify(body) });
/** T-11-217 팀 프리셋 목록 통째 교체(저장 · 덮어쓰기 · 이름 바꾸기 · 삭제). */
export const saveTeamPresets = (body: PutTeamPresetsBody) =>
  apiFetch<PutTeamPresetsResponse>('/v1/owner-team/presets', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
/** 상대 후보는 서버가 섞어 준다 — '다른 상대 보기'가 새로 받게 메모하지 않는다. */
export const fetchOpponents = () => apiFetch<TeamOpponentsResponse>('/v1/owner-team/opponents');
export const playMatch = (opponentTeamId: string) =>
  apiFetch<PlayTeamMatchResponse>('/v1/owner-team/matches', {
    method: 'POST',
    body: JSON.stringify({ opponentTeamId }),
  });
/** 경기 기록 첫 쪽, cursor(앞 쪽의 next)를 주면 그다음 쪽(T-11-269 '더 보기'). */
export const fetchTeamMatches = (season?: number, cursor?: string) => {
  const q = [
    ...(season === undefined ? [] : [`season=${season}`]),
    ...(cursor ? [`cursor=${encodeURIComponent(cursor)}`] : []),
  ];
  return cachedGet<TeamMatchesResponse>(
    `/v1/owner-team/matches${q.length ? `?${q.join('&')}` : ''}`,
    60_000,
  );
};
/** T-11-269 그 시즌 내 팀 랭크 경기 통계. 통계 화면을 열 때만 부른다(경기를 치르면 쓰기라 메모가 비워진다). */
export const fetchTeamStats = (season?: number) =>
  cachedGet<TeamStatsResponse>(`/v1/owner-team/stats${seasonQ(season)}`, 5 * 60_000);
/** T-11-358 남의 팀(팀 프로필) 경기 통계. 프로필에서 '경기 통계 보기'를 누를 때만 부른다(서버 엣지 캐시 5분). */
export const fetchPublicTeamStats = (teamId: string) =>
  cachedGet<TeamStatsResponse>(`/v1/teams/${encodeURIComponent(teamId)}/stats`, 5 * 60_000);
/** 구단 시즌 업적. season: 팀 시즌(0 = 프리시즌), 없으면 지금 시즌. */
export const fetchClubAchievements = (season?: number) =>
  cachedGet<ClubAchievementsResponse>(`/v1/owner-team/achievements${seasonQ(season)}`, 60_000);

export const fetchAchievementNotifications = () =>
  ownerCachedGet<ClubAchievementNotifications>('/v1/owner-team/achievement-notifications', 60_000);

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
/** T-11-441 '내 순위로': 내 팀이 있는 페이지와 내 순위(me). 누를 때만 부르고, 1분 메모한다. 가치순은 서버가 세지 않는다. */
export const fetchMyTeamRank = (season: number | undefined, sort: TeamRankSort) =>
  cachedGet<TeamRankResponse>(
    `/v1/teams?${season === undefined ? '' : `season=${season}&`}sort=${sort}&me=1`,
    60_000,
  );
/** T-11-441 업적 랭킹의 '내 순위로'. */
export const fetchMyAchRank = (season: number | undefined) =>
  cachedGet<AchRankResponse>(
    `/v1/achievements/ranking?${season === undefined ? '' : `season=${season}&`}me=1`,
    60_000,
  );
/** 팀 프로필(좋아요 여부가 사람마다 달라 메모하지 않는다). */
export const fetchTeamProfile = (id: string) => apiFetch<TeamProfileResponse>(`/v1/teams/${id}`);
/** T-11-290 팀 프로필의 스쿼드 댓글(보는 사람이 신고·차단한 것은 빠진다). 지우기·신고·차단은 api/boards의 함수를 그대로 쓴다. */
export const fetchTeamComments = (id: string) =>
  apiFetch<TeamCommentsResponse>(`/v1/teams/${id}/comments`);
export const addTeamComment = (id: string, input: CommentInput) =>
  apiFetch<Comment>(`/v1/teams/${id}/comments`, { method: 'POST', body: JSON.stringify(input) });
export const viewTeam = (id: string) =>
  apiFetch<undefined>(`/v1/teams/${id}/views`, { method: 'POST', keepCache: true });
export const likeTeam = (id: string, like: boolean) =>
  apiFetch<TeamLikeResponse>(`/v1/teams/${id}/like`, { method: like ? 'PUT' : 'DELETE' });

/** T-11-387 장면 경기로 시작한다(문자중계 도중 장면을 고른다). 마지막 장면을 고르면 결과가 온다. */
export const playLiveMatch = (opponentTeamId: string) =>
  apiFetch<PlayTeamMatchResponse>('/v1/owner-team/matches', {
    method: 'POST',
    body: JSON.stringify({ opponentTeamId, live: true }),
  });
/** 장면 하나를 고른다(choice는 선택지 id, 'auto'면 감독에게 맡긴다). */
export const chooseMoment = (matchId: string, index: number, choice: string) =>
  apiFetch<TeamMomentResponse>(
    `/v1/owner-team/matches/${encodeURIComponent(matchId)}/moments/${index}`,
    { method: 'POST', body: JSON.stringify({ choice }) },
  );
/** 남은 장면을 감독에게 맡기고 경기를 끝낸다('결과 바로 보기'). */
export const finishLiveMatch = (matchId: string) =>
  apiFetch<PlayTeamMatchResponse>(`/v1/owner-team/matches/${encodeURIComponent(matchId)}/finish`, {
    method: 'POST',
  });
