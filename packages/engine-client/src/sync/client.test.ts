import { ErrorEnvelopeSchema, IDEMPOTENCY_KEY_HEADER, IF_MATCH_HEADER, type ErrorCode } from '@offside/contracts';
import { rulesetProto } from '@offside/fixtures';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEngineClient, type EngineClient } from '../engine.js';
import { LocalStoreConstraintError } from '../ports/local-store.js';
import { inlineSimulator } from '../simulator/index.js';
import { MemoryLocalStore } from '../store/memory.js';
import type { EngineCommand } from '../types.js';
import { createSyncClient } from './client.js';
import type { CareerSyncState, SyncClient, SyncDeps, SyncTransportResponse } from './types.js';

function createCareerCommand(careerId: string, commandId: string): EngineCommand {
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

/**
 * DRAFT 상태에서도 성공하는 범용 "다음 명령". sync 테스트는 이 명령이 무엇인지보다 revision을
 * 올리는 성공한 명령이라는 점만 쓰므로 UPDATE_PLAYER_DRAFT로 충분하다(commandId별로 draft.name이
 * 달라 서로 다른 stateHash를 만든다).
 */
function advanceCommand(expectedRevision: number, commandId: string): EngineCommand {
  // draftRules.nameMax(12) 안에 들어가야 하므로 commandId를 그대로 잘라 쓴다.
  return {
    type: 'UPDATE_PLAYER_DRAFT',
    payload: { draft: { name: commandId.slice(0, 12) } },
    commandId,
    expectedRevision,
  };
}

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

function makeResponse(status: number, data: unknown): SyncTransportResponse {
  return { status, headers: new Headers(), json: async () => data };
}

function successData(data: unknown, meta: Record<string, unknown> = {}): unknown {
  return { data, meta: { requestId: 'req_test', ...meta } };
}

function errorData(code: ErrorCode, retryable: boolean, details?: unknown): unknown {
  const body = {
    error: { code, message: `오류: ${code}`, retryable, ...(details !== undefined ? { details } : {}) },
    meta: { requestId: 'req_test' },
  };
  expect(ErrorEnvelopeSchema.safeParse(body).success).toBe(true);
  return body;
}

type FetchCall = { url: string; init: RequestInit };

function createFakeFetch(): {
  fetchFn: (url: string, init: RequestInit) => Promise<SyncTransportResponse>;
  calls: FetchCall[];
  queue: Array<() => SyncTransportResponse | Promise<SyncTransportResponse>>;
} {
  const calls: FetchCall[] = [];
  const queue: Array<() => SyncTransportResponse | Promise<SyncTransportResponse>> = [];
  const fetchFn = async (url: string, init: RequestInit): Promise<SyncTransportResponse> => {
    calls.push({ url, init });
    const handler = queue.shift();
    if (handler === undefined) throw new Error('fetch 큐가 비어 있다(테스트 설정 오류)');
    return handler();
  };
  return { fetchFn, calls, queue };
}

function headerOf(call: FetchCall, name: string): string | undefined {
  return (call.init.headers as Record<string, string>)[name];
}

function parsedBody(call: FetchCall): { baseRevision: number; commands: Array<{ revision: number }>; snapshot: { revision: number } } {
  return JSON.parse(call.init.body as string);
}

type Harness = {
  store: MemoryLocalStore;
  engine: EngineClient;
  careerId: string;
  fetchFn: ReturnType<typeof createFakeFetch>['fetchFn'];
  calls: FetchCall[];
  queue: ReturnType<typeof createFakeFetch>['queue'];
  sync: SyncClient;
  states: Array<{ careerId: string; state: CareerSyncState }>;
  online: { value: boolean };
};

function setup(policyOverride?: Partial<import('./types.js').SyncPolicy>): Harness {
  const store = new MemoryLocalStore();
  const engine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
  const careerId = 'car_sync_test';
  const { fetchFn, calls, queue } = createFakeFetch();
  const online = { value: true };
  const states: Array<{ careerId: string; state: CareerSyncState }> = [];

  const deps: SyncDeps = {
    engine,
    store,
    fetch: fetchFn,
    baseUrl: '/v1',
    now: () => new Date().toISOString(),
    newId: makeIdGenerator('idem'),
    online: () => online.value,
    ...(policyOverride !== undefined ? { policy: policyOverride } : {}),
  };
  const sync = createSyncClient(deps);
  sync.subscribe((id, state) => states.push({ careerId: id, state }));

  return { store, engine, careerId, fetchFn, calls, queue, sync, states, online };
}

async function commit(
  h: Harness,
  command: EngineCommand,
  createdServiceSeasonId?: string,
): Promise<Extract<Awaited<ReturnType<EngineClient['execute']>>, { ok: true }>> {
  const result = await h.engine.execute({
    careerId: h.careerId,
    command,
    ...(createdServiceSeasonId !== undefined ? { createdServiceSeasonId } : {}),
  });
  if (!result.ok) throw new Error(`execute 실패: ${result.error.code} ${result.error.message}`);
  return result;
}

async function commitAndNotify(h: Harness, command: EngineCommand, createdServiceSeasonId?: string): Promise<void> {
  const result = await commit(h, command, createdServiceSeasonId);
  h.sync.notifyCommitted(h.careerId, result.domainSnapshot);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSyncClient', () => {
  it('연속 명령이 debounce 후 PUT 1회로 합쳐지고 성공하면 IDLE이 된다', async () => {
    const h = setup();
    const ids = makeIdGenerator('cmd');

    await commitAndNotify(h, createCareerCommand(h.careerId, ids()), 'season-1');
    h.queue.push(() => makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:00.000Z' })));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.calls).toHaveLength(1);

    await commitAndNotify(h, advanceCommand(1, ids()));
    await commitAndNotify(h, advanceCommand(2, ids()));
    await commitAndNotify(h, advanceCommand(3, ids()));

    expect(h.calls).toHaveLength(1);
    expect(h.sync.getState(h.careerId).kind).toBe('SCHEDULED');

    h.queue.push(() => makeResponse(200, successData({ revision: 4, syncedAt: '2026-01-01T00:00:01.000Z' })));
    await vi.advanceTimersByTimeAsync(1500);

    expect(h.calls).toHaveLength(2);
    const body = parsedBody(h.calls[1] as FetchCall);
    expect(body.baseRevision).toBe(1);
    expect(body.commands.map((c) => c.revision)).toEqual([2, 3, 4]);

    const state = h.sync.getState(h.careerId);
    expect(state).toEqual({ kind: 'IDLE', lastSyncedRevision: 4, lastSyncedAt: '2026-01-01T00:00:01.000Z' });
  });

  it('immediateCheckpoints 유형은 타이머 대기 없이 바로 전송된다', async () => {
    const h = setup();
    h.queue.push(() => makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:00.000Z' })));

    await commitAndNotify(h, createCareerCommand(h.careerId, 'cmd-0'), 'season-1');
    await vi.advanceTimersByTimeAsync(0);

    expect(h.calls).toHaveLength(1);
    expect(h.sync.getState(h.careerId)).toEqual({
      kind: 'IDLE',
      lastSyncedRevision: 1,
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('5xx 3회 뒤 200: 같은 Idempotency-Key, 지수 백오프(±20% 지터), 마지막에 IDLE', async () => {
    const h = setup();
    h.queue.push(() => makeResponse(503, errorData('SERVICE_UNAVAILABLE', true)));
    await commitAndNotify(h, createCareerCommand(h.careerId, 'cmd-0'), 'season-1');
    await vi.advanceTimersByTimeAsync(0);

    expect(h.calls).toHaveLength(1);
    let state = h.sync.getState(h.careerId);
    expect(state.kind).toBe('RETRYING');

    const bases = [2000, 4000, 8000];
    for (let i = 0; i < 3; i++) {
      state = h.sync.getState(h.careerId);
      if (state.kind !== 'RETRYING') throw new Error('RETRYING 상태가 아니다');
      const delay = state.nextAt - Date.now();
      expect(delay).toBeGreaterThanOrEqual(bases[i]! * 0.8);
      expect(delay).toBeLessThanOrEqual(bases[i]! * 1.2);

      if (i < 2) {
        h.queue.push(() => makeResponse(503, errorData('SERVICE_UNAVAILABLE', true)));
      } else {
        h.queue.push(() => makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:09.000Z' })));
      }
      await vi.advanceTimersByTimeAsync(delay);
    }

    expect(h.calls).toHaveLength(4);
    const keys = new Set(h.calls.map((c) => headerOf(c, IDEMPOTENCY_KEY_HEADER)));
    expect(keys.size).toBe(1);
    expect(h.sync.getState(h.careerId)).toEqual({
      kind: 'IDLE',
      lastSyncedRevision: 1,
      lastSyncedAt: '2026-01-01T00:00:09.000Z',
    });
  });

  it('online() === false면 fetch 없이 OFFLINE이 되고, online 복귀 후 flush로 재개한다', async () => {
    const h = setup();
    h.online.value = false;

    await commitAndNotify(h, createCareerCommand(h.careerId, 'cmd-0'), 'season-1');
    await vi.advanceTimersByTimeAsync(0);

    expect(h.calls).toHaveLength(0);
    const offline = h.sync.getState(h.careerId);
    expect(offline.kind).toBe('OFFLINE');

    h.online.value = true;
    h.queue.push(() => makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:00.000Z' })));
    await h.sync.flush(h.careerId);

    expect(h.calls).toHaveLength(1);
    expect(h.sync.getState(h.careerId).kind).toBe('IDLE');
  });

  it('네트워크 예외(온라인 상태)는 RETRYING으로 분류된다', async () => {
    const h = setup();
    h.queue.push(() => {
      throw new Error('일시적 네트워크 오류');
    });

    await commitAndNotify(h, createCareerCommand(h.careerId, 'cmd-0'), 'season-1');
    await vi.advanceTimersByTimeAsync(0);

    expect(h.calls).toHaveLength(1);
    expect(h.sync.getState(h.careerId).kind).toBe('RETRYING');
  });

  it('loadCareer가 저장소 I/O 오류로 throw해도 unhandled rejection 없이 RETRYING으로 처리된다', async () => {
    const store = new MemoryLocalStore();
    const realEngine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = 'car_io_fail';
    let failNext = true;
    const flakyEngine = {
      ...realEngine,
      loadCareer: (id: string) => {
        if (failNext) {
          failNext = false;
          return Promise.reject(new Error('IndexedDB 트랜잭션 실패(테스트)'));
        }
        return realEngine.loadCareer(id);
      },
    };
    const { fetchFn, calls, queue } = createFakeFetch();
    const sync = createSyncClient({
      engine: flakyEngine,
      store,
      fetch: fetchFn,
      baseUrl: '/v1',
      now: () => new Date().toISOString(),
      newId: makeIdGenerator('idem'),
    });

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const created = await realEngine.execute({
        careerId,
        command: createCareerCommand(careerId, 'cmd-0'),
        createdServiceSeasonId: 'season-1',
      });
      if (!created.ok) throw new Error('setup 실패');
      sync.notifyCommitted(careerId, created.domainSnapshot);
      await vi.advanceTimersByTimeAsync(0);

      expect(calls).toHaveLength(0);
      expect(sync.getState(careerId).kind).toBe('RETRYING');

      queue.push(() => makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:00.000Z' })));
      const retrying = sync.getState(careerId);
      if (retrying.kind !== 'RETRYING') throw new Error('RETRYING 상태가 아니다');
      await vi.advanceTimersByTimeAsync(retrying.nextAt - Date.now());

      expect(calls).toHaveLength(1);
      expect(sync.getState(careerId).kind).toBe('IDLE');
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    expect(unhandled).toEqual([]);
  });

  it('전송 중 새 명령이 확정되면 완료 뒤 곧바로 두 번째 PUT을 보낸다(baseRevision = 첫 응답 revision)', async () => {
    const h = setup();
    let resolveFirst!: (r: SyncTransportResponse) => void;
    const firstResponse = new Promise<SyncTransportResponse>((resolve) => {
      resolveFirst = resolve;
    });
    h.queue.push(() => firstResponse);

    await commitAndNotify(h, createCareerCommand(h.careerId, 'cmd-0'), 'season-1');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.calls).toHaveLength(1);
    expect(h.sync.getState(h.careerId).kind).toBe('SYNCING');

    await commitAndNotify(h, advanceCommand(1, 'cmd-1'));
    expect(h.calls).toHaveLength(1);

    h.queue.push(() => makeResponse(200, successData({ revision: 2, syncedAt: '2026-01-01T00:00:01.000Z' })));
    resolveFirst(makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:00.000Z' })));
    await vi.waitFor(() => expect(h.calls).toHaveLength(2));

    const secondCall = h.calls[1] as FetchCall;
    expect(headerOf(secondCall, IF_MATCH_HEADER)).toBe('1');
    expect(parsedBody(secondCall).baseRevision).toBe(1);

    // advanceCommand의 checkpoint(CAREER_CREATED)는 immediateCheckpoints에 속하므로 dirtyImmediate로
    // 기록되어, 첫 사이클이 끝나자마자 지연 없이(0ms) 두 번째 PUT까지 곧바로 끝난다.
    await vi.waitFor(() => expect(h.sync.getState(h.careerId).kind).toBe('IDLE'));

    expect(h.calls).toHaveLength(2);
    expect(h.sync.getState(h.careerId)).toEqual({
      kind: 'IDLE',
      lastSyncedRevision: 2,
      lastSyncedAt: '2026-01-01T00:00:01.000Z',
    });
  });

  it('409 + 서버 Snapshot이 로컬 revision과 hash 동일하면 빨리감기 뒤 재전송한다', async () => {
    const h = setup();
    const ids = makeIdGenerator('cmd');

    await commit(h, createCareerCommand(h.careerId, ids()), 'season-1');
    for (let i = 0; i < 7; i++) {
      await commit(h, advanceCommand(i + 1, ids()));
    }
    const localCareer = await h.store.transaction('readonly', (tx) => tx.careers.get(h.careerId));
    expect(localCareer?.revision).toBe(8);
    const serverSnapshotAt5 = await h.store.transaction('readonly', (tx) => tx.snapshots.get(h.careerId, 5));
    if (serverSnapshotAt5 === undefined) throw new Error('revision 5 snapshot 없음');

    h.queue.push(() =>
      makeResponse(409, errorData('CAREER_REVISION_CONFLICT', false, { serverRevision: 5, serverSnapshotUrl: `/v1/careers/${h.careerId}` })),
    );
    h.queue.push(() => makeResponse(200, successData({ snapshot: serverSnapshotAt5, commands: [] })));
    h.queue.push(() => makeResponse(200, successData({ revision: 8, syncedAt: '2026-01-01T00:00:05.000Z' })));

    await h.sync.flush(h.careerId);

    expect(h.calls).toHaveLength(3);
    expect(h.calls[0]?.init.method).toBe('PUT');
    expect(h.calls[1]?.init.method).toBe('GET');
    const resendBody = parsedBody(h.calls[2] as FetchCall);
    expect(resendBody.baseRevision).toBe(5);
    expect(resendBody.commands.map((c) => c.revision)).toEqual([6, 7, 8]);
    expect(h.sync.getState(h.careerId)).toEqual({
      kind: 'IDLE',
      lastSyncedRevision: 8,
      lastSyncedAt: '2026-01-01T00:00:05.000Z',
    });
  });

  it('409 + 서버 hash가 다르면 CONFLICT로 멈추고, resolveConflict(REMOTE)가 로컬을 서버 값으로 되감는다', async () => {
    const h = setup();
    const ids = makeIdGenerator('cmd');

    await commit(h, createCareerCommand(h.careerId, ids()), 'season-1');
    await commit(h, advanceCommand(1, ids()));
    await commit(h, advanceCommand(2, ids()));
    await commit(h, advanceCommand(3, ids()));
    await commit(h, advanceCommand(4, ids()));

    const serverStore = new MemoryLocalStore();
    const serverEngine = createEngineClient({ store: serverStore, simulator: inlineSimulator, ruleset: rulesetProto });
    await serverEngine.execute({
      careerId: h.careerId,
      command: createCareerCommand(h.careerId, 'server-cmd-0'),
      createdServiceSeasonId: 'season-1',
    });
    await serverEngine.execute({ careerId: h.careerId, command: advanceCommand(1, 'server-cmd-1') });
    const serverSnapshotAt2 = await serverStore.transaction('readonly', (tx) => tx.snapshots.get(h.careerId, 2));
    if (serverSnapshotAt2 === undefined) throw new Error('server snapshot 없음');
    const localSnapshotAt2 = await h.store.transaction('readonly', (tx) => tx.snapshots.get(h.careerId, 2));
    expect(localSnapshotAt2?.stateHash).not.toBe(serverSnapshotAt2.stateHash);

    h.queue.push(() =>
      makeResponse(409, errorData('CAREER_REVISION_CONFLICT', false, { serverRevision: 2, serverSnapshotUrl: `/v1/careers/${h.careerId}` })),
    );
    h.queue.push(() => makeResponse(200, successData({ snapshot: serverSnapshotAt2, commands: [] })));

    await h.sync.flush(h.careerId);

    expect(h.calls).toHaveLength(2);
    const conflictState = h.sync.getState(h.careerId);
    expect(conflictState.kind).toBe('CONFLICT');
    if (conflictState.kind === 'CONFLICT') {
      expect(conflictState.local.revision).toBe(5);
      expect(conflictState.server.revision).toBe(2);
      expect(conflictState.server.stateHash).toBe(serverSnapshotAt2.stateHash);
    }

    const callsBeforeIdle = h.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.calls).toHaveLength(callsBeforeIdle);

    const resolvedAt = new Date().toISOString();
    await h.sync.resolveConflict(h.careerId, 'REMOTE');

    const careerAfter = await h.store.transaction('readonly', (tx) => tx.careers.get(h.careerId));
    expect(careerAfter?.revision).toBe(2);
    expect(careerAfter?.lastSyncedRevision).toBe(2);
    const snapshotAfter = await h.store.transaction('readonly', (tx) => tx.snapshots.get(h.careerId, 2));
    expect(snapshotAfter?.stateHash).toBe(serverSnapshotAt2.stateHash);

    const discarded = await h.store.transaction('readonly', (tx) =>
      tx.kv.get<{ commands: unknown[]; snapshots: unknown[] }>(`sync:discarded:${h.careerId}:${resolvedAt}`),
    );
    expect(discarded).toBeDefined();
    expect(discarded?.commands).toHaveLength(3);
    expect(discarded?.snapshots).toHaveLength(3);

    const nextBody = await h.engine.buildSyncBody(h.careerId);
    expect(nextBody).toBeNull();
  });

  it('빨리감기 뒤 또 409면 다시 CONFLICT로 멈춘다(무한 루프 없음)', async () => {
    const h = setup();
    const ids = makeIdGenerator('cmd');

    await commit(h, createCareerCommand(h.careerId, ids()), 'season-1');
    for (let i = 0; i < 7; i++) {
      await commit(h, advanceCommand(i + 1, ids()));
    }
    const serverSnapshotAt5 = await h.store.transaction('readonly', (tx) => tx.snapshots.get(h.careerId, 5));
    if (serverSnapshotAt5 === undefined) throw new Error('revision 5 snapshot 없음');

    h.queue.push(() =>
      makeResponse(409, errorData('CAREER_REVISION_CONFLICT', false, { serverRevision: 5, serverSnapshotUrl: `/v1/careers/${h.careerId}` })),
    );
    h.queue.push(() => makeResponse(200, successData({ snapshot: serverSnapshotAt5, commands: [] })));
    h.queue.push(() =>
      makeResponse(409, errorData('CAREER_REVISION_CONFLICT', false, { serverRevision: 5, serverSnapshotUrl: `/v1/careers/${h.careerId}` })),
    );
    h.queue.push(() => makeResponse(200, successData({ snapshot: serverSnapshotAt5, commands: [] })));

    await h.sync.flush(h.careerId);

    expect(h.calls).toHaveLength(4);
    expect(h.sync.getState(h.careerId).kind).toBe('CONFLICT');
  });

  it('401은 LOCAL_ONLY(NO_SESSION); 재시도 불가 4xx는 FAILED로 멈춘다', async () => {
    const h1 = setup();
    h1.queue.push(() => makeResponse(401, errorData('PROFILE_REQUIRED', false)));
    await commitAndNotify(h1, createCareerCommand(h1.careerId, 'cmd-0'), 'season-1');
    await vi.advanceTimersByTimeAsync(0);
    expect(h1.sync.getState(h1.careerId)).toEqual({ kind: 'LOCAL_ONLY', reason: 'NO_SESSION' });

    const h2 = setup();
    h2.queue.push(() => makeResponse(422, errorData('VERSION_MISMATCH', false)));
    await commitAndNotify(h2, createCareerCommand(h2.careerId, 'cmd-0'), 'season-1');
    await vi.advanceTimersByTimeAsync(0);
    const failedState = h2.sync.getState(h2.careerId);
    expect(failedState.kind).toBe('FAILED');
    if (failedState.kind === 'FAILED') {
      expect(failedState.error.code).toBe('VERSION_MISMATCH');
    }

    const callsBefore = h2.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h2.calls).toHaveLength(callsBefore);
  });

  it('dispose() 뒤에는 예약된 타이머가 발화하지 않는다', async () => {
    const h = setup();
    await commit(h, createCareerCommand(h.careerId, 'cmd-0'), 'season-1');
    await commitAndNotify(h, advanceCommand(1, 'cmd-1'));

    expect(h.sync.getState(h.careerId).kind).toBe('SCHEDULED');
    h.sync.dispose();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(h.calls).toHaveLength(0);
  });

  it('사이클이 inFlight인 동안 notifyCommitted가 오면 dirty로 기록되어, 그 사이클이 보낼 것 없이 끝나도 완료 직후 다시 전송된다', async () => {
    const store = new MemoryLocalStore();
    const realEngine = createEngineClient({ store, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerId = 'car_dirty_race';

    let resolveBody!: (v: Awaited<ReturnType<EngineClient['buildSyncBody']>>) => void;
    let bodyCallCount = 0;
    const firstBody = new Promise<Awaited<ReturnType<EngineClient['buildSyncBody']>>>((resolve) => {
      resolveBody = resolve;
    });
    const flakyEngine = {
      ...realEngine,
      buildSyncBody: (id: string) => {
        bodyCallCount += 1;
        if (bodyCallCount === 1) return firstBody;
        return realEngine.buildSyncBody(id);
      },
    };
    const { fetchFn, calls, queue } = createFakeFetch();
    const sync = createSyncClient({
      engine: flakyEngine,
      store,
      fetch: fetchFn,
      baseUrl: '/v1',
      now: () => new Date().toISOString(),
      newId: makeIdGenerator('idem'),
    });

    const created = await realEngine.execute({
      careerId,
      command: createCareerCommand(careerId, 'cmd-0'),
      createdServiceSeasonId: 'season-1',
    });
    if (!created.ok) throw new Error('setup 실패');

    // flush()가 runCycle을 동기적으로 시작해 record.inFlight를 세팅한 직후,
    // 첫 buildSyncBody 호출이 아직 대기 중인 사이(firstBody 미해결)에 notifyCommitted를 호출한다.
    const flushPromise = sync.flush(careerId);
    sync.notifyCommitted(careerId, created.domainSnapshot);
    resolveBody(null);
    await flushPromise;

    expect(calls).toHaveLength(0);
    expect(bodyCallCount).toBe(1);
    expect(sync.getState(careerId).kind).toBe('SCHEDULED');

    queue.push(() => makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:00.000Z' })));
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toHaveLength(1);
    // 후속 사이클: buildSyncBody #2(보낼 명령 있음, real) → PUT 전송 → buildSyncBody #3(보낼 것 없음, real) → IDLE.
    expect(bodyCallCount).toBe(3);
    expect(sync.getState(careerId).kind).toBe('IDLE');
  });

  it('409 뒤 fast-forward GET이 503이면 RETRYING, 재시도 후 GET이 200이면 정상 진행한다', async () => {
    const h = setup();
    const ids = makeIdGenerator('cmd');

    await commit(h, createCareerCommand(h.careerId, ids()), 'season-1');
    for (let i = 0; i < 7; i++) {
      await commit(h, advanceCommand(i + 1, ids()));
    }
    const serverSnapshotAt5 = await h.store.transaction('readonly', (tx) => tx.snapshots.get(h.careerId, 5));
    if (serverSnapshotAt5 === undefined) throw new Error('revision 5 snapshot 없음');

    h.queue.push(() =>
      makeResponse(409, errorData('CAREER_REVISION_CONFLICT', false, { serverRevision: 5, serverSnapshotUrl: `/v1/careers/${h.careerId}` })),
    );
    h.queue.push(() => makeResponse(503, errorData('SERVICE_UNAVAILABLE', true)));

    await h.sync.flush(h.careerId);

    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]?.init.method).toBe('GET');
    const retrying = h.sync.getState(h.careerId);
    expect(retrying.kind).toBe('RETRYING');
    if (retrying.kind !== 'RETRYING') throw new Error('RETRYING 상태가 아니다');

    h.queue.push(() =>
      makeResponse(409, errorData('CAREER_REVISION_CONFLICT', false, { serverRevision: 5, serverSnapshotUrl: `/v1/careers/${h.careerId}` })),
    );
    h.queue.push(() => makeResponse(200, successData({ snapshot: serverSnapshotAt5, commands: [] })));
    h.queue.push(() => makeResponse(200, successData({ revision: 8, syncedAt: '2026-01-01T00:00:05.000Z' })));

    await vi.advanceTimersByTimeAsync(retrying.nextAt - Date.now());

    expect(h.calls).toHaveLength(5);
    expect(h.sync.getState(h.careerId)).toEqual({
      kind: 'IDLE',
      lastSyncedRevision: 8,
      lastSyncedAt: '2026-01-01T00:00:05.000Z',
    });
  });

  it('LocalStoreConstraintError만 큐에서 제거하고, 그 외 저장소 I/O 예외는 재시도로 흡수한다', async () => {
    const storeA = new MemoryLocalStore();
    const realEngineA = createEngineClient({ store: storeA, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerIdA = 'car_marksync_ioerr';
    let failMarkSynced = true;
    const flakyEngineA = {
      ...realEngineA,
      markSynced: (id: string, revision: number) => {
        if (failMarkSynced) {
          failMarkSynced = false;
          return Promise.reject(new Error('저장소 쓰기 실패(테스트)'));
        }
        return realEngineA.markSynced(id, revision);
      },
    };
    const fetchA = createFakeFetch();
    const syncA = createSyncClient({
      engine: flakyEngineA,
      store: storeA,
      fetch: fetchA.fetchFn,
      baseUrl: '/v1',
      now: () => new Date().toISOString(),
      newId: makeIdGenerator('idem'),
    });

    const createdA = await realEngineA.execute({
      careerId: careerIdA,
      command: createCareerCommand(careerIdA, 'cmd-0'),
      createdServiceSeasonId: 'season-1',
    });
    if (!createdA.ok) throw new Error('setup 실패');

    fetchA.queue.push(() => makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:00.000Z' })));
    syncA.notifyCommitted(careerIdA, createdA.domainSnapshot);
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchA.calls).toHaveLength(1);
    const retryingA = syncA.getState(careerIdA);
    expect(retryingA.kind).toBe('RETRYING');
    if (retryingA.kind !== 'RETRYING') throw new Error('RETRYING 상태가 아니다(markSynced 예외가 removeRecord로 처리됨)');

    fetchA.queue.push(() => makeResponse(200, successData({ revision: 1, syncedAt: '2026-01-01T00:00:01.000Z' })));
    await vi.advanceTimersByTimeAsync(retryingA.nextAt - Date.now());

    expect(fetchA.calls).toHaveLength(2);
    expect(syncA.getState(careerIdA)).toEqual({
      kind: 'IDLE',
      lastSyncedRevision: 1,
      lastSyncedAt: '2026-01-01T00:00:01.000Z',
    });

    const storeB = new MemoryLocalStore();
    const realEngineB = createEngineClient({ store: storeB, simulator: inlineSimulator, ruleset: rulesetProto });
    const careerIdB = 'car_buildbody_constraint';
    const flakyEngineB = {
      ...realEngineB,
      buildSyncBody: (_id: string) => Promise.reject(new LocalStoreConstraintError('테스트: 계약 위반')),
    };
    const fetchB = createFakeFetch();
    const syncB = createSyncClient({
      engine: flakyEngineB,
      store: storeB,
      fetch: fetchB.fetchFn,
      baseUrl: '/v1',
      now: () => new Date().toISOString(),
      newId: makeIdGenerator('idem'),
    });

    const createdB = await realEngineB.execute({
      careerId: careerIdB,
      command: createCareerCommand(careerIdB, 'cmd-0'),
      createdServiceSeasonId: 'season-1',
    });
    if (!createdB.ok) throw new Error('setup 실패');

    syncB.notifyCommitted(careerIdB, createdB.domainSnapshot);
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchB.calls).toHaveLength(0);
    expect(syncB.getState(careerIdB)).toEqual({ kind: 'IDLE', lastSyncedRevision: 0, lastSyncedAt: null });

    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchB.calls).toHaveLength(0);
  });
});
