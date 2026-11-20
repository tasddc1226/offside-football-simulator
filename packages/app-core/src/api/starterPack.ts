// T-11-770d 첫 구매 묶음. 상점을 열 때와 끝까지 뛴 선수가 은퇴한 화면에서만 부른다(5분 메모). 사면 apiFetch가 메모를 비운다.
import type {
  StarterPackIapBody,
  StarterPackIapResponse,
  StarterPackResponse,
} from '@offside/contracts';
import { apiFetch, ownerCachedGet } from './client.js';

const PATH = '/v1/starter-pack';

export const fetchStarterPack = () => ownerCachedGet<StarterPackResponse>(PATH, 5 * 60_000);

/** 앱 스토어에서 산 묶음 거래를 서버에 알린다. 같은 거래를 다시 보내도 한 번만 준다. */
export const claimStarterPackIap = (body: StarterPackIapBody) =>
  apiFetch<StarterPackIapResponse>(`${PATH}/iap`, { method: 'POST', body: JSON.stringify(body) });
