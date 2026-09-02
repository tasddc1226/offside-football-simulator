import type { CareerSnapshot, CommandLogEntry } from '@offside/contracts';
import { LocalStoreConstraintError, type LocalStore, type LocalStoreTx, type StoreMode } from '../ports/local-store.js';
import type { IdempotencyRecord, LocalCareerRecord } from '../types.js';

type State = {
  careers: Map<string, LocalCareerRecord>;
  snapshots: Map<string, CareerSnapshot>;
  commandLog: Map<string, CommandLogEntry>;
  idempotency: Map<string, IdempotencyRecord>;
  kv: Map<string, unknown>;
};

function emptyState(): State {
  return {
    careers: new Map(),
    snapshots: new Map(),
    commandLog: new Map(),
    idempotency: new Map(),
    kv: new Map(),
  };
}

function revisionKey(careerId: string, revision: number): string {
  return `${careerId}:${revision}`;
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function compareUpdatedAtDesc(a: LocalCareerRecord, b: LocalCareerRecord): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function createTx(state: State): LocalStoreTx {
  return {
    careers: {
      async get(id) {
        const record = state.careers.get(id);
        return record === undefined ? undefined : copy(record);
      },
      async put(record) {
        state.careers.set(record.id, copy(record));
      },
      async list() {
        return Array.from(state.careers.values()).sort(compareUpdatedAtDesc).map(copy);
      },
      async delete(id) {
        state.careers.delete(id);
      },
    },
    snapshots: {
      async put(snapshot) {
        state.snapshots.set(revisionKey(snapshot.careerId, snapshot.revision), copy(snapshot));
      },
      async get(careerId, revision) {
        const snapshot = state.snapshots.get(revisionKey(careerId, revision));
        return snapshot === undefined ? undefined : copy(snapshot);
      },
      async getLatest(careerId) {
        let latest: CareerSnapshot | undefined;
        for (const snapshot of state.snapshots.values()) {
          if (snapshot.careerId !== careerId) continue;
          if (latest === undefined || snapshot.revision > latest.revision) latest = snapshot;
        }
        return latest === undefined ? undefined : copy(latest);
      },
      async listByCareer(careerId, range) {
        const fromRevision = range?.fromRevision;
        const toRevision = range?.toRevision;
        return Array.from(state.snapshots.values())
          .filter((snapshot) => snapshot.careerId === careerId)
          .filter(
            (snapshot) =>
              (fromRevision === undefined || snapshot.revision >= fromRevision) &&
              (toRevision === undefined || snapshot.revision <= toRevision),
          )
          .sort((a, b) => a.revision - b.revision)
          .map(copy);
      },
      async deleteByCareer(careerId) {
        for (const key of state.snapshots.keys()) {
          if (key.startsWith(`${careerId}:`)) state.snapshots.delete(key);
        }
      },
    },
    commandLog: {
      async append(entry) {
        const key = revisionKey(entry.careerId, entry.revision);
        if (state.commandLog.has(key)) {
          throw new LocalStoreConstraintError(`commandLog: (${entry.careerId}, ${entry.revision}) 항목이 이미 있다.`);
        }
        state.commandLog.set(key, copy(entry));
      },
      async listSince(careerId, afterRevision) {
        return Array.from(state.commandLog.values())
          .filter((entry) => entry.careerId === careerId && entry.revision > afterRevision)
          .sort((a, b) => a.revision - b.revision)
          .map(copy);
      },
      async deleteByCareer(careerId) {
        for (const key of state.commandLog.keys()) {
          if (key.startsWith(`${careerId}:`)) state.commandLog.delete(key);
        }
      },
    },
    idempotency: {
      async get(commandId) {
        const record = state.idempotency.get(commandId);
        return record === undefined ? undefined : copy(record);
      },
      async put(record) {
        state.idempotency.set(record.commandId, copy(record));
      },
      async deleteByCareer(careerId) {
        for (const [commandId, record] of state.idempotency) {
          if (record.careerId === careerId) state.idempotency.delete(commandId);
        }
      },
    },
    kv: {
      async get<T>(key: string) {
        return state.kv.has(key) ? (copy(state.kv.get(key)) as T) : undefined;
      },
      async put<T>(key: string, value: T) {
        state.kv.set(key, copy(value));
      },
      async delete(key: string) {
        state.kv.delete(key);
      },
    },
  };
}

/**
 * Map 기반 인메모리 `LocalStore`. `readwrite` 트랜잭션은 store당 하나의 Promise 체인으로
 * 직렬화하고, 시작 전 상태를 `structuredClone`으로 백업해 `run`이 throw하면 복원한다.
 */
export class MemoryLocalStore implements LocalStore {
  readonly kind = 'memory';
  #state: State = emptyState();
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;

  transaction<T>(mode: StoreMode, run: (tx: LocalStoreTx) => Promise<T>): Promise<T> {
    if (this.#closed) {
      throw new Error('MemoryLocalStore: close() 후에는 transaction()을 호출할 수 없다.');
    }

    const result = this.#queue.then(async () => {
      if (this.#closed) {
        throw new Error('MemoryLocalStore: close() 후에는 transaction()을 호출할 수 없다.');
      }
      const backup = mode === 'readwrite' ? copy(this.#state) : null;
      const tx = createTx(this.#state);
      try {
        return await run(tx);
      } catch (error) {
        if (backup !== null) {
          this.#state = backup;
        }
        throw error;
      }
    });

    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  async close(): Promise<void> {
    this.#closed = true;
  }
}
