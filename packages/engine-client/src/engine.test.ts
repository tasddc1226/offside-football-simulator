import { PutCareerBodySchema, REQUEST_BODY_MAX_BYTES } from '@offside/contracts';
import {
  career01,
  career01EngineCommands,
  career04GkEngineCommands,
  rulesetProto,
} from '@offside/fixtures';
import {
  canonicalize,
  hashState,
  type CareerState,
  type JsonValue,
  type Ruleset,
} from '@offside/domain';
import ruleset170Raw from '../../content/rulesets/1.7.0/ruleset.json' with { type: 'json' };
import ruleset174Raw from '../../content/rulesets/1.7.4/ruleset.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';
import { createEngineClient, type EngineClient } from './engine.js';
import { inlineSimulator, type Simulator } from './simulator/index.js';
import { MemoryLocalStore } from './store/memory.js';
import type { EngineCommand, ExecuteResult } from './types.js';
import { createSyncClient } from './sync/client.js';
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

async function runGoldenOnFreshStore(): Promise<{
  store: MemoryLocalStore;
  engine: EngineClient;
  careerId: string;
}> {
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
      throw new Error(
        `golden 명령 실패: ${command.type} ${result.error.code} ${result.error.message}`,
      );
    }
  }

  return { store, engine, careerId };
}

async function runLedgerCareer(
  stopAfterSeasonStart = true,
): Promise<{ store: MemoryLocalStore; engine: EngineClient; careerId: string }> {
  const store = new MemoryLocalStore();
  const ruleset = ruleset170Raw as unknown as Ruleset;
  const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset });
  let id = 0;
  let careerId = '';
  for (const source of career04GkEngineCommands(() => `ledger-engine-${++id}`)) {
    const command = structuredClone(source);
    if (command.type === 'CREATE_CAREER') {
      command.payload.rulesetVersion = '1.7.0';
      command.payload.contentPackVersion = '0.6.3';
      careerId = command.payload.careerId;
    }
    const result = await engine.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc-ledger-engine' } : {}),
    });
    if (!result.ok) throw new Error(`${command.type}: ${result.error.message}`);
    if (stopAfterSeasonStart && command.type === 'START_SEASON') return { store, engine, careerId };
  }
  return { store, engine, careerId };
}

function wrapStoreWithThrowingAppend(inner: LocalStore): LocalStore {
  return {
    kind: inner.kind,
    transaction<T>(
      mode: 'readonly' | 'readwrite',
      run: (tx: LocalStoreTx) => Promise<T>,
    ): Promise<T> {
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

async function corruptSnapshotHash(
  store: MemoryLocalStore,
  careerId: string,
  revision: number,
): Promise<void> {
  await store.transaction('readwrite', async (tx) => {
    const snapshot = await tx.snapshots.get(careerId, revision);
    if (snapshot === undefined) throw new Error(`snapshot ${revision} not found`);
    const flipped = snapshot.stateHash.endsWith('0') ? '1' : '0';
    await tx.snapshots.put({ ...snapshot, stateHash: snapshot.stateHash.slice(0, -1) + flipped });
  });
}

async function corruptCommandLogResultHash(
  store: MemoryLocalStore,
  careerId: string,
  revision: number,
): Promise<void> {
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
  it('기본 룰셋이 바뀌어도 저장 버전으로 실행·복구하고 미지원 버전은 거부한다', async () => {
    const store = new MemoryLocalStore();
    const engine = createEngineClient({
      store,
      simulator: inlineSimulator,
      ruleset: { ...rulesetProto, version: '1.1.0' },
      rulesetForVersion: (version) => {
        if (version !== rulesetProto.version) throw new Error('unsupported ruleset');
        return rulesetProto;
      },
    });
    const created = await engine.execute({
      careerId: 'pinned-old',
      command: makeCreateCommand('pinned-old', 'pinned-create'),
      createdServiceSeasonId: 'old-season',
    });
    if (!created.ok) throw new Error(created.error.message);
    await store.transaction('readwrite', (tx) => tx.snapshots.deleteByCareer('pinned-old'));
    const restored = await engine.loadCareer('pinned-old');
    expect(restored.ok && restored.snapshot.stateHash).toBe(created.domainSnapshot.stateHash);
    expect(restored.ok && restored.career.rulesetVersion).toBe('1.0.0');

    const unknown = makeCreateCommand('unknown', 'unknown-create');
    if (unknown.type !== 'CREATE_CAREER') throw new Error('create command expected');
    unknown.payload.rulesetVersion = '9.0.0';
    const rejected = await engine.execute({
      careerId: 'unknown',
      command: unknown,
      createdServiceSeasonId: 'future',
    });
    expect(!rejected.ok && rejected.error.code).toBe('VERSION_MISMATCH');
    expect((await engine.listCareers()).map((career) => career.id)).toEqual(['pinned-old']);
  });

  it('1.7.4/0.6.8 커리어를 저장하고 같은 고정 버전으로 snapshot 없는 복구까지 재생한다', async () => {
    const store = new MemoryLocalStore();
    const ruleset = ruleset174Raw as unknown as Ruleset;
    const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset });
    const command = makeCreateCommand('event-variety-save-load', 'event-variety-create');
    if (command.type !== 'CREATE_CAREER') throw new Error('create command expected');
    command.payload.rulesetVersion = '1.7.4';
    command.payload.contentPackVersion = '0.6.8';

    const created = await engine.execute({
      careerId: 'event-variety-save-load',
      command,
      createdServiceSeasonId: 'svc-event-variety',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.message);

    const syncBody = await engine.buildSyncBody('event-variety-save-load');
    expect(syncBody?.snapshot).toMatchObject({
      rulesetVersion: '1.7.4',
      contentPackVersion: '0.6.8',
      stateHash: created.domainSnapshot.stateHash,
    });
    await store.transaction('readwrite', (tx) =>
      tx.snapshots.deleteByCareer('event-variety-save-load'),
    );
    const restored = await engine.loadCareer('event-variety-save-load');
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.career).toMatchObject({
        rulesetVersion: '1.7.4',
        contentPackVersion: '0.6.8',
      });
      expect(restored.snapshot.stateHash).toBe(created.domainSnapshot.stateHash);
      expect(restored.recovered).toEqual({ fromRevision: 0, replayed: 1 });
    }
  });

  it('inline 시뮬레이터로 career01을 순서대로 실행하면 golden과 일치한다', async () => {
    const { store, engine, careerId } = await runGoldenOnFreshStore();

    const career = await store.transaction('readonly', (tx) => tx.careers.get(careerId));
    expect(career?.revision).toBe(career01.golden.revision);

    const latest = await store.transaction('readonly', (tx) => tx.snapshots.getLatest(careerId));
    expect(latest?.stateHash).toBe(career01.golden.stateHash);

    const logs = await store.transaction('readonly', (tx) => tx.commandLog.listSince(careerId, 0));
    expect(logs.length).toBe(career01.golden.revision);
    const snapshots = await store.transaction('readonly', (tx) =>
      tx.snapshots.listByCareer(careerId),
    );
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
    const detach = attachSimulatorHandler(
      channel.port2 as unknown as Parameters<typeof attachSimulatorHandler>[0],
    );
    const workerSimulator = createWorkerSimulator(
      channel.port1 as unknown as Parameters<typeof createWorkerSimulator>[0],
    );

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

    const results = await Promise.all(
      Array.from({ length: 100 }, () => engine.execute({ careerId, command })),
    );

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
    const engine1 = createEngineClient({
      store,
      simulator: inlineSimulator,
      ruleset: rulesetProto,
    });
    const careerId = 'car_persist';
    const createCommand = makeCreateCommand(careerId, 'create-1');

    const createResult = await engine1.execute({
      careerId,
      command: createCommand,
      createdServiceSeasonId: 'season-01',
    });
    expect(createResult.ok).toBe(true);

    const engine2 = createEngineClient({
      store,
      simulator: inlineSimulator,
      ruleset: rulesetProto,
    });
    const replay = await engine2.execute({
      careerId,
      command: createCommand,
      createdServiceSeasonId: 'season-01',
    });
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

    const results = await Promise.all(
      commands.map((command) => engine.execute({ careerId, command })),
    );
    const oks = results.filter((r) => r.ok);
    const conflicts = results.filter((r): r is Extract<ExecuteResult, { ok: false }> => !r.ok);

    expect(oks.length).toBe(1);
    expect(conflicts.length).toBe(99);
    expect(conflicts.every((r) => r.error.code === 'CAREER_REVISION_CONFLICT')).toBe(true);

    const logsSinceCreate = await store.transaction('readonly', (tx) =>
      tx.commandLog.listSince(careerId, baseRevision),
    );
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
    const faultyEngine = createEngineClient({
      store,
      simulator: faultySimulator,
      ruleset: rulesetProto,
    });

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
    const snapshots = await store.transaction('readonly', (tx) =>
      tx.snapshots.listByCareer(careerId),
    );
    expect(snapshots.length).toBe(1);
    const idem = await store.transaction('readonly', (tx) =>
      tx.idempotency.get('advance-conflict'),
    );
    expect(idem).toBeUndefined();
  });
});

describe('롤백', () => {
  it('쓰기 트랜잭션이 throw하면 이전 상태가 유지된다', async () => {
    const inner = new MemoryLocalStore();
    const engine = createEngineClient({
      store: inner,
      simulator: inlineSimulator,
      ruleset: rulesetProto,
    });
    const careerId = 'car_rollback';

    const createResult = await engine.execute({
      careerId,
      command: makeCreateCommand(careerId, 'create-1'),
      createdServiceSeasonId: 'season-01',
    });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) throw new Error('unreachable');

    const throwingStore = wrapStoreWithThrowingAppend(inner);
    const throwingEngine = createEngineClient({
      store: throwingStore,
      simulator: inlineSimulator,
      ruleset: rulesetProto,
    });

    const advanceCommand: EngineCommand = {
      type: 'UPDATE_PLAYER_DRAFT',
      commandId: 'advance-throw',
      expectedRevision: createResult.domainSnapshot.revision,
      payload: { draft: { name: '테스트' } },
    };

    await expect(throwingEngine.execute({ careerId, command: advanceCommand })).rejects.toThrow();

    const career = await inner.transaction('readonly', (tx) => tx.careers.get(careerId));
    expect(career?.revision).toBe(createResult.domainSnapshot.revision);
    const snapshots = await inner.transaction('readonly', (tx) =>
      tx.snapshots.listByCareer(careerId),
    );
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

    // Hash와 compact 자체 형태는 맞아도 실제 1.7 ruleset roster와 다른 latest는 ready로 선택하지 않고
    // 직전 snapshot에서 START_SEASON을 재생해 복구한다.
    const healthyRun = await runLedgerCareer();
    const healthyReload = await healthyRun.engine.loadCareer(healthyRun.careerId);
    expect(healthyReload.ok).toBe(true);
    if (!healthyReload.ok) throw new Error('정상 1.7 canonical reload 실패');
    expect(healthyReload.recovered).toBeNull();
    const roleResolved = await healthyRun.engine.execute({
      careerId: healthyRun.careerId,
      command: {
        type: 'RESOLVE_ROLE',
        commandId: 'ledger-reload-role',
        expectedRevision: healthyReload.snapshot.revision,
        payload: { decision: 'ACCEPT' },
      },
    });
    expect(roleResolved.ok).toBe(true);
    if (!roleResolved.ok) throw new Error(roleResolved.error.message);
    const reloadedForAdvance = await healthyRun.engine.loadCareer(healthyRun.careerId);
    expect(reloadedForAdvance.ok).toBe(true);
    if (!reloadedForAdvance.ok) throw new Error('ADVANCE 전 정상 1.7 reload 실패');
    const advanced = await healthyRun.engine.execute({
      careerId: healthyRun.careerId,
      command: {
        type: 'ADVANCE',
        commandId: 'ledger-reload-advance',
        expectedRevision: reloadedForAdvance.snapshot.revision,
        payload: { eligibleEvents: [] },
      },
    });
    expect(advanced.ok).toBe(true);

    const finalRun = await runLedgerCareer(false);
    const finalReload = await finalRun.engine.loadCareer(finalRun.careerId);
    expect(finalReload.ok).toBe(true);
    if (!finalReload.ok) throw new Error('final 1.7 reload 실패');
    const finalRows =
      finalReload.snapshot.state.seasonHistory.at(-1)?.result.finalLeagueTable?.rows;
    expect(finalRows).toBeDefined();
    expect(finalRows?.every((row) => row.length === 11)).toBe(true);

    const brokenFinalLatest = await finalRun.store.transaction('readonly', (tx) =>
      tx.snapshots.getLatest(finalRun.careerId),
    );
    if (brokenFinalLatest === undefined) throw new Error('final latest 없음');
    const brokenFinalState = JSON.parse(brokenFinalLatest.state) as CareerState;
    const brokenFinalRow = brokenFinalState.seasonHistory.at(-1)?.result.finalLeagueTable?.rows[0];
    if (brokenFinalRow === undefined) throw new Error('final row setup 실패');
    brokenFinalRow[10] += 1;
    const brokenFinalHash = hashState(brokenFinalState);
    await finalRun.store.transaction('readwrite', (tx) =>
      tx.snapshots.put({
        ...brokenFinalLatest,
        state: canonicalize(brokenFinalState as unknown as JsonValue),
        stateHash: brokenFinalHash,
      }),
    );
    const recoveredFinal = await finalRun.engine.loadCareer(finalRun.careerId);
    expect(recoveredFinal.ok).toBe(true);
    if (recoveredFinal.ok) {
      expect(recoveredFinal.recovered).not.toBeNull();
      expect(recoveredFinal.snapshot.stateHash).not.toBe(brokenFinalHash);
    }

    const ledgerRun = await runLedgerCareer();
    const brokenLatest = await ledgerRun.store.transaction('readonly', (tx) =>
      tx.snapshots.getLatest(ledgerRun.careerId),
    );
    if (brokenLatest === undefined) throw new Error('ledger latest 없음');
    const brokenState = JSON.parse(brokenLatest.state) as CareerState;
    const brokenLedger = brokenState.season?.leagueLedger;
    if (brokenLedger === undefined || brokenLedger.teams[1] === undefined)
      throw new Error('ledger roster setup 실패');
    brokenLedger.teams[1] = {
      ...brokenLedger.teams[1],
      strength: brokenLedger.teams[1].strength + 1,
    };
    const brokenStateHash = hashState(brokenState);
    await ledgerRun.store.transaction('readwrite', (tx) =>
      tx.snapshots.put({
        ...brokenLatest,
        state: canonicalize(brokenState as unknown as JsonValue),
        stateHash: brokenStateHash,
      }),
    );
    const recoveredLedger = await ledgerRun.engine.loadCareer(ledgerRun.careerId);
    expect(recoveredLedger.ok).toBe(true);
    if (recoveredLedger.ok) {
      expect(recoveredLedger.recovered).toEqual({
        fromRevision: brokenLatest.revision - 1,
        replayed: 1,
      });
      expect(recoveredLedger.snapshot.stateHash).not.toBe(brokenStateHash);
    }
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

    const finalRun = await runLedgerCareer(false);
    const finalBody = await finalRun.engine.buildSyncBody(finalRun.careerId);
    if (finalBody === null) throw new Error('final 1.7 sync body 없음');
    expect(PutCareerBodySchema.safeParse(finalBody).success).toBe(true);
    let capturedInit: RequestInit | undefined;
    const sync = createSyncClient({
      engine: finalRun.engine,
      store: finalRun.store,
      fetch: async (_url, init) => {
        capturedInit = init;
        return {
          status: 200,
          headers: new Headers(),
          json: async () => ({
            data: { revision: finalBody.snapshot.revision, syncedAt: '2026-01-01T00:00:00.000Z' },
            meta: { requestId: 'req_final_ledger' },
          }),
        };
      },
      baseUrl: '/v1',
      now: () => '2026-01-01T00:00:00.000Z',
      newId: () => 'req_final_ledger',
    });
    await sync.flush(finalRun.careerId);
    expect(capturedInit?.method).toBe('PUT');
    expect(capturedInit?.body).toBe(JSON.stringify(finalBody));
    expect(new TextEncoder().encode(capturedInit?.body as string).byteLength).toBeLessThanOrEqual(
      REQUEST_BODY_MAX_BYTES,
    );
    sync.dispose();
  });

  it('markSynced(5) 뒤에는 revision 6부터의 명령만 남는다', async () => {
    const { engine, careerId } = await runGoldenOnFreshStore();

    await engine.markSynced(careerId, 5);
    const body = await engine.buildSyncBody(careerId);
    expect(body).not.toBeNull();
    if (body === null) throw new Error('unreachable');
    expect(body.baseRevision).toBe(5);
    const expectedRevisions = Array.from({ length: career01.golden.revision - 5 }, (_, i) => i + 6);
    expect(body.commands.map((c) => c.revision)).toEqual(expectedRevisions);
    expect(PutCareerBodySchema.safeParse(body).success).toBe(true);
  });
});
