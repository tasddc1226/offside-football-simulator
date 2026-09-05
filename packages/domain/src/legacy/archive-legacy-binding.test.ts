import { describe, expect, it } from 'vitest';
import { archiveFixture, copy, rehash } from './__fixtures__/archive.js';
import { createCareerArchiveCore } from './archive.js';
import {
  bindArchiveLegacyVersion,
  planArchiveLegacyBindingWrite,
  type LegacyDefinitionBinding,
} from './archive-legacy-binding.js';

const definition: LegacyDefinitionBinding = {
  rulesetVersion: '1.0.0',
  legacyVersion: '1.0.0',
  definitionChecksum: 'c'.repeat(64),
  referencePopulationId: 'synthetic-test-reference',
  referencePopulationChecksum: 'e'.repeat(64),
};

describe('Phase 5 — append-only Legacy version binding (metadata only)', () => {
  it('pins the core hash and definition identity without editing the core or calculating a score', () => {
    const { snapshot, context } = archiveFixture();
    const archive = createCareerArchiveCore(snapshot, context);
    const before = JSON.stringify(archive);
    const binding = bindArchiveLegacyVersion(archive, context, definition);
    expect(binding).toMatchObject({
      ...definition,
      archiveId: archive.archiveId,
      archiveHash: archive.hash,
    });
    expect(Object.isFrozen(binding)).toBe(true);
    expect('totalScore' in binding).toBe(false);
    expect(JSON.stringify(archive)).toBe(before);
    expect(bindArchiveLegacyVersion(copy(archive), context, copy(definition))).toEqual(binding);
  });

  it('allocates a different key for a new version and keeps the old binding intact', () => {
    const { snapshot, context } = archiveFixture();
    const archive = createCareerArchiveCore(snapshot, context);
    const old = bindArchiveLegacyVersion(archive, context, definition);
    const next = bindArchiveLegacyVersion(archive, context, {
      ...definition,
      legacyVersion: '1.1.0',
      referencePopulationId: 'new-reference',
      definitionChecksum: 'd'.repeat(64),
    });
    expect(next.evaluationId).not.toBe(old.evaluationId);
    expect(next.archiveHash).toBe(old.archiveHash);
    expect(old.referencePopulationId).toBe('synthetic-test-reference');
  });

  it('plans insert/reuse but rejects any same-version definition or reference change', () => {
    const { snapshot, context } = archiveFixture();
    const archive = createCareerArchiveCore(snapshot, context);
    const first = planArchiveLegacyBindingWrite(null, archive, context, definition);
    expect(first.kind).toBe('INSERT');
    expect(
      planArchiveLegacyBindingWrite(copy(first.binding), archive, context, definition).kind,
    ).toBe('REUSE');
    for (const changed of [
      { ...definition, definitionChecksum: 'd'.repeat(64) },
      { ...definition, referencePopulationId: 'changed' },
    ]) {
      const next = bindArchiveLegacyVersion(archive, context, changed);
      expect(next.evaluationId).toBe(first.binding.evaluationId);
      expect(() => planArchiveLegacyBindingWrite(first.binding, archive, context, changed)).toThrow(
        'LEGACY_DEFINITION_CONFLICT',
      );
    }
  });

  it('refuses to attach an old evaluation identity to changed Archive evidence', () => {
    const { snapshot, context } = archiveFixture();
    const archive = createCareerArchiveCore(snapshot, context);
    const first = bindArchiveLegacyVersion(archive, context, definition);
    snapshot.state.age++;
    const changedArchive = createCareerArchiveCore(rehash(snapshot), context);
    expect(() => planArchiveLegacyBindingWrite(first, changedArchive, context, definition)).toThrow(
      'LEGACY_DEFINITION_CONFLICT',
    );
  });

  it.each([
    { ...definition, rulesetVersion: '2.0.0' },
    { ...definition, legacyVersion: 'latest' },
    { ...definition, definitionChecksum: 'invalid' },
    { ...definition, referencePopulationChecksum: 'invalid' },
    { ...definition, referencePopulationId: '' },
  ])('rejects unsupported or malformed definition binding %j', (invalid) => {
    const { snapshot, context } = archiveFixture();
    expect(() =>
      bindArchiveLegacyVersion(createCareerArchiveCore(snapshot, context), context, invalid),
    ).toThrow();
  });
});
