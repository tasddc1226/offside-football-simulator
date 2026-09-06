import { describe, expect, it } from 'vitest';
import { loadRetirementArtifacts } from './retirement-artifacts.ts';
import rulesetManifest from '../rulesets/1.0.0/manifest.json' with { type: 'json' };
import packManifest from '../packs/0.1.0/manifest.json' with { type: 'json' };

describe('loadRetirementArtifacts', () => {
  it('pins the existing registered artifact checksums deterministically', () => {
    const first = loadRetirementArtifacts('1.0.0', '0.1.0');
    const second = loadRetirementArtifacts('1.0.0', '0.1.0');

    expect(first).toEqual(second);
    expect(first.rulesetVersion).toBe('1.0.0');
    expect(first.contentPackVersion).toBe('0.1.0');
    expect(first.rulesetChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(first.contentPackChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(first.rulesetChecksum).toBe(rulesetManifest.checksum);
    expect(first.contentPackChecksum).toBe(packManifest.checksum);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.legacyVersion).toBeUndefined();
    expect(first.legacyReferencePopulation).toBeUndefined();
  });

  it('activates the published Legacy 1.1 reference only for the 1.1/0.3 release pair', () => {
    const artifacts = loadRetirementArtifacts('1.1.0', '0.3.0');

    expect(artifacts.legacyVersion).toBe('1.1.0');
    expect(artifacts.legacyReferencePopulation).toMatchObject({
      legacyVersion: '1.1.0',
      rulesetVersion: '1.1.0',
    });
    expect(artifacts.legacyReferencePopulation?.id).toMatch(/\S/);
  });

  it('does not retrofit Legacy 1.1 onto the Legacy 1.0 ruleset', () => {
    const artifacts = loadRetirementArtifacts('1.0.0', '0.3.0');

    expect(artifacts.legacyVersion).toBeUndefined();
    expect(artifacts.legacyReferencePopulation).toBeUndefined();
  });

  it('produces different content checksums for registered pack versions', () => {
    const pack010 = loadRetirementArtifacts('1.0.0', '0.1.0');
    const pack020 = loadRetirementArtifacts('1.0.0', '0.2.0');

    expect(pack010.rulesetChecksum).toBe(pack020.rulesetChecksum);
    expect(pack010.contentPackChecksum).not.toBe(pack020.contentPackChecksum);
  });

  it('rejects unknown ruleset or content pack versions', () => {
    expect(() => loadRetirementArtifacts('9.9.9', '0.1.0')).toThrow(/rulesetVersion/);
    expect(() => loadRetirementArtifacts('1.0.0', '9.9.9')).toThrow(/contentPackVersion/);
  });
});
