import {
  CONTENT_TYPE_HEADER,
  ErrorEnvelopeSchema,
  GetCareerResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  IF_MATCH_HEADER,
  PutCareerResponseSchema,
  REQUEST_ID_HEADER,
  RETRYABLE_BY_CODE,
  type CareerSnapshot,
  type ErrorCode,
} from '@offside/contracts';
import type { DomainSnapshot } from '@offside/domain';
import { LocalStoreConstraintError } from '../ports/local-store.js';
import { decodeSnapshot } from '../snapshot.js';
import type { EngineError } from '../types.js';
import {
  DEFAULT_SYNC_POLICY,
  type CareerSyncState,
  type SyncClient,
  type SyncDeps,
  type SyncPolicy,
  type SyncTransportResponse,
} from './types.js';

type IdempotencyMemo = { signature: string; key: string };

type CareerRecord = {
  careerId: string;
  state: CareerSyncState;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<void> | null;
  attempt: number;
  pendingSince: string | null;
  lastSyncedAt: string | null;
  idempotency: IdempotencyMemo | null;
  disposed: boolean;
  /**
   * inFlight 사이클이 끝나기 직전(예: buildSyncBody가 null을 돌려준 뒤)에
   * notifyCommitted가 도착하면 scheduleSend가 예약을 걸지 못하고 조용히 사라진다.
   * 이 창을 메우기 위해 "inFlight 종료 후 한 번 더 보내라"는 표시를 남긴다.
   */
  dirty: boolean;
  dirtyImmediate: boolean;
};

type ConflictResolution =
  | { outcome: 'fast-forward' }
  | {
      outcome: 'conflict';
      local: { revision: number; stateHash: string };
      server: { revision: number; stateHash: string; snapshot: CareerSnapshot };
    }
  | { outcome: 'stopped' };

function unwrapData(json: unknown): unknown {
  if (typeof json === 'object' && json !== null && 'data' in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

function toEngineError(err: unknown, code: ErrorCode): EngineError {
  return { code, message: err instanceof Error ? err.message : String(err) };
}

export function createSyncClient(deps: SyncDeps): SyncClient {
  const policy: SyncPolicy = { ...DEFAULT_SYNC_POLICY, ...deps.policy };
  const timers = deps.timers ?? { setTimeout, clearTimeout };
  const isOnline = deps.online ?? (() => true);

  const records = new Map<string, CareerRecord>();
  const listeners = new Set<(careerId: string, state: CareerSyncState) => void>();
  let disposed = false;

  function ensureRecord(careerId: string): CareerRecord {
    let record = records.get(careerId);
    if (record === undefined) {
      record = {
        careerId,
        state: { kind: 'IDLE', lastSyncedRevision: 0, lastSyncedAt: null },
        timer: null,
        inFlight: null,
        attempt: 0,
        pendingSince: null,
        lastSyncedAt: null,
        idempotency: null,
        disposed: false,
        dirty: false,
        dirtyImmediate: false,
      };
      records.set(careerId, record);
    }
    return record;
  }

  function removeRecord(careerId: string): void {
    const record = records.get(careerId);
    if (record !== undefined) {
      clearTimer(record);
      record.disposed = true;
    }
    records.delete(careerId);
  }

  function setState(record: CareerRecord, state: CareerSyncState): void {
    record.state = state;
    for (const listener of listeners) listener(record.careerId, state);
  }

  function clearTimer(record: CareerRecord): void {
    if (record.timer !== null) {
      timers.clearTimeout(record.timer);
      record.timer = null;
    }
  }

  function scheduleSend(record: CareerRecord, delayMs: number): void {
    if (record.inFlight !== null) {
      record.dirty = true;
      if (delayMs === 0) record.dirtyImmediate = true;
      return;
    }
    clearTimer(record);
    const dueAt = Date.now() + delayMs;
    setState(record, { kind: 'SCHEDULED', dueAt });
    record.timer = timers.setTimeout(() => {
      record.timer = null;
      void runCycle(record.careerId);
    }, delayMs);
  }

  function runCycle(careerId: string): Promise<void> {
    const record = records.get(careerId);
    if (record === undefined || record.disposed || disposed) return Promise.resolve();
    clearTimer(record);
    if (record.inFlight !== null) return record.inFlight;
    const promise = doCycle(record).finally(() => {
      if (records.get(careerId) !== record) return;
      record.inFlight = null;
      if (record.dirty && !record.disposed && !disposed) {
        const delay = record.dirtyImmediate ? 0 : policy.debounceMs;
        record.dirty = false;
        record.dirtyImmediate = false;
        scheduleSend(record, delay);
      }
    });
    record.inFlight = promise;
    return promise;
  }

  function idempotencyKeyFor(
    record: CareerRecord,
    body: { baseRevision: number; snapshot: { revision: number; stateHash: string } },
  ): string {
    const signature = `${body.baseRevision}:${body.snapshot.revision}:${body.snapshot.stateHash}`;
    if (record.idempotency !== null && record.idempotency.signature === signature) {
      return record.idempotency.key;
    }
    const key = deps.newId();
    record.idempotency = { signature, key };
    return key;
  }

  async function parseErrorEnvelope(
    response: SyncTransportResponse,
  ): Promise<{ code: ErrorCode; message: string; details?: unknown }> {
    try {
      const json = await response.json();
      const parsed = ErrorEnvelopeSchema.parse(json);
      return parsed.error;
    } catch {
      return { code: 'SERVICE_UNAVAILABLE', message: `오류 응답을 해석할 수 없다(HTTP ${response.status}).` };
    }
  }

  /**
   * 200이 아닌 응답을 401/CAREER_REVISION_CONFLICT 이외의 경우로 분류한다.
   * PUT·GET(fast-forward 조회) 양쪽에서 공유한다: RETRYABLE_BY_CODE는 재시도,
   * 그 외는 FAILED.
   */
  function classifyNonConflictError(
    record: CareerRecord,
    error: { code: ErrorCode; message: string; details?: unknown },
  ): void {
    if (RETRYABLE_BY_CODE[error.code]) {
      scheduleRetry(record, {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      });
      return;
    }
    setState(record, {
      kind: 'FAILED',
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    record.attempt = 0;
  }

  function scheduleRetry(record: CareerRecord, error: EngineError): void {
    record.attempt += 1;
    if (policy.retryMaxAttempts > 0 && record.attempt > policy.retryMaxAttempts) {
      setState(record, { kind: 'FAILED', error });
      record.attempt = 0;
      return;
    }
    const raw = Math.min(policy.retryMaxMs, policy.retryBaseMs * 2 ** (record.attempt - 1));
    const jitter = 1 + (Math.random() * 0.4 - 0.2);
    const delay = Math.min(policy.retryMaxMs, Math.max(0, Math.round(raw * jitter)));
    const nextAt = Date.now() + delay;
    setState(record, { kind: 'RETRYING', attempt: record.attempt, nextAt, lastError: error });
    record.timer = timers.setTimeout(() => {
      record.timer = null;
      void runCycle(record.careerId);
    }, delay);
  }

  /**
   * `LocalStoreConstraintError`(예: 커리어 없음 등 계약 위반)만 큐에서 제거한다.
   * 그 외 저장소 I/O 예외는 상위(`doCycle`)로 던져 재시도로 흡수시킨다 —
   * `loadCareer`와 같은 원칙이다.
   */
  async function markSyncedSafely(careerId: string, revision: number): Promise<boolean> {
    try {
      await deps.engine.markSynced(careerId, revision);
      return true;
    } catch (err) {
      if (err instanceof LocalStoreConstraintError) {
        removeRecord(careerId);
        return false;
      }
      throw err;
    }
  }

  async function resolveRevisionConflict(
    record: CareerRecord,
    careerId: string,
    localSnapshot: { revision: number; stateHash: string },
    allowFastForward: boolean,
  ): Promise<ConflictResolution> {
    const url = `${deps.baseUrl}/careers/${careerId}`;
    let response: SyncTransportResponse;
    try {
      response = await deps.fetch(url, { method: 'GET', headers: { [REQUEST_ID_HEADER]: deps.newId() } });
    } catch (err) {
      scheduleRetry(record, toEngineError(err, 'SERVICE_UNAVAILABLE'));
      return { outcome: 'stopped' };
    }
    if (record.disposed || disposed) return { outcome: 'stopped' };

    if (response.status !== 200) {
      if (response.status === 401) {
        setState(record, { kind: 'LOCAL_ONLY', reason: 'NO_SESSION' });
        record.attempt = 0;
        return { outcome: 'stopped' };
      }
      const error = await parseErrorEnvelope(response);
      if (record.disposed || disposed) return { outcome: 'stopped' };
      classifyNonConflictError(record, error);
      return { outcome: 'stopped' };
    }

    let serverSnapshot: CareerSnapshot;
    try {
      const json = await response.json();
      serverSnapshot = GetCareerResponseSchema.parse(unwrapData(json)).snapshot;
    } catch (err) {
      scheduleRetry(record, toEngineError(err, 'SERVICE_UNAVAILABLE'));
      return { outcome: 'stopped' };
    }

    if (allowFastForward) {
      const localMatch = await deps.store.transaction('readonly', (tx) =>
        tx.snapshots.get(careerId, serverSnapshot.revision),
      );
      if (localMatch !== undefined && localMatch.stateHash === serverSnapshot.stateHash) {
        const ok = await markSyncedSafely(careerId, serverSnapshot.revision);
        return ok ? { outcome: 'fast-forward' } : { outcome: 'stopped' };
      }
    }

    return {
      outcome: 'conflict',
      local: localSnapshot,
      server: { revision: serverSnapshot.revision, stateHash: serverSnapshot.stateHash, snapshot: serverSnapshot },
    };
  }

  async function doCycle(record: CareerRecord): Promise<void> {
    try {
      await runDoCycle(record);
    } catch (err) {
      if (record.disposed || disposed) return;
      scheduleRetry(record, toEngineError(err, 'SERVICE_UNAVAILABLE'));
    }
  }

  /**
   * `loadCareer`·store 읽기는 프로그래밍 오류가 아닌 저장소 I/O 실패로도 throw할 수 있다
   * (LocalStore 계약). 여기서 잡지 못한 예외는 `doCycle`이 재시도 가능한 실패로 처리한다 —
   * 타이머 콜백에서 `void runCycle(...)`으로 실행되므로 처리하지 않으면 unhandled rejection이 된다.
   */
  async function runDoCycle(record: CareerRecord): Promise<void> {
    const careerId = record.careerId;
    setState(record, { kind: 'SYNCING', attempt: record.attempt });
    let fastForwarded = false;

    while (true) {
      if (record.disposed || disposed) return;

      const load = await deps.engine.loadCareer(careerId);
      if (record.disposed || disposed) return;
      if (!load.ok) {
        if (load.error.code === 'CAREER_NOT_FOUND') {
          removeRecord(careerId);
          return;
        }
        setState(record, { kind: 'FAILED', error: load.error });
        record.attempt = 0;
        return;
      }

      let body;
      try {
        body = await deps.engine.buildSyncBody(careerId);
      } catch (err) {
        if (err instanceof LocalStoreConstraintError) {
          removeRecord(careerId);
          return;
        }
        throw err;
      }
      if (record.disposed || disposed) return;

      if (body === null) {
        setState(record, {
          kind: 'IDLE',
          lastSyncedRevision: load.career.lastSyncedRevision,
          lastSyncedAt: record.lastSyncedAt,
        });
        record.attempt = 0;
        return;
      }

      if (!isOnline()) {
        setState(record, { kind: 'OFFLINE', pendingSince: record.pendingSince ?? deps.now() });
        record.attempt = 0;
        return;
      }

      const idempotencyKey = idempotencyKeyFor(record, body);
      const url = `${deps.baseUrl}/careers/${careerId}`;
      let response: SyncTransportResponse;
      try {
        response = await deps.fetch(url, {
          method: 'PUT',
          headers: {
            [IF_MATCH_HEADER]: String(body.baseRevision),
            [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
            [CONTENT_TYPE_HEADER]: 'application/json',
            [REQUEST_ID_HEADER]: deps.newId(),
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        if (record.disposed || disposed) return;
        if (!isOnline()) {
          setState(record, { kind: 'OFFLINE', pendingSince: record.pendingSince ?? deps.now() });
          record.attempt = 0;
        } else {
          scheduleRetry(record, toEngineError(err, 'SERVICE_UNAVAILABLE'));
        }
        return;
      }
      if (record.disposed || disposed) return;
      record.pendingSince = null;

      if (response.status === 200) {
        let parsed;
        try {
          const json = await response.json();
          parsed = PutCareerResponseSchema.parse(unwrapData(json));
        } catch (err) {
          scheduleRetry(record, toEngineError(err, 'SERVICE_UNAVAILABLE'));
          return;
        }
        if (record.disposed || disposed) return;
        const ok = await markSyncedSafely(careerId, parsed.revision);
        if (!ok || record.disposed || disposed) return;
        record.attempt = 0;
        record.idempotency = null;
        record.lastSyncedAt = parsed.syncedAt;
        continue;
      }

      if (response.status === 401) {
        setState(record, { kind: 'LOCAL_ONLY', reason: 'NO_SESSION' });
        record.attempt = 0;
        return;
      }

      const error = await parseErrorEnvelope(response);
      if (record.disposed || disposed) return;

      if (response.status === 409 && error.code === 'CAREER_REVISION_CONFLICT') {
        const resolution = await resolveRevisionConflict(
          record,
          careerId,
          { revision: load.snapshot.revision, stateHash: load.snapshot.stateHash },
          !fastForwarded,
        );
        if (record.disposed || disposed) return;
        if (resolution.outcome === 'fast-forward') {
          fastForwarded = true;
          record.idempotency = null;
          continue;
        }
        if (resolution.outcome === 'conflict') {
          setState(record, { kind: 'CONFLICT', local: resolution.local, server: resolution.server });
          record.attempt = 0;
        }
        return;
      }

      classifyNonConflictError(record, error);
      return;
    }
  }

  function notifyCommitted(careerId: string, snapshot: DomainSnapshot): void {
    if (disposed) return;
    const record = ensureRecord(careerId);
    const delay = policy.immediateCheckpoints.includes(snapshot.checkpoint) ? 0 : policy.debounceMs;
    scheduleSend(record, delay);
  }

  async function flush(careerId?: string): Promise<void> {
    if (disposed) return;
    const ids = careerId !== undefined ? [careerId] : Array.from(records.keys());
    await Promise.all(
      ids.map(async (id) => {
        const record = careerId !== undefined ? ensureRecord(id) : records.get(id);
        if (record === undefined || record.disposed) return;
        const blocked =
          record.state.kind === 'CONFLICT' || record.state.kind === 'FAILED' || record.state.kind === 'LOCAL_ONLY';
        if (blocked) {
          if (record.inFlight !== null) await record.inFlight;
          return;
        }
        if (record.inFlight !== null) {
          await record.inFlight;
          return;
        }
        await runCycle(id);
      }),
    );
  }

  function getState(careerId: string): CareerSyncState {
    return records.get(careerId)?.state ?? { kind: 'IDLE', lastSyncedRevision: 0, lastSyncedAt: null };
  }

  function subscribe(listener: (careerId: string, state: CareerSyncState) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function resolveConflict(careerId: string, _choice: 'REMOTE'): Promise<void> {
    if (disposed) return;
    const record = records.get(careerId);
    if (record === undefined || record.state.kind !== 'CONFLICT') return;
    const server = record.state.server;

    const decoded = decodeSnapshot(server.snapshot);
    if (!decoded.ok) {
      setState(record, {
        kind: 'FAILED',
        error: {
          code: 'VERIFICATION_FAILED',
          message: `서버 Snapshot 검증에 실패했다: ${decoded.reason}`,
          details: { reason: decoded.reason },
        },
      });
      return;
    }

    const discardedAt = deps.now();

    await deps.store.transaction('readwrite', async (tx) => {
      const career = await tx.careers.get(careerId);
      if (career === undefined) return;

      const allCommands = await tx.commandLog.listSince(careerId, 0);
      const discardedCommands = allCommands.filter((entry) => entry.revision > server.revision);
      const survivorCommands = allCommands.filter((entry) => entry.revision <= server.revision);

      const allSnapshots = await tx.snapshots.listByCareer(careerId);
      const discardedSnapshots = allSnapshots.filter((entry) => entry.revision > server.revision);
      const survivorSnapshots = allSnapshots.filter((entry) => entry.revision <= server.revision);

      if (discardedCommands.length > 0 || discardedSnapshots.length > 0) {
        await tx.kv.put(`sync:discarded:${careerId}:${discardedAt}`, {
          commands: discardedCommands,
          snapshots: discardedSnapshots,
        });
      }

      await tx.commandLog.deleteByCareer(careerId);
      for (const entry of survivorCommands) {
        await tx.commandLog.append(entry);
      }

      await tx.snapshots.deleteByCareer(careerId);
      for (const entry of survivorSnapshots) {
        await tx.snapshots.put(entry);
      }
      await tx.snapshots.put(server.snapshot);

      await tx.idempotency.deleteByCareer(careerId);

      await tx.careers.put({
        ...career,
        revision: server.revision,
        lastSyncedRevision: server.revision,
        status: decoded.snapshot.state.status,
        updatedAt: discardedAt,
      });
    });

    record.attempt = 0;
    record.pendingSince = null;
    record.lastSyncedAt = discardedAt;
    setState(record, { kind: 'IDLE', lastSyncedRevision: server.revision, lastSyncedAt: discardedAt });
  }

  function dispose(): void {
    disposed = true;
    for (const record of records.values()) {
      record.disposed = true;
      clearTimer(record);
    }
    listeners.clear();
  }

  return { notifyCommitted, flush, getState, subscribe, resolveConflict, dispose };
}
