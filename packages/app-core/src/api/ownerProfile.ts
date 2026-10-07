// T-11-150 구단주 프로필 · 명예관(대표 칭호) API. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  OwnerProfileResponse,
  OwnerTitlesResponse,
  PutOwnerTitleResponse,
} from '@offside/contracts';
import { apiFetch } from './client.js';

export type {
  OwnerProfile,
  OwnerProfileResponse,
  OwnerSeasonLine,
  OwnerTitlesResponse,
  PutOwnerTitleResponse,
} from '@offside/contracts';

/** 팀 id로 그 팀 구단주의 프로필(내 프로필이면 mine). */
export const fetchOwnerProfileByTeam = (teamId: string) =>
  apiFetch<OwnerProfileResponse>(`/v1/owners/by-team/${teamId}`);
/** 명예관 — 지금 대표 칭호와 고를 수 있는 칭호, 내 가장 최근 팀. */
export const fetchOwnerTitles = () => apiFetch<OwnerTitlesResponse>('/v1/owner/title');
/** 대표 칭호 고르기. 칭호 id, 'none'(달지 않기), null(자동 — 가장 좋은 칭호). */
export const putOwnerTitle = (title: string | null) =>
  apiFetch<PutOwnerTitleResponse>('/v1/owner/title', {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
