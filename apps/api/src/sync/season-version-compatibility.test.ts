import { describe, expect, it } from 'vitest';
import { isAcceptedSeasonVersion } from './season-version-compatibility.js';

const oldVersion = { rulesetVersion: '1.1.0', contentPackVersion: '0.3.0' };
const newVersion = { rulesetVersion: '1.3.0', contentPackVersion: '0.5.0' };

describe('production season version compatibility', () => {
  it('accepts exact manifests for every season', () => {
    expect(isAcceptedSeasonVersion('svc_other', oldVersion, oldVersion)).toBe(true);
  });

  it('accepts only the two approved production pairs during promotion and rollback', () => {
    expect(isAcceptedSeasonVersion('svc_season_1', newVersion, oldVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_season_1', oldVersion, newVersion)).toBe(true);
    expect(isAcceptedSeasonVersion('svc_other', newVersion, oldVersion)).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', newVersion, {
        rulesetVersion: '1.1.0',
        contentPackVersion: '0.5.0',
      }),
    ).toBe(false);
    expect(
      isAcceptedSeasonVersion(
        'svc_season_1',
        { rulesetVersion: '1.2.0', contentPackVersion: '0.4.0' },
        oldVersion,
      ),
    ).toBe(false);
    expect(
      isAcceptedSeasonVersion('svc_season_1', newVersion, {
        rulesetVersion: '1.0.0',
        contentPackVersion: '0.1.0',
      }),
    ).toBe(false);
  });
});
