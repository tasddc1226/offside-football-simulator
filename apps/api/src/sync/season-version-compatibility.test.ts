import { describe, expect, it } from 'vitest';
import { loadContentPack, PACK_VERSIONS, RULESET_VERSIONS } from '@offside/content';
import {
  APPROVED_PRODUCTION_MANIFESTS,
  isAcceptedSeasonVersion,
} from './season-version-compatibility.js';

const firstVersion = { rulesetVersion: '1.1.0', contentPackVersion: '0.3.0' };
const secondVersion = { rulesetVersion: '1.3.0', contentPackVersion: '0.5.0' };
const previousVersion = { rulesetVersion: '1.4.0', contentPackVersion: '0.5.1' };
const currentVersion = { rulesetVersion: '1.5.0', contentPackVersion: '0.6.0' };

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

  it('accepts the four approved production pairs during promotion and rollback', () => {
    // 1.4.0/0.5.1 → 1.5.0/0.6.0 승격 전환 구간과 롤백.
    expect(isAcceptedSeasonVersion('svc_season_1', currentVersion, previousVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', previousVersion, currentVersion)).toBe(true);
    // 이전 승격들(1.3.0/0.5.0 → 1.4.0/0.5.1)의 미동기화 커리어도 계속 허용한다.
    expect(isAcceptedSeasonVersion('svc_season_1', previousVersion, secondVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', currentVersion, secondVersion)).toBe(true);
    // 최초 공개 manifest로 만든 오프라인 커리어의 늦은 최초 sync는 계속 허용한다.
    expect(isAcceptedSeasonVersion('svc_season_1', currentVersion, firstVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', previousVersion, firstVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', secondVersion, firstVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', firstVersion, currentVersion)).toBe(true);
  });

  it('rejects other seasons, mixed pairs, and unapproved historical manifests', () => {
    expect(isAcceptedSeasonVersion('svc_other', currentVersion, previousVersion)).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', currentVersion, {
        rulesetVersion: '1.5.0',
        contentPackVersion: '0.5.1',
      }),
    ).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', currentVersion, {
        rulesetVersion: '1.1.0',
        contentPackVersion: '0.6.0',
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
