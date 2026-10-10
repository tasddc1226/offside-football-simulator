// T-10-016 운영 도구 API(관리자 전용). 타입은 type-only import라 번들에 zod가 들어가지 않는다.
// 밸런스·댓글은 늘 최신을 봐야 하므로 매번 읽는다. 대시보드 집계만 탭을 오갈 때 다시 받지 않도록 1분 메모한다
// (서버도 1분 엣지 캐시). 쓰기가 성공하면 메모는 전부 비워진다.
import type {
  AdminCup,
  AdminCupCreate,
  AdminCupList,
  AdminComment,
  AdminCommentList,
  AdminNameReport,
  AdminNameReportList,
  AdminNameReportResolve,
  AdminFundsOwner,
  AdminFundsReport,
  AdminInviteReport,
  AdminStats,
  AutomationReport,
  AutomationEnforcement,
  BalanceDraftInput,
  BalanceVersion,
  BalanceVersionList,
  PushPerformance,
} from '@offside/contracts';
import { apiFetch, cachedGet, invalidateApiCache } from './client.js';

export type {
  AdminComment,
  AdminFundsOwner,
  AdminFundsReport,
  AdminInviteReport,
  AdminCup,
  AdminCupCreate,
  AdminNameReport,
  AdminStats,
  AutomationReport,
  AutomationEnforcement,
  BalanceVersion,
};

// T-11-145 오프사이드 컵 열기: 시작일만 주면 서버가 표준 일정·회차를 정한다. 접수 전 대회만 지운다.
export const fetchAdminCups = () => apiFetch<AdminCupList>('/v1/admin/cups');
export const createCup = (input: AdminCupCreate) =>
  apiFetch<AdminCup>('/v1/admin/cups', { method: 'POST', body: JSON.stringify(input) });
export const deleteCup = (id: string) =>
  apiFetch<undefined>(`/v1/admin/cups/${id}`, { method: 'DELETE' });

export const fetchBalanceVersions = () => apiFetch<BalanceVersionList>('/v1/admin/balance');
export const createBalanceDraft = (draft: BalanceDraftInput) =>
  apiFetch<BalanceVersion>('/v1/admin/balance', { method: 'POST', body: JSON.stringify(draft) });
export const updateBalanceDraft = (version: number, draft: BalanceDraftInput) =>
  apiFetch<BalanceVersion>(`/v1/admin/balance/${version}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
  });
export const deleteBalanceDraft = (version: number) =>
  apiFetch<undefined>(`/v1/admin/balance/${version}`, { method: 'DELETE' });
export const activateBalance = (version: number) =>
  apiFetch<BalanceVersion>(`/v1/admin/balance/${version}/activate`, { method: 'POST' });

export const fetchAdminStats = (fresh = false) =>
  fresh
    ? apiFetch<AdminStats>('/v1/admin/stats')
    : cachedGet<AdminStats>('/v1/admin/stats', 60_000);
/** reported: 신고된 댓글만. */
export const fetchAdminComments = (
  q: { before?: string; profile?: string; reported?: boolean } = {},
) => {
  const p = new URLSearchParams();
  if (q.before) p.set('before', q.before);
  if (q.profile) p.set('profile', q.profile);
  if (q.reported) p.set('reported', '1');
  const qs = p.toString();
  return apiFetch<AdminCommentList>(`/v1/admin/comments${qs ? `?${qs}` : ''}`);
};
export const purgeComments = (profileId: string) =>
  apiFetch<{ deleted: number }>('/v1/admin/comments/purge', {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });

/** 처리를 기다리는 이름 신고(대상마다 한 줄). */
export const fetchNameReports = () => apiFetch<AdminNameReportList>('/v1/admin/name-reports');
export const resolveNameReport = (input: AdminNameReportResolve) =>
  apiFetch<undefined>('/v1/admin/name-reports/resolve', {
    method: 'POST',
    body: JSON.stringify(input),
  });

/** 자동 플레이 탐지(관찰 전용). 열 때만, 늘 새로 읽는다. */
export const fetchAutomation = (hours: number) =>
  apiFetch<AutomationReport>(`/v1/admin/automation?hours=${hours}`);

/** T-11-153 구단 자금 대조. 열 때마다 새로 읽는다(운영자가 직접 누를 때만). */
export const fetchFundsReport = () => apiFetch<AdminFundsReport>('/v1/admin/funds');
/** q: 프로필 id(prf_…) 또는 닉네임. */
export const fetchFundsOwner = (q: string) =>
  apiFetch<AdminFundsOwner>(`/v1/admin/funds/owner?q=${encodeURIComponent(q)}`);

/** T-11-177 친구 초대 현황. 열 때마다 새로 읽는다. */
export const fetchInviteReport = () => apiFetch<AdminInviteReport>('/v1/admin/invites');

export const fetchPushPerformance = (
  days: number,
  tests = false,
  page = 0,
  fresh = false,
  through?: string,
) => {
  if (fresh) invalidateApiCache('/v1/admin/push-performance');
  return cachedGet<PushPerformance>(
    `/v1/admin/push-performance?days=${days}&page=${page}${tests ? '&tests=1' : ''}${through ? `&through=${encodeURIComponent(through)}` : ''}`,
    60_000,
  );
};

export const fetchAutomationEnforcement = (before?: string, fresh = false) => {
  if (fresh) invalidateApiCache('/v1/admin/automation/enforcement');
  return cachedGet<AutomationEnforcement>(
    `/v1/admin/automation/enforcement${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    60_000,
  );
};
export const setAutomationHidden = (careerId: string, hidden: boolean) =>
  apiFetch<undefined>('/v1/admin/careers/hidden', {
    method: 'POST',
    body: JSON.stringify({ careerId, hidden }),
  });
