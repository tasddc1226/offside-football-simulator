import type { Table } from 'dexie';
import type { CareerSnapshot, CommandLogEntry } from '@offside/contracts';
import {
  LocalStoreConstraintError,
  type IdempotencyRecord,
  type LocalCareerRecord,
  type LocalStore,
  type LocalStoreTx,
  type StoreMode,
} from '@offside/engine-client';
import { compareCareersDesc } from '../careers-sort.js';

type KvRow = { key: string; value: unknown };

interface OffsideTables {
  careers: Table<LocalCareerRecord, string>;
  snapshots: Table<CareerSnapshot, [string, number]>;
  commandLog: Table<CommandLogEntry, [string, number]>;
  idempotency: Table<IdempotencyRecord, string>;
  kv: Table<KvRow, string>;
}

function isConstraintError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConstraintError';
}

function createTx(db: OffsideTables): LocalStoreTx {
  return {
    careers: {
      async get(id) {
        return db.careers.get(id);
      },
      async put(record) {
        await db.careers.put(structuredClone(record));
      },
      async list() {
        return (await db.careers.toArray()).sort(compareCareersDesc);
      },
      async delete(id) {
        await db.careers.delete(id);
      },
    },
    snapshots: {
      async put(snapshot) {
        await db.snapshots.put(structuredClone(snapshot));
      },
      async get(careerId, revision) {
        return db.snapshots.get([careerId, revision]);
      },
      async getLatest(careerId) {
        const all = await db.snapshots.where('careerId').equals(careerId).toArray();
        all.sort((a, b) => a.revision - b.revision);
        return all.at(-1);
      },
      async listByCareer(careerId, range) {
        const all = await db.snapshots.where('careerId').equals(careerId).toArray();
        return all
          .filter(
            (snapshot) =>
              (range?.fromRevision === undefined || snapshot.revision >= range.fromRevision) &&
              (range?.toRevision === undefined || snapshot.revision <= range.toRevision),
          )
          .sort((a, b) => a.revision - b.revision);
      },
      async deleteByCareer(careerId) {
        await db.snapshots.where('careerId').equals(careerId).delete();
      },
    },
    commandLog: {
      async append(entry) {
        try {
          await db.commandLog.add(structuredClone(entry));
        } catch (error) {
          if (isConstraintError(error)) {
            throw new LocalStoreConstraintError(`commandLog: (${entry.careerId}, ${entry.revision}) 항목이 이미 있다.`);
          }
          throw error;
        }
      },
      async listSince(careerId, afterRevision) {
        const all = await db.commandLog.where('careerId').equals(careerId).toArray();
        return all.filter((entry) => entry.revision > afterRevision).sort((a, b) => a.revision - b.revision);
      },
      async deleteByCareer(careerId) {
        await db.commandLog.where('careerId').equals(careerId).delete();
      },
    },
    idempotency: {
      async get(commandId) {
        return db.idempotency.get(commandId);
      },
      async put(record) {
        await db.idempotency.put(structuredClone(record));
      },
      async deleteByCareer(careerId) {
        await db.idempotency.where('careerId').equals(careerId).delete();
      },
    },
    kv: {
      async get<T>(key: string) {
        const row = await db.kv.get(key);
        return row === undefined ? undefined : (row.value as T);
      },
      async put<T>(key: string, value: T) {
        await db.kv.put({ key, value: structuredClone(value) });
      },
      async delete(key: string) {
        await db.kv.delete(key);
      },
    },
  };
}

/**
 * web 채널의 `LocalStore` 구현. IndexedDB(Dexie) 위에 얹는다. `dexie`는 초기 청크 예산(DSN-CHN-001)을
 * 넘기지 않도록 이 함수 안에서 지연 로드한다.
 */
export async function createDexieLocalStore(dbName = 'offside'): Promise<LocalStore> {
  const { default: Dexie } = await import('dexie');

  class OffsideDexieImpl extends Dexie implements OffsideTables {
    careers!: Table<LocalCareerRecord, string>;
    snapshots!: Table<CareerSnapshot, [string, number]>;
    commandLog!: Table<CommandLogEntry, [string, number]>;
    idempotency!: Table<IdempotencyRecord, string>;
    kv!: Table<KvRow, string>;

    constructor(name: string) {
      super(name);
      this.version(1).stores({
        careers: 'id, updatedAt',
        snapshots: '[careerId+revision], careerId, revision',
        commandLog: '[careerId+revision], careerId, commandId',
        idempotency: 'commandId, careerId',
        kv: 'key',
      });
    }
  }

  const db = new OffsideDexieImpl(dbName);

  return {
    kind: 'dexie',
    transaction<T>(mode: StoreMode, run: (tx: LocalStoreTx) => Promise<T>): Promise<T> {
      const dexieMode = mode === 'readwrite' ? 'rw' : 'r';
      // Dexie detects native async scopes to keep its transaction context through nested awaits.
      // A plain callback returning run() can lose that context in multi-handle workflows, letting
      // later db.table operations open independent transactions. Bind every table to this exact
      // transaction as well: command logs and snapshots must never commit independently.
      return db.transaction(
        dexieMode,
        [db.careers, db.snapshots, db.commandLog, db.idempotency, db.kv],
        async (transaction) => run(createTx({
          careers: transaction.table('careers'),
          snapshots: transaction.table('snapshots'),
          commandLog: transaction.table('commandLog'),
          idempotency: transaction.table('idempotency'),
          kv: transaction.table('kv'),
        })),
      );
    },
    async close() {
      db.close();
    },
  };
}

/**
 * "이 기기 데이터 삭제"(SCR-030). 호출하는 쪽이 이미 만든 `LocalStore`의 `close()`를 먼저 불러야 한다
 * — 열린 연결이 남아 있으면 `Dexie.delete`가 그 연결이 닫힐 때까지 대기한다.
 */
export async function deleteDexieLocalStore(dbName = 'offside'): Promise<void> {
  const { default: Dexie } = await import('dexie');
  await Dexie.delete(dbName);
}
