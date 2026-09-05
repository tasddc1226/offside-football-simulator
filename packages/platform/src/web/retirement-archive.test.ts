import { career06Settled, career06SettledEngineCommands, rulesetProto } from '@offside/fixtures';
import {
  createEngineClient,
  inlineSimulator,
  loadLocalCareerArchive,
  type LocalStore,
  type LocalStoreTx,
} from '@offside/engine-client';
import { describe, expect, it } from 'vitest';
import { createDexieLocalStore, deleteDexieLocalStore } from './dexie-store.js';

const OWNER = 'platform-retirement-owner';
const ARTIFACTS = {
  rulesetVersion: '1.0.0',
  rulesetChecksum: 'a'.repeat(64),
  contentPackVersion: '0.1.0',
  contentPackChecksum: 'b'.repeat(64),
} as const;

let dbCounter = 1000;
function dbName(): string {
  dbCounter += 1;
  return `test-retirement-archive-${dbCounter}`;
}

function engine(store: LocalStore, prefix: string) {
  let id = 0;
  return createEngineClient({
    store,
    simulator: inlineSimulator,
    ruleset: rulesetProto,
    ownerProfileId: () => OWNER,
    retirementArtifacts: () => ARTIFACTS,
    newId: () => `${prefix}-${id++}`,
    now: () => '2026-09-05T00:00:00.000Z',
  });
}

async function seedSettled(store: LocalStore): Promise<{ careerId: string; revision: number }> {
  const client = engine(store, 'fixture');
  const careerId = career06Settled.createCareer.careerId;
  for (const command of career06SettledEngineCommands(
    (() => {
      let id = 0;
      return () => `fixture-command-${id++}`;
    })(),
  )) {
    const result = await client.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'service-season-1' } : {}),
    });
    if (!result.ok) throw new Error(`${command.type} failed: ${result.error.code}`);
  }
  const closeOffers = {
    type: 'REJECT_OFFER' as const,
    commandId: 'fixture-reject-offers',
    expectedRevision: career06Settled.golden.revision,
    payload: { offerId: null },
  };
  const result = await client.execute({ careerId, command: closeOffers });
  if (!result.ok) throw new Error(`REJECT_OFFER failed: ${result.error.code}`);
  return { careerId, revision: career06Settled.golden.revision + 1 };
}

function retire(commandId: string, expectedRevision: number) {
  return {
    type: 'RETIRE' as const,
    commandId,
    expectedRevision,
    payload: { choice: 'RETIRE' as const },
  };
}

describe('Dexie retirement archive integration (fake-indexeddb)', () => {
  it('persists one concurrent RETIRE across two handles and reloads after close/reopen', async () => {
    const name = dbName();
    const first = await createDexieLocalStore(name);
    const second = await createDexieLocalStore(name);
    try {
      const seeded = await seedSettled(first);
      const command = retire('dexie-retire-once', seeded.revision);
      const clients = [engine(first, 'handle-a'), engine(second, 'handle-b')];
      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          clients[i % 2]!.execute({ careerId: seeded.careerId, command }),
        ),
      );
      expect(results.filter((result) => result.ok && !result.replayed)).toHaveLength(1);
      expect(results.filter((result) => result.ok && result.replayed)).toHaveLength(99);

      await first.close();
      await second.close();
      const reopened = await createDexieLocalStore(name);
      try {
        const archive = await loadLocalCareerArchive(
          reopened,
          seeded.careerId,
          OWNER,
          () => ARTIFACTS,
        );
        expect(archive).not.toBeNull();
        expect(archive?.source.revision).toBe(seeded.revision + 1);
      } finally {
        await reopened.close();
      }
    } finally {
      await first.close();
      await second.close();
      await deleteDexieLocalStore(name);
    }
  });

  it('allows exactly one CAS winner for different RETIRE command IDs at one revision', async () => {
    const name = dbName();
    const store = await createDexieLocalStore(name);
    try {
      const seeded = await seedSettled(store);
      const [first, second] = await Promise.all([
        engine(store, 'cas-a').execute({
          careerId: seeded.careerId,
          command: retire('dexie-cas-a', seeded.revision),
        }),
        engine(store, 'cas-b').execute({
          careerId: seeded.careerId,
          command: {
            ...retire('dexie-cas-b', seeded.revision),
            payload: { choice: 'COACH_EPILOGUE' },
          },
        }),
      ]);
      expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
      expect([first, second].find((result) => !result.ok)).toMatchObject({
        error: { code: 'CAREER_REVISION_CONFLICT' },
      });
    } finally {
      await store.close();
      await deleteDexieLocalStore(name);
    }
  });

  it('rolls back the archive and all retirement writes when command log append fails', async () => {
    const name = dbName();
    const store = await createDexieLocalStore(name);
    try {
      const seeded = await seedSettled(store);
      const failingStore: LocalStore = {
        kind: store.kind,
        close: () => store.close(),
        transaction<T>(
          mode: 'readonly' | 'readwrite',
          run: (tx: LocalStoreTx) => Promise<T>,
        ): Promise<T> {
          return store.transaction(mode, (tx) =>
            run({
              ...tx,
              commandLog: {
                ...tx.commandLog,
                append: async () => {
                  throw new Error('forced Dexie log failure');
                },
              },
            }),
          );
        },
      };
      await expect(
        engine(failingStore, 'failing').execute({
          careerId: seeded.careerId,
          command: retire('dexie-rollback', seeded.revision),
        }),
      ).rejects.toThrow('forced Dexie log failure');

      const unchanged = await store.transaction('readonly', async (tx) => ({
        career: await tx.careers.get(seeded.careerId),
        latest: await tx.snapshots.getLatest(seeded.careerId),
        logs: await tx.commandLog.listSince(seeded.careerId, 0),
        archive: await tx.kv.get(`phase5:archive:v1:${seeded.careerId}`),
        idempotency: await tx.idempotency.get('dexie-rollback'),
      }));
      expect(unchanged.career?.revision).toBe(seeded.revision);
      expect(unchanged.latest?.revision).toBe(seeded.revision);
      expect(unchanged.logs).toHaveLength(seeded.revision);
      expect(unchanged.archive).toBeUndefined();
      expect(unchanged.idempotency).toBeUndefined();
    } finally {
      await store.close();
      await deleteDexieLocalStore(name);
    }
  });
});
