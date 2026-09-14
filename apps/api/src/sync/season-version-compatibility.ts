type VersionPair = { rulesetVersion: string; contentPackVersion: string };

const PRODUCTION_SEASON_ID = 'svc_season_1';

/**
 * svc_season_1에서 상호 허용하는 승인 manifest. 순서는 승격 이력(오래된 것부터)이다.
 * tooling/scripts/production-release.mjs의 PREVIOUS_PRODUCTION_VERSION / PRODUCTION_SEASON과
 * 마지막 두 항목이 같아야 한다.
 *
 * 1.1.0/0.3.0은 2026-09-06 최초 공개 manifest다. 그 시점에 만들어져 아직 최초 sync를 하지 않은
 * 오프라인 커리어(IndexedDB 정본)가 남아 있을 수 있으므로, 이후 승격(1.4.0/0.5.1·1.5.0/0.6.0)에서도
 * 목록에서 빼지 않는다. 시즌 행이 정확한 승인 pair일 때만 다른 승인 pair를 받아들이고, mixed pair·
 * 다른 과거 버전·다른 시즌 id는 여전히 거부한다.
 */
export const APPROVED_PRODUCTION_MANIFESTS: readonly VersionPair[] = Object.freeze([
  Object.freeze({ rulesetVersion: '1.1.0', contentPackVersion: '0.3.0' }),
  Object.freeze({ rulesetVersion: '1.3.0', contentPackVersion: '0.5.0' }),
  Object.freeze({ rulesetVersion: '1.4.0', contentPackVersion: '0.5.1' }),
  Object.freeze({ rulesetVersion: '1.5.0', contentPackVersion: '0.6.0' }),
]);

function sameVersion(left: VersionPair, right: VersionPair): boolean {
  return (
    left.rulesetVersion === right.rulesetVersion &&
    left.contentPackVersion === right.contentPackVersion
  );
}

function isApprovedProductionManifest(version: VersionPair): boolean {
  return APPROVED_PRODUCTION_MANIFESTS.some((approved) => sameVersion(approved, version));
}

/**
 * New careers normally have to match the season manifest exactly. The sole exception keeps the
 * approved production manifests uploadable across the API -> web -> pointer-CAS transition and a
 * guarded rollback. It deliberately does not admit mixed pairs, other historical versions, or
 * another season id.
 */
export function isAcceptedSeasonVersion(
  seasonId: string,
  seasonVersion: VersionPair,
  requestedVersion: VersionPair,
): boolean {
  if (sameVersion(seasonVersion, requestedVersion)) return true;
  if (seasonId !== PRODUCTION_SEASON_ID) return false;
  return (
    isApprovedProductionManifest(seasonVersion) && isApprovedProductionManifest(requestedVersion)
  );
}
