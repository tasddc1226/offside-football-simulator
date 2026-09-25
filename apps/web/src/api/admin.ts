// T-10-016 운영 도구 API(관리자 전용). 타입은 type-only import라 번들에 zod가 들어가지 않는다.
// 밸런스·댓글은 늘 최신을 봐야 하므로 매번 읽는다. 대시보드 집계만 탭을 오갈 때 다시 받지 않도록 1분 메모한다
// (서버도 1분 엣지 캐시). 쓰기가 성공하면 메모는 전부 비워진다.
import type { AdminComment, AdminCommentList, AdminStats, BalanceOverrides, BalanceVersion, BalanceVersionList } from '@offside/contracts';
import { apiFetch, cachedGet } from './client.js';

export type { AdminComment, AdminStats, BalanceVersion };
export type BalanceDraft = { note: string; values: BalanceOverrides };

export const fetchBalanceVersions = () => apiFetch<BalanceVersionList>('/v1/admin/balance');
export const createBalanceDraft = (draft: BalanceDraft) =>
  apiFetch<BalanceVersion>('/v1/admin/balance', { method: 'POST', body: JSON.stringify(draft) });
export const updateBalanceDraft = (version: number, draft: BalanceDraft) =>
  apiFetch<BalanceVersion>(`/v1/admin/balance/${version}`, { method: 'PUT', body: JSON.stringify(draft) });
export const deleteBalanceDraft = (version: number) => apiFetch<undefined>(`/v1/admin/balance/${version}`, { method: 'DELETE' });
export const activateBalance = (version: number) => apiFetch<BalanceVersion>(`/v1/admin/balance/${version}/activate`, { method: 'POST' });

export const fetchAdminStats = (fresh = false) =>
  fresh ? apiFetch<AdminStats>('/v1/admin/stats') : cachedGet<AdminStats>('/v1/admin/stats', 60_000);
export const fetchAdminComments = (q: { before?: string; profile?: string } = {}) => {
  const p = new URLSearchParams();
  if (q.before) p.set('before', q.before);
  if (q.profile) p.set('profile', q.profile);
  const qs = p.toString();
  return apiFetch<AdminCommentList>(`/v1/admin/comments${qs ? `?${qs}` : ''}`);
};
export const purgeComments = (profileId: string) =>
  apiFetch<{ deleted: number }>('/v1/admin/comments/purge', { method: 'POST', body: JSON.stringify({ profileId }) });
