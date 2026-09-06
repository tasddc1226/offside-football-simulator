import { career06Settled, career06SettledEngineCommands, rulesetProto } from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import {
  createEngineClient,
  inlineSimulator,
  loadLocalCareerArchive,
  MemoryLocalStore,
  type EngineClient,
  type EngineCommand,
  type LocalStore,
  type LocalStoreTx,
} from './index.js';
import { retirementArchiveKey } from './retirement-archive.js';

const OWNER = 'owner-retirement-test';
const ARTIFACTS = {
  rulesetVersion: '1.0.0',
  rulesetChecksum: 'a'.repeat(64),
  contentPackVersion: '0.1.0',
  contentPackChecksum: 'b'.repeat(64),
} as const;

function ids(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${n++}`;
}

function create(store: LocalStore, prefix = 'cmd'): EngineClient {
  return createEngineClient({
    store,
    simulator: inlineSimulator,
    ruleset: rulesetProto,
    ownerProfileId: () => OWNER,
    retirementArtifacts: () => ARTIFACTS,
    newId: ids(prefix),
    now: () => '2026-09-05T00:00:00.000Z',
  });
}

async function settled(): Promise<{
  store: MemoryLocalStore;
  engine: EngineClient;
  careerId: string;
  revision: number;
}> {
  const store = new MemoryLocalStore();
  const engine = create(store, 'settled');
  const careerId = career06Settled.createCareer.careerId;
  for (const command of career06SettledEngineCommands(ids('fixture'))) {
    const result = await engine.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'service-season-1' } : {}),
    });
    if (!result.ok)
      throw new Error(`${command.type} failed: ${result.error.code} ${result.error.message}`);
  }
  const closeOffers: EngineCommand = {
    type: 'REJECT_OFFER',
    commandId: 'fixture-reject-offers',
    expectedRevision: career06Settled.golden.revision,
    payload: { offerId: null },
  };
  const closed = await engine.execute({ careerId, command: closeOffers });
  if (!closed.ok)
    throw new Error(`REJECT_OFFER failed: ${closed.error.code} ${closed.error.message}`);
  return { store, engine, careerId, revision: career06Settled.golden.revision + 1 };
}

function retire(
  commandId: string,
  expectedRevision: number,
  choice: 'RETIRE' | 'COACH_EPILOGUE' = 'RETIRE',
): EngineCommand {
  return { type: 'RETIRE', commandId, expectedRevision, payload: { choice } };
}

describe('engine retirement archive integration', () => {
  it('concurrently resolves one RETIRE command once and replays duplicates across clients', async () => {
    const { store, careerId, revision } = await settled();
    const command = retire('retire-once', revision);
    const engines = [create(store, 'a'), create(store, 'b')];
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => engines[i % 2]!.execute({ careerId, command })),
    );

    expect(results.filter((result) => result.ok && !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.ok && result.replayed)).toHaveLength(results.length - 1);
    const state = await store.transaction('readonly', async (tx) => ({
      career: await tx.careers.get(careerId),
      logs: await tx.commandLog.listSince(careerId, 0),
      archive: await tx.kv.get(retirementArchiveKey(careerId)),
    }));
    expect(state.career?.revision).toBe(revision + 1);
    expect(state.career?.status).toBe('RETIRED');
    expect(state.logs.filter((entry) => entry.commandType === 'RETIRE')).toHaveLength(1);
    expect(state.archive).toBeDefined();
  });

  it('rejects different command IDs racing at one revision with one CAS winner', async () => {
    const { store, careerId, revision } = await settled();
    const [a, b] = await Promise.all([
      create(store, 'race-a').execute({ careerId, command: retire('retire-a', revision) }),
      create(store, 'race-b').execute({
        careerId,
        command: retire('retire-b', revision, 'COACH_EPILOGUE'),
      }),
    ]);

    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((result) => !result.ok)).toMatchObject({
      error: { code: 'CAREER_REVISION_CONFLICT' },
    });
  });

  it('rejects reused command IDs with a different choice or career', async () => {
    const first = await settled();
    const firstResult = await first.engine.execute({
      careerId: first.careerId,
      command: retire('same-id', first.revision),
    });
    expect(firstResult.ok).toBe(true);
    const changed = await first.engine.execute({
      careerId: first.careerId,
      command: retire('same-id', first.revision, 'COACH_EPILOGUE'),
    });
    expect(changed).toMatchObject({ ok: false, error: { code: 'COMMAND_ALREADY_RESOLVED' } });

    const otherCareer = await first.engine.execute({
      careerId: 'different-career',
      command: retire('same-id', first.revision),
    });
    expect(otherCareer).toMatchObject({ ok: false, error: { code: 'COMMAND_ALREADY_RESOLVED' } });
  });

  it('does not write when artifact resolution is missing or fails', async () => {
    const { store, careerId, revision } = await settled();
    const noArtifacts = createEngineClient({
      store,
      simulator: inlineSimulator,
      ruleset: rulesetProto,
      ownerProfileId: () => OWNER,
    });
    const result = await noArtifacts.execute({
      careerId,
      command: retire('missing-artifacts', revision),
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'VERSION_MISMATCH' } });
    const state = await store.transaction('readonly', async (tx) => ({
      career: await tx.careers.get(careerId),
      logs: await tx.commandLog.listSince(careerId, 0),
      archive: await tx.kv.get(retirementArchiveKey(careerId)),
    }));
    expect(state.career?.revision).toBe(revision);
    expect(state.logs).toHaveLength(revision);
    expect(state.archive).toBeUndefined();

    for (const [label, resolver] of [
      [
        'throws',
        () => {
          throw new Error('resolver failure');
        },
      ],
      ['wrong-version', () => ({ ...ARTIFACTS, rulesetVersion: '9.9.9' })],
      ['bad-checksum', () => ({ ...ARTIFACTS, rulesetChecksum: 'not-a-checksum' })],
    ] as const) {
      const failed = createEngineClient({
        store,
        simulator: inlineSimulator,
        ruleset: rulesetProto,
        ownerProfileId: () => OWNER,
        retirementArtifacts: resolver,
      }).execute({ careerId, command: retire(`missing-${label}`, revision) });
      await expect(failed).resolves.toMatchObject({ ok: false });
      const after = await store.transaction('readonly', async (tx) => ({
        career: await tx.careers.get(careerId),
        logs: await tx.commandLog.listSince(careerId, 0),
        archive: await tx.kv.get(retirementArchiveKey(careerId)),
      }));
      expect(after.career?.revision).toBe(revision);
      expect(after.logs).toHaveLength(revision);
      expect(after.archive).toBeUndefined();
    }
  });

  it('rolls back archive, snapshot, log, career, and idempotency when a later write fails', async () => {
    const base = await settled();
    const failingStore: LocalStore = {
      kind: base.store.kind,
      close: () => base.store.close(),
      transaction<T>(
        mode: 'readonly' | 'readwrite',
        run: (tx: LocalStoreTx) => Promise<T>,
      ): Promise<T> {
        return base.store.transaction(mode, (tx) =>
          run({
            ...tx,
            commandLog: {
              ...tx.commandLog,
              append: async () => {
                throw new Error('injected append failure');
              },
            },
          }),
        );
      },
    };
    const failing = create(failingStore, 'failing');
    await expect(
      failing.execute({ careerId: base.careerId, command: retire('rollback', base.revision) }),
    ).rejects.toThrow('injected append failure');
    const state = await base.store.transaction('readonly', async (tx) => ({
      career: await tx.careers.get(base.careerId),
      latest: await tx.snapshots.getLatest(base.careerId),
      logs: await tx.commandLog.listSince(base.careerId, 0),
      archive: await tx.kv.get(retirementArchiveKey(base.careerId)),
      idempotency: await tx.idempotency.get('rollback'),
    }));
    expect(state.career?.revision).toBe(base.revision);
    expect(state.latest?.revision).toBe(base.revision);
    expect(state.logs).toHaveLength(base.revision);
    expect(state.archive).toBeUndefined();
    expect(state.idempotency).toBeUndefined();
  });

  it('replays from a new client and protects archive ownership and immutability', async () => {
    const { store, careerId, revision } = await settled();
    const first = create(store, 'first');
    await first.execute({ careerId, command: retire('replay-me', revision) });
    const second = create(store, 'second');
    const replay = await second.execute({ careerId, command: retire('replay-me', revision) });
    expect(replay).toMatchObject({ ok: true, replayed: true });

    const archive = await loadLocalCareerArchive(store, careerId, OWNER, () => ARTIFACTS);
    expect(archive).not.toBeNull();
    expect(Object.isFrozen(archive)).toBe(true);
    expect(Object.isFrozen(archive!.source)).toBe(true);
    const ownerMismatch = await loadLocalCareerArchive(
      store,
      careerId,
      'someone-else',
      () => ARTIFACTS,
    );
    expect(ownerMismatch).toBeNull();
  });

  it('rejects a tampered source snapshot or archive and removes the archive with the career', async () => {
    const source = await settled();
    await source.engine.execute({
      careerId: source.careerId,
      command: retire('tamper-source', source.revision),
    });
    await source.store.transaction('readwrite', async (tx) => {
      const snapshot = await tx.snapshots.get(source.careerId, source.revision + 1);
      if (snapshot === undefined) throw new Error('retirement snapshot missing');
      const flipped = snapshot.stateHash.endsWith('0') ? '1' : '0';
      await tx.snapshots.put({ ...snapshot, stateHash: snapshot.stateHash.slice(0, -1) + flipped });
    });
    await expect(
      loadLocalCareerArchive(source.store, source.careerId, OWNER, () => ARTIFACTS),
    ).rejects.toThrow();

    const archive = await settled();
    await archive.engine.execute({
      careerId: archive.careerId,
      command: retire('tamper-archive', archive.revision),
    });
    await archive.store.transaction('readwrite', async (tx) => {
      const value = await tx.kv.get<Record<string, unknown>>(
        retirementArchiveKey(archive.careerId),
      );
      if (value === undefined) throw new Error('archive missing');
      await tx.kv.put(retirementArchiveKey(archive.careerId), { ...value, hash: 'tampered' });
    });
    await expect(
      loadLocalCareerArchive(archive.store, archive.careerId, OWNER, () => ARTIFACTS),
    ).rejects.toThrow();

    await archive.engine.deleteCareer(archive.careerId);
    const deleted = await archive.store.transaction('readonly', async (tx) => ({
      career: await tx.careers.get(archive.careerId),
      storedArchive: await tx.kv.get(retirementArchiveKey(archive.careerId)),
    }));
    expect(deleted.career).toBeUndefined();
    expect(deleted.storedArchive).toBeUndefined();
    await expect(
      loadLocalCareerArchive(archive.store, archive.careerId, OWNER, () => ARTIFACTS),
    ).resolves.toBeNull();
  });

  it('rejects ordinary commands after retirement', async () => {
    const { store, careerId, revision } = await settled();
    const engine = create(store);
    expect((await engine.execute({ careerId, command: retire('terminal', revision) })).ok).toBe(
      true,
    );
    const result = await engine.execute({
      careerId,
      command: {
        type: 'ADVANCE',
        commandId: 'after-retirement',
        expectedRevision: revision + 1,
        payload: { eligibleEvents: [] },
      },
    });
    expect(result).toMatchObject({ ok: false, error: { details: { reason: 'CAREER_RETIRED' } } });
  });
});
