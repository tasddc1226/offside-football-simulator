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
import type { StringKV } from '../types.js';

const REVISION_DIGITS = 10;

function padRevision(revision: number): string {
  return String(revision).padStart(REVISION_DIGITS, '0');
}

function careersPrefix(prefix: string): string {
  return `${prefix}careers/`;
}

function careerKey(prefix: string, id: string): string {
  return `${careersPrefix(prefix)}${id}`;
}

function snapshotsPrefix(prefix: string, careerId: string): string {
  return `${prefix}snapshots/${careerId}/`;
}

function snapshotKey(prefix: string, careerId: string, revision: number): string {
  return `${snapshotsPrefix(prefix, careerId)}${padRevision(revision)}`;
}

function logPrefix(prefix: string, careerId: string): string {
  return `${prefix}log/${careerId}/`;
}

function logKey(prefix: string, careerId: string, revision: number): string {
  return `${logPrefix(prefix, careerId)}${padRevision(revision)}`;
}

function idemPrefix(prefix: string): string {
  return `${prefix}idem/`;
}

function idemKey(prefix: string, commandId: string): string {
  return `${idemPrefix(prefix)}${commandId}`;
}

function kvKey(prefix: string, key: string): string {
  return `${prefix}kv/${key}`;
}

async function listValuesByPrefix<T>(kv: StringKV, keyPrefix: string): Promise<T[]> {
  const keys = (await kv.keys())
    .filter((key) => key.startsWith(keyPrefix))
    .sort();
  const values: T[] = [];
  for (const key of keys) {
    const raw = await kv.getItem(key);
    if (raw !== null) values.push(JSON.parse(raw) as T);
  }
  return values;
}

async function deleteByPrefix(kv: StringKV, keyPrefix: string): Promise<void> {
  const keys = (await kv.keys()).filter((key) => key.startsWith(keyPrefix));
  for (const key of keys) {
    await kv.removeItem(key);
  }
}

function createTx(kv: StringKV, prefix: string): LocalStoreTx {
  return {
    careers: {
      async get(id) {
        const raw = await kv.getItem(careerKey(prefix, id));
        return raw === null ? undefined : (JSON.parse(raw) as LocalCareerRecord);
      },
      async put(record) {
        await kv.setItem(careerKey(prefix, record.id), JSON.stringify(record));
      },
      async list() {
        const records = await listValuesByPrefix<LocalCareerRecord>(kv, careersPrefix(prefix));
        return records.sort(compareCareersDesc);
      },
      async delete(id) {
        await kv.removeItem(careerKey(prefix, id));
      },
    },
    snapshots: {
      async put(snapshot) {
        await kv.setItem(snapshotKey(prefix, snapshot.careerId, snapshot.revision), JSON.stringify(snapshot));
      },
      async get(careerId, revision) {
        const raw = await kv.getItem(snapshotKey(prefix, careerId, revision));
        return raw === null ? undefined : (JSON.parse(raw) as CareerSnapshot);
      },
      async getLatest(careerId) {
        const all = await listValuesByPrefix<CareerSnapshot>(kv, snapshotsPrefix(prefix, careerId));
        return all.at(-1);
      },
      async listByCareer(careerId, range) {
        const all = await listValuesByPrefix<CareerSnapshot>(kv, snapshotsPrefix(prefix, careerId));
        return all.filter(
          (snapshot) =>
            (range?.fromRevision === undefined || snapshot.revision >= range.fromRevision) &&
            (range?.toRevision === undefined || snapshot.revision <= range.toRevision),
        );
      },
      async deleteByCareer(careerId) {
        await deleteByPrefix(kv, snapshotsPrefix(prefix, careerId));
      },
    },
    commandLog: {
      async append(entry) {
        const key = logKey(prefix, entry.careerId, entry.revision);
        if ((await kv.getItem(key)) !== null) {
          throw new LocalStoreConstraintError(`commandLog: (${entry.careerId}, ${entry.revision}) 항목이 이미 있다.`);
        }
        await kv.setItem(key, JSON.stringify(entry));
      },
      async listSince(careerId, afterRevision) {
        const all = await listValuesByPrefix<CommandLogEntry>(kv, logPrefix(prefix, careerId));
        return all.filter((entry) => entry.revision > afterRevision);
      },
      async deleteByCareer(careerId) {
        await deleteByPrefix(kv, logPrefix(prefix, careerId));
      },
    },
    idempotency: {
      async get(commandId) {
        const raw = await kv.getItem(idemKey(prefix, commandId));
        return raw === null ? undefined : (JSON.parse(raw) as IdempotencyRecord);
      },
      async put(record) {
        await kv.setItem(idemKey(prefix, record.commandId), JSON.stringify(record));
      },
      async deleteByCareer(careerId) {
        const keys = (await kv.keys()).filter((key) => key.startsWith(idemPrefix(prefix)));
        for (const key of keys) {
          const raw = await kv.getItem(key);
          if (raw === null) continue;
          const record = JSON.parse(raw) as IdempotencyRecord;
          if (record.careerId === careerId) await kv.removeItem(key);
        }
      },
    },
    kv: {
      async get<T>(key: string) {
        const raw = await kv.getItem(kvKey(prefix, key));
        return raw === null ? undefined : (JSON.parse(raw) as T);
      },
      async put<T>(key: string, value: T) {
        await kv.setItem(kvKey(prefix, key), JSON.stringify(value));
      },
      async delete(key: string) {
        await kv.removeItem(kvKey(prefix, key));
      },
    },
  };
}

async function snapshotUnderPrefix(kv: StringKV, prefix: string): Promise<Map<string, string>> {
  const keys = (await kv.keys()).filter((key) => key.startsWith(prefix));
  const backup = new Map<string, string>();
  for (const key of keys) {
    const value = await kv.getItem(key);
    if (value !== null) backup.set(key, value);
  }
  return backup;
}

async function restoreUnderPrefix(kv: StringKV, prefix: string, backup: Map<string, string>): Promise<void> {
  const keys = (await kv.keys()).filter((key) => key.startsWith(prefix));
  for (const key of keys) {
    if (!backup.has(key)) await kv.removeItem(key);
  }
  for (const [key, value] of backup) {
    await kv.setItem(key, value);
  }
}

/**
 * toss 채널의 `LocalStore` 구현. SDK 없이 `StringKV` 위에 얹는다(지금은 `MemoryStringKV`, M-001에서
 * 앱인토스 네이티브 `Storage`). `readwrite`는 store당 하나의 Promise 체인으로 직렬화하고, 시작 전
 * 접두사 아래 키를 스냅샷해 `run`이 throw하면 복원한다(`MemoryLocalStore`와 같은 전략).
 */
export function createKvLocalStore(kv: StringKV, prefix = 'os:'): LocalStore {
  let closed = false;
  let queue: Promise<unknown> = Promise.resolve();

  function assertOpen(): void {
    if (closed) {
      throw new Error('KvLocalStore: close() 후에는 transaction()을 호출할 수 없다.');
    }
  }

  return {
    kind: 'toss-storage',
    transaction<T>(mode: StoreMode, run: (tx: LocalStoreTx) => Promise<T>): Promise<T> {
      assertOpen();

      const result = queue.then(async () => {
        assertOpen();
        const backup = mode === 'readwrite' ? await snapshotUnderPrefix(kv, prefix) : null;
        const tx = createTx(kv, prefix);
        try {
          return await run(tx);
        } catch (error) {
          if (backup !== null) await restoreUnderPrefix(kv, prefix, backup);
          throw error;
        }
      });

      queue = result.then(
        () => undefined,
        () => undefined,
      );

      return result;
    },
    async close() {
      closed = true;
    },
  };
}
