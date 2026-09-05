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

async function responseFixture(runtimeArtifacts: RetirementRuntimeArtifacts = ARTIFACTS): Promise<{ response: GetCareerResponse; archive: ReturnType<typeof createCareerArchiveCore>; legacy: ReturnType<typeof createLegacyResult> }> {
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
  const legacy = createLegacyResult(archive, context, runtimeArtifacts.legacyReferencePopulation);
  return { response: { snapshot: stored, commands: [], retirementArchive: { archive: JSON.stringify(archive), legacy: JSON.stringify(legacy) } }, archive, legacy };
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
});
