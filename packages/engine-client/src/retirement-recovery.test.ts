import { describe, expect, it } from 'vitest';
import { type GetCareerResponse } from '@offside/contracts';
import { createCareerArchiveCore, createLegacyResult, canonicalize, type LegacyReferencePopulation } from '@offside/domain';
import { importCareerFromServer, loadLocalCareerArchive, loadLocalLegacyResult, MemoryLocalStore } from './index.js';
import { retirementArchiveKey, legacyResultKey, type RetirementRuntimeArtifacts } from './retirement-archive.js';
import { career06Settled, career06SettledEngineCommands, rulesetProto } from '@offside/fixtures';
import { createEngineClient } from './engine.js';
import { inlineSimulator } from './simulator/index.js';

const ARTIFACTS = { rulesetVersion: '1.0.0', rulesetChecksum: 'a'.repeat(64), contentPackVersion: '0.1.0', contentPackChecksum: 'b'.repeat(64) } as const;
const POPULATION: LegacyReferencePopulation = { id: 'test-population-10k', legacyVersion: '1.0.0', rulesetVersion: '1.0.0', scores: { GK: Array(10_000).fill(50), DF: Array(10_000).fill(50), MF: Array(10_000).fill(50), FW: Array(10_000).fill(50) } };
const POPULATED_ARTIFACTS = { ...ARTIFACTS, legacyReferencePopulation: POPULATION } as const;
const VERSIONED_ARTIFACTS = { ...ARTIFACTS, legacyVersion: '1.1.0' as const };
const MISMATCHED_ARTIFACTS = { ...ARTIFACTS, legacyReferencePopulation: { ...POPULATION, id: 'different-population-10k' } } as const;

async function responseFixture(runtimeArtifacts: RetirementRuntimeArtifacts = ARTIFACTS): Promise<{ response: GetCareerResponse; archive: ReturnType<typeof createCareerArchiveCore>; legacy: ReturnType<typeof createLegacyResult>; store: MemoryLocalStore; engine: ReturnType<typeof createEngineClient> }> {
  const sourceStore = new MemoryLocalStore();
  const sourceEngine = createEngineClient({ store: sourceStore, simulator: inlineSimulator, ruleset: rulesetProto, retirementArtifacts: () => runtimeArtifacts });
  const ids = (() => { let n = 0; return () => `recovery-${n++}`; })();
  for (const command of career06SettledEngineCommands(ids)) {
    const result = await sourceEngine.execute({ careerId: career06Settled.createCareer.careerId, command, ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc_recovery' } : {}) });
    if (!result.ok) throw new Error(`${command.type} failed: ${result.error.message}`);
  }
  const current = await sourceEngine.loadCareer(career06Settled.createCareer.careerId);
  if (!current.ok) throw new Error('settled snapshot missing');
  const closed = current.snapshot.state.pending?.kind === 'OFFERS' || current.snapshot.state.pending?.kind === 'CONTRACT'
    ? await sourceEngine.execute({ careerId: career06Settled.createCareer.careerId, command: { type: 'REJECT_OFFER', commandId: 'recovery-close', expectedRevision: current.snapshot.revision, payload: { offerId: null } } })
    : current;
  if (!closed.ok) throw new Error('market close failed');
  const retired = await sourceEngine.execute({ careerId: career06Settled.createCareer.careerId, command: { type: 'RETIRE', commandId: 'recovery-retire', expectedRevision: closed.snapshot.revision, payload: { choice: 'RETIRE' } } });
  if (!retired.ok) throw new Error(`retire failed: ${retired.error.code} ${retired.error.message}`);
  const stored = retired.snapshot;
  const careerId = career06Settled.createCareer.careerId;
  const snapshot = { id: stored.id, careerId: stored.careerId, revision: stored.revision, checkpoint: stored.checkpoint, state: JSON.parse(stored.state), stateHash: stored.stateHash, rulesetVersion: stored.rulesetVersion, contentPackVersion: stored.contentPackVersion, rngState: stored.rngState, createdAt: stored.createdAt } as Parameters<typeof createCareerArchiveCore>[0];
  const context = { binding: { careerId, createdServiceSeasonId: 'svc_recovery', rulesetVersion: snapshot.rulesetVersion, contentPackVersion: snapshot.contentPackVersion }, artifacts: runtimeArtifacts };
  const archive = createCareerArchiveCore(snapshot, context);
  const legacy = createLegacyResult(
    archive,
    context,
    runtimeArtifacts.legacyReferencePopulation,
    runtimeArtifacts.legacyVersion ?? '1.0.0',
  );
  return { response: { createdServiceSeasonId: 'svc_recovery', snapshot: stored, commands: [], retirementArchive: { archive: JSON.stringify(archive), legacy: JSON.stringify(legacy) } }, archive, legacy, store: sourceStore, engine: sourceEngine };
}

describe('retirement recovery roundtrip', () => {
  it('imports and reloads immutable Archive and Legacy bytes exactly', async () => {
    const source = await responseFixture();
    const store = new MemoryLocalStore();
    const result = await importCareerFromServer(store, source.response, { createdServiceSeasonId: source.archive.binding.createdServiceSeasonId, now: '2026-09-05T00:00:00.000Z', retirementArtifacts: () => ARTIFACTS });
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message} ${JSON.stringify(result.error.details ?? {})}`);
    expect(result.ok).toBe(true);
    const loadedArchive = await loadLocalCareerArchive(store, source.archive.binding.careerId, null, () => ARTIFACTS);
    const loadedLegacy = await loadLocalLegacyResult(store, source.archive.binding.careerId, null, () => ARTIFACTS);
    expect(canonicalize(loadedArchive as never)).toBe(canonicalize(source.archive as never));
    expect(canonicalize(loadedLegacy as never)).toBe(canonicalize(source.legacy as never));
  });

  it('rejects tampered retirement result without creating any local rows', async () => {
    const source = await responseFixture();
    const tampered = { ...source.response, retirementArchive: { ...source.response.retirementArchive!, legacy: source.response.retirementArchive!.legacy.replace('legacyVersion', 'legacyVersionTampered') } };
    const store = new MemoryLocalStore();
    const result = await importCareerFromServer(store, tampered, { createdServiceSeasonId: source.archive.binding.createdServiceSeasonId, now: '2026-09-05T00:00:00.000Z', retirementArtifacts: () => ARTIFACTS });
    expect(result.ok).toBe(false);
    const rows = await store.transaction('readonly', async (tx) => ({ careers: await tx.careers.list(), archive: await tx.kv.get(retirementArchiveKey(source.archive.binding.careerId)), legacy: await tx.kv.get(legacyResultKey(source.archive.binding.careerId)) }));
    expect(rows.careers).toHaveLength(0);
    expect(rows.archive).toBeUndefined();
    expect(rows.legacy).toBeUndefined();
  });

  it('protects unsynced local progress from a retired server import', async () => {
    const source = await responseFixture();
    const store = new MemoryLocalStore();
    await store.transaction('readwrite', async (tx) => tx.careers.put({ id: source.archive.binding.careerId, ownerProfileId: null, status: 'ACTIVE', revision: source.response.snapshot.revision + 1, lastSyncedRevision: source.response.snapshot.revision - 1, createdServiceSeasonId: 'local', rulesetVersion: '1.0.0', contentPackVersion: '0.1.0', createdAt: '2026-09-05T00:00:00.000Z', updatedAt: '2026-09-05T00:00:00.000Z' }));
    const result = await importCareerFromServer(store, source.response, { createdServiceSeasonId: source.archive.binding.createdServiceSeasonId, now: '2026-09-05T00:00:00.000Z', retirementArtifacts: () => ARTIFACTS });
    expect(result).toMatchObject({ ok: false, error: { code: 'CAREER_REVISION_CONFLICT' } });
  });

  it('passes an optional 10k reference population through persist and import without changing Archive identity', async () => {
    const source = await responseFixture(POPULATED_ARTIFACTS);
    expect(source.legacy.percentileHidden).toBe(false);
    expect(source.legacy.referencePopulationId).toBe(POPULATION.id);
    const store = new MemoryLocalStore();
    const result = await importCareerFromServer(store, source.response, { createdServiceSeasonId: source.archive.binding.createdServiceSeasonId, now: '2026-09-05T00:00:00.000Z', retirementArtifacts: () => POPULATED_ARTIFACTS });
    expect(result.ok).toBe(true);
    const archive = await loadLocalCareerArchive(store, source.archive.binding.careerId, null, () => POPULATED_ARTIFACTS);
    const legacy = await loadLocalLegacyResult(store, source.archive.binding.careerId, null, () => POPULATED_ARTIFACTS);
    expect(archive?.hash).toBe(source.archive.hash);
    expect(legacy?.hash).toBe(source.legacy.hash);
    expect(legacy?.referencePopulationId).toBe(POPULATION.id);
    expect(legacy?.percentileHidden).toBe(false);
  });

  it('preserves an older hidden Legacy when the resolver advances policy and population', async () => {
    const source = await responseFixture();
    const store = new MemoryLocalStore();
    const advancedArtifacts = { ...VERSIONED_ARTIFACTS, legacyReferencePopulation: { ...POPULATION, legacyVersion: '1.1.0' } };
    const result = await importCareerFromServer(store, source.response, { createdServiceSeasonId: source.archive.binding.createdServiceSeasonId, now: '2026-09-05T00:00:00.000Z', retirementArtifacts: () => advancedArtifacts });
    expect(result.ok).toBe(true);
    const loaded = await loadLocalLegacyResult(store, source.archive.binding.careerId, null, () => advancedArtifacts);
    expect(loaded?.referencePopulationId).toBeNull();
    expect(loaded?.percentileHidden).toBe(true);
    expect(loaded?.hash).toBe(source.legacy.hash);
  });

  it('rejects a populated Legacy when the resolver is missing or has a different population', async () => {
    const source = await responseFixture(POPULATED_ARTIFACTS);
    for (const artifacts of [ARTIFACTS, MISMATCHED_ARTIFACTS]) {
      const store = new MemoryLocalStore();
      const result = await importCareerFromServer(store, source.response, { createdServiceSeasonId: source.archive.binding.createdServiceSeasonId, now: '2026-09-05T00:00:00.000Z', retirementArtifacts: () => artifacts });
      expect(result.ok).toBe(false);
      const rows = await store.transaction('readonly', async (tx) => ({ careers: await tx.careers.list(), archive: await tx.kv.get(retirementArchiveKey(source.archive.binding.careerId)), legacy: await tx.kv.get(legacyResultKey(source.archive.binding.careerId)) }));
      expect(rows.careers).toHaveLength(0);
      expect(rows.archive).toBeUndefined();
      expect(rows.legacy).toBeUndefined();
    }
  });

  it('does not overwrite an immutable stored Legacy when a later import has a different population', async () => {
    const hidden = await responseFixture();
    const populated = await responseFixture(POPULATED_ARTIFACTS);
    const store = new MemoryLocalStore();
    const first = await importCareerFromServer(store, hidden.response, { createdServiceSeasonId: hidden.archive.binding.createdServiceSeasonId, now: '2026-09-05T00:00:00.000Z', retirementArtifacts: () => ARTIFACTS });
    expect(first.ok).toBe(true);
    const second = await importCareerFromServer(store, populated.response, { createdServiceSeasonId: populated.archive.binding.createdServiceSeasonId, now: '2026-09-05T00:00:00.000Z', retirementArtifacts: () => POPULATED_ARTIFACTS });
    expect(second.ok).toBe(false);
    const stored = await store.transaction('readonly', (tx) => tx.kv.get(legacyResultKey(hidden.archive.binding.careerId)));
    expect(stored).toEqual(hidden.legacy);
  });

  it('pins the stored population for retired sync and omits it for active sync', async () => {
    const hidden = await responseFixture();
    const hiddenBody = await hidden.engine.buildSyncBody(hidden.archive.binding.careerId);
    expect(hiddenBody).toMatchObject({ retirementReferencePopulationId: null });
    expect(hiddenBody?.snapshot.stateHash).toBe(hidden.response.snapshot.stateHash);

    const populated = await responseFixture(POPULATED_ARTIFACTS);
    const populatedBody = await populated.engine.buildSyncBody(populated.archive.binding.careerId);
    expect(populatedBody).toMatchObject({ retirementReferencePopulationId: POPULATION.id });
    expect(populatedBody?.snapshot.stateHash).toBe(populated.response.snapshot.stateHash);

    await populated.store.transaction('readwrite', async (tx) => {
      const career = await tx.careers.get(populated.archive.binding.careerId);
      if (career === undefined) throw new Error('career missing');
      await tx.careers.put({ ...career, status: 'ACTIVE' });
    });
    const activeBody = await populated.engine.buildSyncBody(populated.archive.binding.careerId);
    expect(activeBody).not.toBeNull();
    expect(activeBody).not.toHaveProperty('retirementReferencePopulationId');
  });

  it('rejects a retired sync body when the stored population pin is malformed', async () => {
    const source = await responseFixture();
    await source.store.transaction('readwrite', (tx) =>
      tx.kv.put(legacyResultKey(source.archive.binding.careerId), {
        ...source.legacy,
        referencePopulationId: '   ',
      }),
    );
    await expect(source.engine.buildSyncBody(source.archive.binding.careerId)).rejects.toThrow(
      'referencePopulationId가 유효하지 않다',
    );
  });

  it('preserves an explicit 1.1.0 Legacy version in the sync body', async () => {
    const source = await responseFixture(VERSIONED_ARTIFACTS);
    expect(source.legacy.legacyVersion).toBe('1.1.0');
    const body = await source.engine.buildSyncBody(source.archive.binding.careerId);
    expect(body).toMatchObject({ retirementLegacyVersion: '1.1.0' });
  });

  it('pins a core-only archive on first 1.1.0 local derivation before sync', async () => {
    const source = await responseFixture();
    await source.store.transaction('readwrite', (tx) =>
      tx.kv.delete(legacyResultKey(source.archive.binding.careerId)),
    );
    const derived = await loadLocalLegacyResult(
      source.store,
      source.archive.binding.careerId,
      null,
      () => VERSIONED_ARTIFACTS,
    );
    expect(derived?.legacyVersion).toBe('1.1.0');
    const stored = await source.store.transaction('readonly', (tx) =>
      tx.kv.get<ReturnType<typeof createLegacyResult>>(legacyResultKey(source.archive.binding.careerId)),
    );
    expect(stored?.legacyVersion).toBe('1.1.0');
    expect(await source.engine.buildSyncBody(source.archive.binding.careerId)).toMatchObject({
      retirementLegacyVersion: '1.1.0',
    });
  });
});
