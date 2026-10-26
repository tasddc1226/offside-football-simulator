// T-11-511 시즌 패스. 패스 화면을 열 때만 부른다(1분 메모). 사기 · 받기가 성공하면 apiFetch가 메모를 비운다.
import type {
  SeasonPassClaimResponse,
  SeasonPassIapBody,
  SeasonPassResponse,
} from '@offside/contracts';
import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import { apiFetch, ownerCachedGet } from './client.js';

const PATH = '/v1/season-pass';

export const fetchSeasonPass = () => ownerCachedGet<SeasonPassResponse>(PATH, 60_000);

/** 앱 스토어에서 산 패스 거래를 서버에 알린다. 같은 거래를 다시 보내도 한 번만 연다. */
export const claimSeasonPassIap = (body: SeasonPassIapBody) =>
  apiFetch<SeasonPassResponse>(`${PATH}/iap`, { method: 'POST', body: JSON.stringify(body) });

/** 그 시즌 패스의 열린 단계 보상 받기. key는 한 번의 누름마다 하나(응답을 못 받아 다시 누르면 같은 키). */
export const claimSeasonPassReward = (season: number, key: string) =>
  apiFetch<SeasonPassClaimResponse>(`${PATH}/claim`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
    body: JSON.stringify({ season }),
  });
