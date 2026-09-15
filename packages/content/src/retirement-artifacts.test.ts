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
    const meetingArtifacts = loadRetirementArtifacts('1.6.0', '0.6.1');
    expect(meetingArtifacts).toMatchObject({
      rulesetVersion: '1.6.0',
      contentPackVersion: '0.6.1',
      legacyVersion: '1.1.0',
    });
    expect(meetingArtifacts.rulesetChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(meetingArtifacts.contentPackChecksum).toMatch(/^[a-f0-9]{64}$/);
    // T-7-032: 룰셋 1.6.1·팩 0.6.2(D-80 1라운드 ③)는 Legacy 1.2.0으로 옮겨졌다.
    const peakAgeArtifacts = loadRetirementArtifacts('1.6.1', '0.6.2');
    expect(peakAgeArtifacts).toMatchObject({
      rulesetVersion: '1.6.1',
      contentPackVersion: '0.6.2',
      legacyVersion: '1.2.0',
    });
    expect(peakAgeArtifacts.rulesetChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(peakAgeArtifacts.contentPackChecksum).toMatch(/^[a-f0-9]{64}$/);
    const ledgerArtifacts = loadRetirementArtifacts('1.7.0', '0.6.3');
    expect(ledgerArtifacts).toMatchObject({
      rulesetVersion: '1.7.0',
      contentPackVersion: '0.6.3',
      legacyVersion: '1.2.0',
    });
    expect(ledgerArtifacts.rulesetChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(ledgerArtifacts.contentPackChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(ledgerArtifacts.legacyReferencePopulation).toBeUndefined();
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

  it('uses Legacy 1.1 without mislabeling the 17-year-old reference population for 1.2/0.4', () => {
    const artifacts = loadRetirementArtifacts('1.2.0', '0.4.0');
    expect(artifacts.legacyVersion).toBe('1.1.0');
    expect(artifacts.legacyReferencePopulation).toBeUndefined();
  });

  it('uses Legacy 1.1 scoring for 1.3/0.5 but hides percentile without a matching reference', () => {
    const artifacts = loadRetirementArtifacts('1.3.0', '0.5.0');
    expect(artifacts.legacyVersion).toBe('1.1.0');
    expect(artifacts.legacyReferencePopulation).toBeUndefined();
    expect(artifacts.rulesetVersion).toBe('1.3.0');
    expect(artifacts.contentPackVersion).toBe('0.5.0');
  });

  // T-7-001 D-67: 룰셋 1.4.0(팩 0.5.0)도 1.3.0과 같은 짝으로 Legacy 1.1 채점을 쓰되 매칭 reference
  // population이 없어 percentile은 숨긴다.
  it('uses Legacy 1.1 scoring for 1.4/0.5 but hides percentile without a matching reference', () => {
    const artifacts = loadRetirementArtifacts('1.4.0', '0.5.0');
    expect(artifacts.legacyVersion).toBe('1.1.0');
    expect(artifacts.legacyReferencePopulation).toBeUndefined();
    expect(artifacts.rulesetVersion).toBe('1.4.0');
    expect(artifacts.contentPackVersion).toBe('0.5.0');
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
