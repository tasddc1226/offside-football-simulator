// T-11-512 클럽 멤버십. 멤버십 화면을 열 때만 부른다(1분 메모). 앱이 구독 거래를 보내면 apiFetch가 메모를 비운다.
import type { MembershipIapBody, MembershipResponse } from '@offside/contracts';
import { apiFetch, ownerCachedGet } from './client.js';

const PATH = '/v1/membership';

export const fetchMembership = () => ownerCachedGet<MembershipResponse>(PATH, 60_000);

/** 앱 스토어에서 산(또는 앱 시작 때 스토어에 남은) 구독 거래를 서버에 알린다. 같은 거래를 다시 보내도 같은 결과다. */
export const claimMembershipIap = (body: MembershipIapBody) =>
  apiFetch<MembershipResponse>(`${PATH}/iap`, { method: 'POST', body: JSON.stringify(body) });
