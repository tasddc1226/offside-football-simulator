type VersionPair = { rulesetVersion: string; contentPackVersion: string };

const PRODUCTION_SEASON_ID = 'svc_season_1';
const PREVIOUS_PRODUCTION_VERSION = Object.freeze({
  rulesetVersion: '1.1.0',
  contentPackVersion: '0.3.0',
});
const CURRENT_PRODUCTION_VERSION = Object.freeze({
  rulesetVersion: '1.3.0',
  contentPackVersion: '0.5.0',
});

function sameVersion(left: VersionPair, right: VersionPair): boolean {
  return (
    left.rulesetVersion === right.rulesetVersion &&
    left.contentPackVersion === right.contentPackVersion
  );
}

/**
 * New careers normally have to match the season manifest exactly. The sole exception keeps an
 * two approved manifests uploadable across the API -> web -> pointer-CAS transition and a guarded
 * rollback. It deliberately does not admit mixed pairs, other historical versions, a third stored
 * manifest, or another season id.
 */
export function isAcceptedSeasonVersion(
  seasonId: string,
  seasonVersion: VersionPair,
  requestedVersion: VersionPair,
): boolean {
  if (sameVersion(seasonVersion, requestedVersion)) return true;
  if (seasonId !== PRODUCTION_SEASON_ID) return false;
  const storedManifestIsApproved =
    sameVersion(seasonVersion, PREVIOUS_PRODUCTION_VERSION) ||
    sameVersion(seasonVersion, CURRENT_PRODUCTION_VERSION);
  const requestedManifestIsApproved =
    sameVersion(requestedVersion, PREVIOUS_PRODUCTION_VERSION) ||
    sameVersion(requestedVersion, CURRENT_PRODUCTION_VERSION);
  return storedManifestIsApproved && requestedManifestIsApproved;
}
