// T-11-128 구단주 시즌 결산 · 휘장 API. 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type {
  OwnerHonorsResponse,
  SeasonRecapResponse,
  OwnerRecapStatus,
} from '@offside/contracts';
import { lastClosedSeason } from '@offside/contracts/service-seasons';
import { recapSeen } from '../seasonRecap.js';
import { cachedGet } from './client.js';

export type {
  OwnerHonor,
  OwnerHonorsResponse,
  SeasonRecap,
  SeasonRecapResponse,
} from '@offside/contracts';

/** 시즌 결산(없으면 가장 최근에 끝난 시즌). 서버가 굳힌 값이라 1분 메모로 충분하다. */
export const fetchSeasonRecap = (season?: number) =>
  cachedGet<SeasonRecapResponse>(
    `/v1/owner/season-recap${season === undefined ? '' : `?season=${season}`}`,
    60_000,
  );
/** 결산을 볼 수 있는 시즌과 내 휘장 전부. */
export const fetchOwnerHonors = () => cachedGet<OwnerHonorsResponse>('/v1/owner/honors', 60_000);

/** 하단 '구단주' 탭 점 — 끝난 시즌 결산이 나왔는데 이 기기에서 아직 안 열어 봤는가. 이미 본 시즌이면 묻지 않는다. */
export async function recapUnseen(now = new Date().toISOString()): Promise<boolean> {
  const season = lastClosedSeason(now);
  if (season === null || recapSeen(season)) return false;
  const r = await cachedGet<OwnerRecapStatus>('/v1/owner/recap-status', 60_000);
  return r.ok && r.data.tier !== null && !recapSeen(r.data.tier.season);
}
