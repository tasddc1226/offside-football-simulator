// T-11-697 구단 엠블럼 · 대회 로고 이미지 저장소.
// localStorage는 사이트마다 약 5MB이고 세이브(ft_save) · 명예의 전당과 같이 쓴다. 엠블럼(최대 1.4MB)과 대회 로고(최대 0.9MB)를
// 거의 다 채우면 이미지 하나만 더 넣어도 '저장 공간이 부족해 저장하지 못했어요'가 떴다. 그래서 이 두 키만 용량이 훨씬 큰
// IndexedDB에 둔다. 엔진의 저장 API는 동기라 앞에 메모리 사본을 두고, 부팅 때 한 번 IndexedDB에서 읽어 채운다.
import type { KeyValueStore } from '@offside/game/storage';

/** IndexedDB로 옮기는 키(엠블럼 · 대회 로고). 세이브처럼 작은 값은 그대로 localStorage에 둔다. */
export const BIG_KEYS = ['ft_clubs', 'ft_comp_icons'] as const;
export const IDB_NAME = 'offside';
export const IDB_STORE = 'kv';
/** IndexedDB에 값이 있는 키 목록. 없으면 부팅 때 IndexedDB를 열지 않는다(대부분의 유저). */
export const IDB_MARK = 'ft_idb_keys';

export interface LocalKv extends KeyValueStore {
  removeItem(key: string): void;
}
export interface AsyncKv {
  get(keys: string[]): Promise<Map<string, string>>;
  put(key: string, value: string): Promise<void>;
}

export function createBigStore(local: LocalKv, idb: AsyncKv | null) {
  const big = new Set<string>(BIG_KEYS);
  // 이번 실행에서 정한 값. localStorage보다 먼저 읽는다(IndexedDB 쓰기가 끝나기 전에도 새 값이 보이게).
  const mem = new Map<string, string>();
  let queue: Promise<void> = Promise.resolve();
  // IndexedDB에 둔 값을 읽지 못했으면 이번 실행 동안 그 키는 쓰지 않는다. 빈 목록으로 덮어 저장된 이미지를 잃지 않게.
  const unreadable = new Set<string>();

  const marked = (): string[] => {
    try {
      const v: unknown = JSON.parse(local.getItem(IDB_MARK) ?? '[]');
      return Array.isArray(v)
        ? v.filter((k): k is string => typeof k === 'string' && big.has(k))
        : [];
    } catch {
      return [];
    }
  };
  const mark = (key: string) => {
    const keys = marked();
    if (keys.includes(key)) return;
    try {
      local.setItem(IDB_MARK, JSON.stringify([...keys, key]));
    } catch {
      // 표시를 못 남기면 다음 부팅에 IndexedDB를 읽지 않는다. 그래서 아래에서 localStorage 값을 지우지 않는다.
    }
  };

  const store: KeyValueStore = {
    getItem(key) {
      if (big.has(key) && mem.has(key)) return mem.get(key)!;
      return local.getItem(key);
    },
    setItem(key, value) {
      if (!idb || !big.has(key)) return local.setItem(key, value);
      // 던지면 saveKey가 false를 돌려 화면이 '저장하지 못했어요'를 띄운다.
      if (unreadable.has(key)) throw new Error('stored value not loaded');
      mem.set(key, value);
      queue = queue
        .then(() => idb.put(key, value))
        .then(
          () => {
            mark(key);
            // 표시가 남았을 때만 옛 사본을 지워 localStorage 자리를 비운다.
            if (marked().includes(key)) local.removeItem(key);
          },
          () => {
            // IndexedDB가 막혔으면(사생활 보호 모드 등) 예전처럼 localStorage에 둔다.
            try {
              local.setItem(key, mem.get(key) ?? value);
            } catch {
              // 둘 다 실패하면 이번 실행 동안만 남는다.
            }
          },
        );
    },
  };

  /** 부팅 때 한 번, 세이브를 읽기 전에. IndexedDB에 둔 값을 메모리로 올린다.
   * localStorage에 같은 키가 있으면(옮기기 전 값) 그 값을 쓰고, 다음 저장 때 IndexedDB로 옮긴다. */
  async function load(timeoutMs = 3000): Promise<void> {
    if (!idb) return;
    const keys = marked().filter((k) => local.getItem(k) == null);
    if (!keys.length) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const got = await Promise.race([
        idb.get(keys),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('idb timeout')), timeoutMs);
        }),
      ]);
      for (const [k, v] of got) if (!mem.has(k)) mem.set(k, v);
    } catch {
      // 읽지 못하면(브라우저가 IndexedDB를 멈춘 경우 등) 기본 엠블럼으로 보이고, 저장된 값은 그대로 남는다.
      for (const k of keys) unreadable.add(k);
    } finally {
      clearTimeout(timer);
    }
  }

  /** IndexedDB를 읽어야 하는지(표시가 있는지). 없으면 부팅을 기다리게 하지 않는다. */
  const needsLoad = () => !!idb && marked().some((k) => local.getItem(k) == null);
  /** 쓰기 대기열이 빌 때까지(테스트용). */
  const flush = () => queue;

  return { store, load, needsLoad, flush };
}

/** 브라우저 IndexedDB 키-값 표 하나. 지원하지 않으면 null. */
export function browserIdb(): AsyncKv | null {
  let factory: IDBFactory | undefined;
  try {
    factory = globalThis.indexedDB;
  } catch {
    return null;
  }
  if (!factory) return null;
  const idb = factory;
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = idb.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('idb blocked'));
    }).catch((e: unknown) => {
      db = null;
      throw e;
    }));
  const done = (tx: IDBTransaction) =>
    new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('idb abort'));
    });
  return {
    async get(keys) {
      const tx = (await open()).transaction(IDB_STORE, 'readonly');
      const os = tx.objectStore(IDB_STORE);
      const out = new Map<string, string>();
      for (const k of keys) {
        const req = os.get(k);
        req.onsuccess = () => {
          if (typeof req.result === 'string') out.set(k, req.result);
        };
      }
      await done(tx);
      return out;
    },
    async put(key, value) {
      const tx = (await open()).transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      await done(tx);
    },
  };
}
