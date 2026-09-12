import { describe, expect, it } from 'vitest';
import { isAcceptedSeasonVersion } from './season-version-compatibility.js';

const firstVersion = { rulesetVersion: '1.1.0', contentPackVersion: '0.3.0' };
const previousVersion = { rulesetVersion: '1.3.0', contentPackVersion: '0.5.0' };
const currentVersion = { rulesetVersion: '1.4.0', contentPackVersion: '0.5.1' };

describe('production season version compatibility', () => {
  it('accepts exact manifests for every season', () => {
    expect(isAcceptedSeasonVersion('svc_other', firstVersion, firstVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_other', currentVersion, currentVersion)).toBe(true);
  });

  it('accepts the three approved production pairs during promotion and rollback', () => {
    // 1.3.0/0.5.0 → 1.4.0/0.5.1 승격 전환 구간과 롤백.
    expect(isAcceptedSeasonVersion('svc_season_1', currentVersion, previousVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', previousVersion, currentVersion)).toBe(true);
    // 최초 공개 manifest로 만든 오프라인 커리어의 늦은 최초 sync는 계속 허용한다.
    expect(isAcceptedSeasonVersion('svc_season_1', currentVersion, firstVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', previousVersion, firstVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', firstVersion, currentVersion)).toBe(true);
  });

  it('rejects other seasons, mixed pairs, and unapproved historical manifests', () => {
    expect(isAcceptedSeasonVersion('svc_other', currentVersion, previousVersion)).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', currentVersion, {
        rulesetVersion: '1.4.0',
        contentPackVersion: '0.5.0',
      }),
    ).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', currentVersion, {
        rulesetVersion: '1.1.0',
        contentPackVersion: '0.5.1',
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
