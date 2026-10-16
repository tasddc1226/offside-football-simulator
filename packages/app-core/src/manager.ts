// T-11-310 감독 커리어(웹 ui/Manager.svelte · 앱 screens/owner/Manager.tsx 공용). 감독 커리어는 기기에서 돌고(게임 엔진
// manager.ts, 세이브 ft_mgr_save), 서버는 시작 · 포기 · 완료와 팀 감독 칸만 맡는다. 감독 화면(지연 청크)만 import한다.
import type {
  ManagerCandidate,
  ManagerCareer,
  ManagerCareerResponse,
  ManagerResult,
  ManagersResponse,
  PutTeamCoachResponse,
  TeamCoach,
} from '@offside/contracts';
import { loadKey, saveKey } from '@offside/game/storage';
import {
  MANAGER_SAVE_KEY,
  migrateManagerSave,
  newManagerCareer,
  type ManagerState,
} from '@offside/game/manager';
import { apiFetch, ownerCachedGet } from './api/client.js';
import { fmtValue } from './format.js';
import { managerText as M } from './i18n/ko/manager.js';

export type { ManagerCandidate, ManagerCareer, ManagersResponse, TeamCoach };
export { coachEffectText, managerName } from './managerCard.js';

/** 감독 화면 데이터(진행 중 · 끝낸 감독 · 시작할 수 있는 카드). 쓰기가 성공하면 메모가 비워진다. */
export const fetchManagers = () => ownerCachedGet<ManagersResponse>('/v1/managers', 60_000);
export const startManager = (careerId: string) =>
  apiFetch<ManagerCareerResponse>('/v1/managers', {
    method: 'POST',
    body: JSON.stringify({ careerId }),
  });
export const abandonManager = (id: string) =>
  apiFetch<void>(`/v1/managers/${id}/abandon`, { method: 'POST' });
export const finishManager = (id: string, result: ManagerResult) =>
  apiFetch<ManagerCareerResponse>(`/v1/managers/${id}/finish`, {
    method: 'POST',
    body: JSON.stringify({ result }),
  });
/** 지금 시즌 팀 감독 칸(null이면 비운다). */
export const setTeamCoach = (coach: string | null) =>
  apiFetch<PutTeamCoachResponse>('/v1/owner-team/coach', {
    method: 'PUT',
    body: JSON.stringify({ coach }),
  });

/**
 * 진행 중 감독 커리어의 기기 세이브. 같은 커리어 세이브가 있으면 이어 하고, 없거나 다른 커리어 것이면(다른 기기에서 시작 ·
 * 포기 뒤 새로 시작) 서버 시드로 처음부터 만든다.
 */
export function loadManagerState(active: ManagerCareer, name: string | null): ManagerState {
  const saved = migrateManagerSave(loadKey(MANAGER_SAVE_KEY));
  if (saved && saved.id === active.id) return saved;
  const s = newManagerCareer({
    id: active.id,
    careerId: active.careerId,
    seed: active.seed,
    origin: active.origin,
    name,
  });
  saveManagerState(s);
  return s;
}
export const saveManagerState = (s: ManagerState) => saveKey(MANAGER_SAVE_KEY, s);
export const clearManagerState = () => saveKey(MANAGER_SAVE_KEY, null);

/** 감독으로 바꾸기 전 확인 창 줄(잃는 것). */
export function startConfirmLines(c: ManagerCandidate): string[] {
  return [
    ...(c.inLineup ? [M.confirmLineup] : []),
    ...(c.listed ? [M.confirmListed] : []),
    ...(c.inLineup && c.cardValue ? [M.confirmValue({ value: fmtValue(c.cardValue) })] : []),
    M.confirmLocked,
    M.confirmAbandon,
  ];
}
