import type { LeagueDef } from '@offside/contracts/league';
import type { CupTextKey } from '../i18n/ko/cup.js';
import { cupKo } from '../cupText.js';

const editionKeys: Partial<Record<CupTextKey, CupTextKey>> = {
  leaguePlacedTitle: 'leaguePlacedTitleCycle',
  leagueDroppedTitle: 'leagueDroppedTitleCycle',
  leagueCancelledTitle: 'leagueCancelledTitleCycle',
  leagueEndTitle: 'leagueEndTitleCycle',
  leagueChampionTitle: 'leagueChampionTitleCycle',
  leagueEndBodyChampion: 'leagueEndBodyChampionCycle',
  leagueFillBody: 'leagueFillBodyCycle',
};
export const leagueKo = (
  league: LeagueDef,
  key: CupTextKey,
  vars: Record<string, string | number> = {},
) => cupKo(league.teamSeason === undefined ? key : (editionKeys[key] ?? key), vars);
