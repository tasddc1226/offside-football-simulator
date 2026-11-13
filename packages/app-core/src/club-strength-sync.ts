import type { ClubStrengthSnapshot } from '@offside/contracts/club-strength-spec';
import { setLatestClubStrength } from '@offside/game/clubStrength';
import { persistedGet } from './api/client.js';

/** Open/resume only. Memoized requests, no polling and no session required. T-11-724 응답을 기기에도 남겨 한 시간 안에 다시 열면 묻지 않는다. */
export function syncClubStrength(): void {
  void persistedGet<ClubStrengthSnapshot>('/v1/club-strength', 3_600_000).then((r) => {
    if (r.ok) setLatestClubStrength(r.data);
  });
}
