import { transferOutlook } from '@offside/game/comps';
import { tn } from '@offside/game/i18n/names';
import type { GameState, OfferOption } from '@offside/game/types';
import { careerMomentText as L } from './i18n/ko/careerMoment';

/** The same destination estimate appears on market cards and contract terms. No RNG is used. */
export function transferDestination(s: GameState, offer: Pick<OfferOption, 'clubId' | 'leagueId'>) {
  const outlook = transferOutlook(s, offer.clubId, offer.leagueId);
  return outlook
    ? {
        label: L.rank({ rank: outlook.rank }),
        value: outlook.competition
          ? L.competition({ competition: tn(outlook.competition) })
          : L.noCompetition,
      }
    : undefined;
}
