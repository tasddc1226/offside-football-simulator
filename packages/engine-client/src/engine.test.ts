import { PutCareerBodySchema } from '@offside/contracts';
import { career01, career01EngineCommands, rulesetProto } from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { createEngineClient, type EngineClient } from './engine.js';
import { inlineSimulator, type Simulator } from './simulator/index.js';
import { MemoryLocalStore } from './store/memory.js';
import type { EngineCommand, ExecuteResult } from './types.js';
import { attachSimulatorHandler } from './worker/protocol.js';
import { createWorkerSimulator } from './worker/host.js';
import type { LocalStore, LocalStoreTx } from './ports/local-store.js';

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

function makeCreateCommand(careerId: string, commandId: string): EngineCommand {
  return {
    type: 'CREATE_CAREER',
    commandId,
    expectedRevision: 0,
    payload: {
      careerId,
      seed: `seed-${careerId}`,
      simulationMode: 'CHAPTER',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    },
  };
}

async function runGoldenOnFreshStore(): Promise<{ store: MemoryLocalStore; engine: EngineClient; careerId: string }> {
  const store = new MemoryLocalStore();
  const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
  const careerId = career01.createCareer.careerId;
  const commands = career01EngineCommands(makeIdGenerator('golden-cmd'));

  for (const command of commands) {
    const result = await engine.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'season-2025-26' } : {}),
    });
    if (!result.ok) {
      throw new Error(`golden 명령 실패: ${command.type} ${result.error.code} ${result.error.message}`);
    }
  }

  return { store, engine, careerId };
}

function wrapStoreWithThrowingAppend(inner: LocalStore): LocalStore {
  return {
    kind: inner.kind,
    transaction<T>(mode: 'readonly' | 'readwrite', run: (tx: LocalStoreTx) => Promise<T>): Promise<T> {
      return inner.transaction(mode, (tx) => {
        const wrapped: LocalStoreTx = {
          ...tx,
          commandLog: {
            ...tx.commandLog,
            append: () => {
              throw new Error('commandLog.append 강제 실패(테스트)');
            },
          },
        };
        return run(wrapped);
      });
    },
    close: () => inner.close(),
  };
}

async function corruptSnapshotHash(store: MemoryLocalStore, careerId: string, revision: number): Promise<void> {
  await store.transaction('readwrite', async (tx) => {
    const snapshot = await tx.snapshots.get(careerId, revision);
    if (snapshot === undefined) throw new Error(`snapshot ${revision} not found`);
    const flipped = snapshot.stateHash.endsWith('0') ? '1' : '0';
    await tx.snapshots.put({ ...snapshot, stateHash: snapshot.stateHash.slice(0, -1) + flipped });
  });
}

async function corruptCommandLogResultHash(store: MemoryLocalStore, careerId: string, revision: number): Promise<void> {
  await store.transaction('readwrite', async (tx) => {
    const entries = await tx.commandLog.listSince(careerId, 0);
    await tx.commandLog.deleteByCareer(careerId);
    for (const entry of entries) {
      if (entry.revision !== revision) {
        await tx.commandLog.append(entry);
        continue;
      }
      const flipped = entry.resultHash.endsWith('0') ? '1' : '0';
      await tx.commandLog.append({ ...entry, resultHash: entry.resultHash.slice(0, -1) + flipped });
    }
  });
}

describe('golden fixture', () => {
  it('inline 시뮬레이터로 career01을 순서대로 실행하면 golden과 일치한다', async () => {
    const { store, engine, careerId } = await runGoldenOnFreshStore();

    const career = await store.transaction('readonly', (tx) => tx.careers.get(careerId));
    expect(career?.revision).toBe(career01.golden.revision);

    const latest = await store.transaction('readonly', (tx) => tx.snapshots.getLatest(careerId));
    expect(latest?.stateHash).toBe(career01.golden.stateHash);

    const logs = await store.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, 0));
    expect(logs.length).toBe(career01.golden.revision);
    const snapshots = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer(careerId));
    expect(snapshots.length).toBe(career01.golden.revision);

    const loaded = await engine.loadCareer(careerId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.snapshot.stateHash).toBe(career01.golden.stateHash);
      expect(loaded.snapshot.revision).toBe(career01.golden.revision);
      expect(loaded.snapshot.state.rngState.draws).toBe(career01.golden.rngStateDraws);
      expect(loaded.recovered).toBeNull();
    }
  });

  it('worker 시뮬레이터로도 같은 golden 결과가 나온다', async () => {
    const channel = new MessageChannel();
    const detach = attachSimulatorHandler(channel.port2 as unknown as Parameters<typeof attachSimulatorHandler>[0]);
    const workerSimulator = createWorkerSimulator(channel.port1 as unknown as Parameters<typeof createWorkerSimulator>[0]);

    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: workerSimulator, ruleset: rulesetProto });
    const careerId = career01.createCareer.careerId;
    const commands = career01EngineCommands(makeIdGenerator('worker-cmd'));

    let last: ExecuteResult | undefined;
    for (const command of commands) {
      const result = await engine.execute({
        careerId,
        command,
        ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'season-2025-26' } : {}),
      });
      expect(result.ok).toBe(true);
      last = result;
    }

    if (!last?.ok) throw new Error('unreachable');
    expect(last.domainSnapshot.revision).toBe(career01.golden.revision);
    expect(last.domainSnapshot.stateHash).toBe(career01.golden.stateHash);
    expect(last.domainSnapshot.state.rngState.draws).toBe(career01.golden.rngStateDraws);

    workerSimulator.dispose();
    detach();
  });
});

describe('멱등성', () => {
  it('같은 commandId 100개 동시 실행은 결과 하나로 수렴한다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = 'car_idem_test';

    const createResult = await engine.execute({
      careerId,
      command: makeCreateCommand(careerId, 'create-1'),
      createdServiceSeasonId: 'season-01',
    });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) throw new Error('unreachable');

    const command: EngineCommand = {
      type: 'UPDATE_PLAYER_DRAFT',
      commandId: 'advance-shared',
      expectedRevision: createResult.domainSnapshot.revision,
      payload: { draft: { name: '테스트' } },
    };

    const results = await Promise.all(Array.from({ length: 100 }, () => engine.execute({ careerId, command })));

    expect(results.every((r) => r.ok)).toBe(true);
    const hashes = new Set(results.map((r) => (r.ok ? r.snapshot.stateHash : 'error')));
    expect(hashes.size).toBe(1);
    const replayedCount = results.filter((r) => r.ok && r.replayed).length;
    expect(replayedCount).toBe(99);

    const career = await store.transaction('readonly', (tx) => tx.careers.get(careerId));
    expect(career?.revision).toBe(createResult.domainSnapshot.revision + 1);

    const logs = await store.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, 0));
    expect(logs.length).toBe(2);
  });

  it('영속 멱등성: 새 EngineClient에서도 idempotency가 유지된다', async () => {
    const store = new MemoryLocalStore();
    const engine1 = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = 'car_persist';
    const createCommand = makeCreateCommand(careerId, 'create-1');

    const createResult = await engine1.execute({ careerId, command: createCommand, createdServiceSeasonId: 'season-01' });
    expect(createResult.ok).toBe(true);

    const engine2 = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const replay = await engine2.execute({ careerId, command: createCommand, createdServiceSeasonId: 'season-01' });
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.replayed).toBe(true);

    const logs = await store.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, 0));
    expect(logs.length).toBe(1);
  });
});

describe('revision 경쟁', () => {
  it('commandId만 다른 100개(같은 expectedRevision) 동시 실행은 하나만 성공한다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = 'car_race_test';

    const createResult = await engine.execute({
      careerId,
      command: makeCreateCommand(careerId, 'create-1'),
      createdServiceSeasonId: 'season-01',
    });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) throw new Error('unreachable');

    const baseRevision = createResult.domainSnapshot.revision;
    const commands: EngineCommand[] = Array.from({ length: 100 }, (_, i) => ({
      type: 'UPDATE_PLAYER_DRAFT',
      commandId: `race-${i}`,
      expectedRevision: baseRevision,
      payload: { draft: { name: '테스트' } },
    }));

    const results = await Promise.all(commands.map((command) => engine.execute({ careerId, command })));
    const oks = results.filter((r) => r.ok);
    const conflicts = results.filter((r): r is Extract<ExecuteResult, { ok: false }> => !r.ok);

    expect(oks.length).toBe(1);
    expect(conflicts.length).toBe(99);
    expect(conflicts.every((r) => r.error.code === 'CAREER_REVISION_CONFLICT')).toBe(true);

    const logsSinceCreate = await store.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, baseRevision));
    expect(logsSinceCreate.length).toBe(1);
  });
});

describe('쓰기 단계 충돌', () => {
  it('시뮬레이션 도중 revision이 바뀌면 CAREER_REVISION_CONFLICT이고 아무것도 추가되지 않는다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = 'car_write_conflict';

    const createResult = await engine.execute({
      careerId,
      command: makeCreateCommand(careerId, 'create-1'),
      createdServiceSeasonId: 'season-01',
    });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) throw new Error('unreachable');

    const faultySimulator: Simulator = {
      simulate: async (input) => {
        await store.transaction('readwrite', async (tx) => {
          const career = await tx.careers.get(careerId);
          if (career !== undefined) {
            await tx.careers.put({ ...career, revision: career.revision + 1 });
          }
        });
        return inlineSimulator.simulate(input);
      },
    };
    const faultyEngine = createEngineClient({ store, simulator: faultySimulator, ruleset: rulesetProto });

    const advanceCommand: EngineCommand = {
      type: 'UPDATE_PLAYER_DRAFT',
      commandId: 'advance-conflict',
      expectedRevision: createResult.domainSnapshot.revision,
      payload: { draft: { name: '테스트' } },
    };
    const result = await faultyEngine.execute({ careerId, command: advanceCommand });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CAREER_REVISION_CONFLICT');

    const logs = await store.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, 0));
    expect(logs.length).toBe(1);
    const snapshots = await store.transaction('readonly', (tx) => tx.snapshots.listByCareer(careerId));
    expect(snapshots.length).toBe(1);
    const idem = await store.transaction('readonly', (tx) => tx.idempotency.get('advance-conflict'));
    expect(idem).toBeUndefined();
  });
});

describe('롤백', () => {
  it('쓰기 트랜잭션이 throw하면 이전 상태가 유지된다', async () => {
    const inner = new MemoryLocalStore();
    const engine = createEngineClient({ store: inner, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = 'car_rollback';

    const createResult = await engine.execute({
      careerId,
      command: makeCreateCommand(careerId, 'create-1'),
      createdServiceSeasonId: 'season-01',
    });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) throw new Error('unreachable');

    const throwingStore = wrapStoreWithThrowingAppend(inner);
    const throwingEngine = createEngineClient({ store: throwingStore, simulator: inlineSimulator, ruleset: rulesetProto });

    const advanceCommand: EngineCommand = {
      type: 'UPDATE_PLAYER_DRAFT',
      commandId: 'advance-throw',
      expectedRevision: createResult.domainSnapshot.revision,
      payload: { draft: { name: '테스트' } },
    };

    await expect(throwingEngine.execute({ careerId, command: advanceCommand })).rejects.toThrow();

    const career = await inner.transaction('readonly', (tx) => tx.careers.get(careerId));
    expect(career?.revision).toBe(createResult.domainSnapshot.revision);
    const snapshots = await inner.transaction('readonly', (tx) => tx.snapshots.listByCareer(careerId));
    expect(snapshots.length).toBe(1);
  });
});

describe('복구', () => {
  it('(a) 최신 Snapshot만 변조되면 직전 정상 Snapshot부터 복구한다', async () => {
    const { store, engine, careerId } = await runGoldenOnFreshStore();
    await corruptSnapshotHash(store, careerId, career01.golden.revision);

    const loaded = await engine.loadCareer(careerId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.recovered).toEqual({ fromRevision: career01.golden.revision - 1, replayed: 1 });
      expect(loaded.snapshot.stateHash).toBe(career01.golden.stateHash);
    }

    const repaired = await store.transaction('readonly', (tx) => tx.snapshots.getLatest(careerId));
    expect(repaired?.stateHash).toBe(career01.golden.stateHash);
  });

  it('(b) 모든 Snapshot이 변조되면 로그 전체를 재생해 복구한다', async () => {
    const { store, engine, careerId } = await runGoldenOnFreshStore();
    for (let revision = 1; revision <= career01.golden.revision; revision++) {
      await corruptSnapshotHash(store, careerId, revision);
    }

    const loaded = await engine.loadCareer(careerId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.recovered).toEqual({ fromRevision: 0, replayed: career01.golden.revision });
      expect(loaded.snapshot.stateHash).toBe(career01.golden.stateHash);
    }
  });

  it('(c) 명령 로그 항목이 변조되면 VERIFICATION_FAILED(RESULT_HASH_MISMATCH)를 반환한다', async () => {
    const { store, engine, careerId } = await runGoldenOnFreshStore();
    for (let revision = 1; revision <= career01.golden.revision; revision++) {
      await corruptSnapshotHash(store, careerId, revision);
    }
    await corruptCommandLogResultHash(store, careerId, 7);

    const loaded = await engine.loadCareer(careerId);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.error.code).toBe('VERIFICATION_FAILED');
      expect(loaded.error.details).toMatchObject({ atRevision: 7, reason: 'RESULT_HASH_MISMATCH' });
    }
  });

  it('(d) 없는 careerId는 CAREER_NOT_FOUND다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });

    const loaded = await engine.loadCareer('does-not-exist');
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('CAREER_NOT_FOUND');
  });
});

describe('도메인 오류 전달', () => {
  it('이미 확정된 이벤트를 다시 RESOLVE_EVENT하면 pending이 없어 VALIDATION_FAILED이고 아무것도 저장되지 않는다', async () => {
    const { store, engine, careerId } = await runGoldenOnFreshStore();
    const template = career01.commands[4];
    if (template === undefined || template.type !== 'RESOLVE_EVENT') {
      throw new Error('fixture assumption changed: commands[4]는 RESOLVE_EVENT여야 한다.');
    }

    const command = {
      type: 'RESOLVE_EVENT',
      commandId: 'dup-resolve',
      expectedRevision: career01.golden.revision,
      payload: template.payload,
    } as EngineCommand;

    const result = await engine.execute({ careerId, command });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.details).toMatchObject({ reason: 'NO_PENDING_EVENT' });
    }

    const logs = await store.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, 0));
    expect(logs.length).toBe(career01.golden.revision);
  });
});

describe('buildSyncBody / markSynced', () => {
  it('golden 실행 뒤 baseRevision 0·commands N개가 PutCareerBodySchema를 통과한다', async () => {
    const { engine, careerId } = await runGoldenOnFreshStore();

    const body = await engine.buildSyncBody(careerId);
    expect(body).not.toBeNull();
    if (body === null) throw new Error('unreachable');
    expect(body.baseRevision).toBe(0);
    expect(body.commands.length).toBe(career01.golden.revision);
    expect(PutCareerBodySchema.safeParse(body).success).toBe(true);

    await engine.markSynced(careerId, career01.golden.revision);
    const afterSync = await engine.buildSyncBody(careerId);
    expect(afterSync).toBeNull();
  });

  it('markSynced(5) 뒤에는 revision 6부터의 명령만 남는다', async () => {
    const { engine, careerId } = await runGoldenOnFreshStore();

    await engine.markSynced(careerId, 5);
    const body = await engine.buildSyncBody(careerId);
    expect(body).not.toBeNull();
    if (body === null) throw new Error('unreachable');
    expect(body.baseRevision).toBe(5);
    const expectedRevisions = Array.from(
      { length: career01.golden.revision - 5 },
      (_, i) => i + 6,
    );
    expect(body.commands.map((c) => c.revision)).toEqual(expectedRevisions);
    expect(PutCareerBodySchema.safeParse(body).success).toBe(true);
  });
});
