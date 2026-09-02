import type { CareerSnapshot, CommandLogEntry } from '@offside/contracts';
import type { IdempotencyRecord, LocalCareerRecord } from '../types.js';

export type StoreMode = 'readonly' | 'readwrite';

export class LocalStoreConstraintError extends Error {
  override readonly name = 'LocalStoreConstraintError';
}

/**
 * `readwrite`는 원자적이다: `run`이 throw하면 아무것도 남지 않는다. 같은 store의 `readwrite`
 * 트랜잭션은 직렬로 실행된다. `run` 안에서 `tx` 밖의 비동기 작업(네트워크, Worker)을 기다리지
 * 않는다 — 구현(Dexie 등)에 따라 트랜잭션이 조기 커밋될 수 있다.
 */
export interface LocalStoreTx {
  careers: {
    get(id: string): Promise<LocalCareerRecord | undefined>;
    put(record: LocalCareerRecord): Promise<void>;
    list(): Promise<LocalCareerRecord[]>;
    delete(id: string): Promise<void>;
  };
  snapshots: {
    put(snapshot: CareerSnapshot): Promise<void>;
    get(careerId: string, revision: number): Promise<CareerSnapshot | undefined>;
    getLatest(careerId: string): Promise<CareerSnapshot | undefined>;
    listByCareer(careerId: string, range?: { fromRevision?: number; toRevision?: number }): Promise<CareerSnapshot[]>;
    deleteByCareer(careerId: string): Promise<void>;
  };
  commandLog: {
    append(entry: CommandLogEntry): Promise<void>;
    listSince(careerId: string, afterRevision: number): Promise<CommandLogEntry[]>;
    deleteByCareer(careerId: string): Promise<void>;
  };
  idempotency: {
    get(commandId: string): Promise<IdempotencyRecord | undefined>;
    put(record: IdempotencyRecord): Promise<void>;
    deleteByCareer(careerId: string): Promise<void>;
  };
  kv: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
  };
}

export interface LocalStore {
  readonly kind: string;
  transaction<T>(mode: StoreMode, run: (tx: LocalStoreTx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
