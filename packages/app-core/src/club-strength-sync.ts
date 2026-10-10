import type { ClubStrengthSnapshot } from '@offside/contracts/club-strength-spec';
import { setLatestClubStrength } from '@offside/game/clubStrength';
import { cachedGet } from './api/client.js';

/** Open/resume only. Memoized requests, no polling and no session required. */
export function syncClubStrength(): void {
  void cachedGet<ClubStrengthSnapshot>('/v1/club-strength', 3_600_000).then((r) => {
    if (r.ok) setLatestClubStrength(r.data);
  });
}
