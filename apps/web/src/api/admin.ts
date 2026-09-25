// T-10-016 운영 도구 API(관리자 전용). 타입은 type-only import라 번들에 zod가 들어가지 않는다.
// 관리 화면은 늘 최신을 봐야 하므로 cachedGet을 쓰지 않는다(쓰기가 성공하면 공개 조회 메모도 비워진다).
import type { BalanceOverrides, BalanceVersion, BalanceVersionList } from '@offside/contracts';
import { apiFetch } from './client.js';

export type { BalanceVersion };
export type BalanceDraft = { note: string; values: BalanceOverrides };

export const fetchBalanceVersions = () => apiFetch<BalanceVersionList>('/v1/admin/balance');
export const createBalanceDraft = (draft: BalanceDraft) =>
  apiFetch<BalanceVersion>('/v1/admin/balance', { method: 'POST', body: JSON.stringify(draft) });
export const updateBalanceDraft = (version: number, draft: BalanceDraft) =>
  apiFetch<BalanceVersion>(`/v1/admin/balance/${version}`, { method: 'PUT', body: JSON.stringify(draft) });
export const deleteBalanceDraft = (version: number) => apiFetch<undefined>(`/v1/admin/balance/${version}`, { method: 'DELETE' });
export const activateBalance = (version: number) => apiFetch<BalanceVersion>(`/v1/admin/balance/${version}/activate`, { method: 'POST' });
