// T-11-098 친구 · 친선전 API. 팀 화면(지연 청크)만 import한다. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  FriendRemoveResponse,
  FriendRequestBody,
  FriendRequestResponse,
  FriendsResponse,
  PlayFriendlyResponse,
} from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';
import { noteOwnerResult } from './friendPending.js';

export type {
  FriendPerson,
  FriendRequestResponse,
  FriendsResponse,
  FriendState,
  FriendTeam,
  PlayFriendlyResponse,
} from '@offside/contracts';

/** 친구 화면(내 코드 · 친구 · 신청 · 최근 친선전). 신청·수락·친선전(쓰기)을 하면 메모가 비워진다. */
export const fetchFriends = () =>
  cachedGet<FriendsResponse>('/v1/friends', 60_000).then((r) => (noteOwnerResult(r), r));

/** 친구 신청 — 친구 코드 또는 팀 프로필의 팀 id. */
export const requestFriend = (body: FriendRequestBody) =>
  apiFetch<FriendRequestResponse>('/v1/friends/requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const acceptFriend = (code: string) =>
  apiFetch<FriendRequestResponse>(`/v1/friends/${encodeURIComponent(code)}/accept`, {
    method: 'POST',
  });

/** 거절 · 신청 취소 · 친구 끊기. */
export const removeFriend = (code: string) =>
  apiFetch<FriendRemoveResponse>(`/v1/friends/${encodeURIComponent(code)}`, { method: 'DELETE' });

/** 친선전 한 판. preseason이면 두 사람의 프리시즌 팀끼리(T-11-113). */
export const playFriendly = (code: string, preseason = false) =>
  apiFetch<PlayFriendlyResponse>(
    `/v1/friends/${encodeURIComponent(code)}/matches${preseason ? '?season=0' : ''}`,
    { method: 'POST' },
  );
