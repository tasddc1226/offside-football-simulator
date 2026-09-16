import { describe, expect, it } from 'vitest';
import { loadContentPack, PACK_VERSIONS, RULESET_VERSIONS } from '@offside/content';
import {
  APPROVED_PRODUCTION_MANIFESTS,
  isAcceptedSeasonVersion,
} from './season-version-compatibility.js';

const firstVersion = { rulesetVersion: '1.1.0', contentPackVersion: '0.3.0' };
const secondVersion = { rulesetVersion: '1.3.0', contentPackVersion: '0.5.0' };
const thirdVersion = { rulesetVersion: '1.4.0', contentPackVersion: '0.5.1' };
const fourthVersion = { rulesetVersion: '1.5.0', contentPackVersion: '0.6.0' };
const ledgerVersion = { rulesetVersion: '1.7.0', contentPackVersion: '0.6.3' };
const fifthVersion = { rulesetVersion: '1.7.0', contentPackVersion: '0.6.4' };
const previousVersion = { rulesetVersion: '1.7.1', contentPackVersion: '0.6.5' };
const currentVersion = { rulesetVersion: '1.7.2', contentPackVersion: '0.6.6' };
const roleBalanceVersion = { rulesetVersion: '1.7.3', contentPackVersion: '0.6.7' };
const eventVarietyVersion = { rulesetVersion: '1.7.4', contentPackVersion: '0.6.8' };

describe('production season version compatibility', () => {
  // fail-closed 게이트: 승인 목록의 pair는 번들 레지스트리에 실제로 있어야 한다. 이 파일은 Production
  // Release validate 단계에서도 돌기 때문에 팩·룰셋 PR이 먼저 main에 없으면 여기서 배포가 막힌다.
  it('every approved production manifest exists in the bundled registries', () => {
    for (const { rulesetVersion, contentPackVersion } of APPROVED_PRODUCTION_MANIFESTS) {
      expect(RULESET_VERSIONS).toContain(rulesetVersion);
      expect(PACK_VERSIONS).toContain(contentPackVersion);
      expect(loadContentPack(contentPackVersion).manifest.compatibleRulesetVersions).toContain(
        rulesetVersion,
      );
    }
  });

  it('accepts exact manifests for every season', () => {
    expect(isAcceptedSeasonVersion('svc_other', firstVersion, firstVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_other', currentVersion, currentVersion)).toBe(true);
  });

  it('accepts every approved production pair during promotion and rollback', () => {
    // 예약 호환 pair(1.7.3/0.6.7, 1.7.4/0.6.8)를 등록하되 운영 active pointer는 여전히
    // 1.7.2/0.6.6에 둔다. 포인터 전환 전후의 양방향 sync만 여기서 확인한다.
    expect(isAcceptedSeasonVersion('svc_season_1', currentVersion, roleBalanceVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', roleBalanceVersion, currentVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', roleBalanceVersion, eventVarietyVersion)).toBe(
      true,
    );
    expect(isAcceptedSeasonVersion('svc_season_1', eventVarietyVersion, roleBalanceVersion)).toBe(
      true,
    );
    // 최초 공개부터 현재까지 어느 승격 지점으로 롤백해도 미동기화 최초 sync를 보호한다.
    const history = [
      firstVersion,
      secondVersion,
      thirdVersion,
      fourthVersion,
      ledgerVersion,
      fifthVersion,
      previousVersion,
      currentVersion,
      roleBalanceVersion,
      eventVarietyVersion,
    ];
    for (const seasonVersion of history) {
      for (const requestedVersion of history) {
        expect(
          isAcceptedSeasonVersion('svc_season_1', seasonVersion, requestedVersion),
          `${seasonVersion.rulesetVersion}/${seasonVersion.contentPackVersion} → ${requestedVersion.rulesetVersion}/${requestedVersion.contentPackVersion}`,
        ).toBe(true);
      }
    }
  });

  it('rejects other seasons, mixed pairs, and unapproved historical manifests', () => {
    expect(isAcceptedSeasonVersion('svc_other', currentVersion, previousVersion)).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', currentVersion, {
        rulesetVersion: '1.7.0',
        contentPackVersion: '0.6.2',
      }),
    ).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', currentVersion, {
        rulesetVersion: '1.1.0',
        contentPackVersion: '0.6.6',
      }),
    ).toBe(false);
    expect(
      isAcceptedSeasonVersion(
        'svc_season_1',
        { rulesetVersion: '1.2.0', contentPackVersion: '0.4.0' },
        firstVersion,
      ),
    ).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', currentVersion, {
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
      }),
    ).toBe(false);
  });
});
