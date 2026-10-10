import { CLUB_NAMES, LEAGUE_BASE } from '@offside/contracts/club-names';
import { clubStrengthText as T } from '../i18n/ko/clubStrength.js';
export { T };
export const leagueName = (id: string) => LEAGUE_BASE.find((l) => l.id === id)?.name ?? id;
export const clubName = (id: string) => {
  const [league, index] = id.split('-');
  return CLUB_NAMES[league!]?.[Number(index)] ?? id;
};
export const strengthReason = (code: string) =>
  ({
    'same-standings': T.same,
    'insufficient-games-held': T.held,
    'validated-standings': T.valid,
    'source-or-key-missing': T.missing,
    'source-config-invalid': T.invalid,
  })[code] ?? T.error;
