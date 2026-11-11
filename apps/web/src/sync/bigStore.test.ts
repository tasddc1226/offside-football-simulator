import { describe, expect, it } from 'vitest';
import { createBigStore, IDB_MARK, type AsyncKv, type LocalKv } from './bigStore.js';

/** localStorage처럼 한도를 넘으면 던지는 저장소. */
function fakeLocal(limit = Infinity) {
  const m = new Map<string, string>();
  const size = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
  const kv: LocalKv = {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      const prev = m.get(k);
      m.set(k, v);
      if (size() > limit) {
        if (prev == null) m.delete(k);
        else m.set(k, prev);
        throw new Error('QuotaExceededError');
      }
    },
    removeItem: (k) => void m.delete(k),
  };
  return { kv, m };
}
function fakeIdb(opts: { failPut?: boolean; hang?: boolean } = {}) {
  const m = new Map<string, string>();
  const kv: AsyncKv = {
    get: (keys) =>
      opts.hang
        ? new Promise(() => {})
        : Promise.resolve(new Map(keys.filter((k) => m.has(k)).map((k) => [k, m.get(k)!]))),
    put: (k, v) =>
      opts.failPut ? Promise.reject(new Error('blocked')) : (m.set(k, v), Promise.resolve()),
  };
  return { kv, m };
}

describe('bigStore (T-11-697)', () => {
  it('엠블럼 키는 IndexedDB로 옮기고 localStorage 자리를 비운다', async () => {
    const local = fakeLocal();
    local.m.set('ft_clubs', 'old');
    const idb = fakeIdb();
    const s = createBigStore(local.kv, idb.kv);
    expect(s.store.getItem('ft_clubs')).toBe('old');
    s.store.setItem('ft_clubs', 'new');
    expect(s.store.getItem('ft_clubs')).toBe('new'); // 쓰기가 끝나기 전에도 새 값
    await s.flush();
    expect(idb.m.get('ft_clubs')).toBe('new');
    expect(local.m.has('ft_clubs')).toBe(false);
    expect(JSON.parse(local.m.get(IDB_MARK)!)).toEqual(['ft_clubs']);
  });

  it('localStorage가 꽉 차도 엠블럼 저장이 실패하지 않는다', async () => {
    const local = fakeLocal(100);
    local.m.set('ft_save', 'x'.repeat(80));
    const s = createBigStore(local.kv, fakeIdb().kv);
    expect(() => s.store.setItem('ft_clubs', 'y'.repeat(500))).not.toThrow();
    await s.flush();
    expect(s.store.getItem('ft_clubs')).toBe('y'.repeat(500));
  });

  it('다음 실행에서 IndexedDB 값을 읽어 온다', async () => {
    const local = fakeLocal();
    const idb = fakeIdb();
    const first = createBigStore(local.kv, idb.kv);
    first.store.setItem('ft_comp_icons', 'icons');
    await first.flush();

    const next = createBigStore(local.kv, idb.kv);
    expect(next.needsLoad()).toBe(true);
    expect(next.store.getItem('ft_comp_icons')).toBeNull();
    await next.load();
    expect(next.store.getItem('ft_comp_icons')).toBe('icons');
  });

  it('옮긴 값이 없으면 IndexedDB를 기다리지 않는다', () => {
    const s = createBigStore(fakeLocal().kv, fakeIdb().kv);
    expect(s.needsLoad()).toBe(false);
  });

  it('다른 키는 그대로 localStorage에 둔다', async () => {
    const local = fakeLocal();
    const idb = fakeIdb();
    const s = createBigStore(local.kv, idb.kv);
    s.store.setItem('ft_save', 'save');
    await s.flush();
    expect(local.m.get('ft_save')).toBe('save');
    expect(idb.m.size).toBe(0);
  });

  it('IndexedDB가 막히면 localStorage에 남긴다', async () => {
    const local = fakeLocal();
    const s = createBigStore(local.kv, fakeIdb({ failPut: true }).kv);
    s.store.setItem('ft_clubs', 'v');
    await s.flush();
    expect(local.m.get('ft_clubs')).toBe('v');
    expect(local.m.has(IDB_MARK)).toBe(false);
  });

  it('IndexedDB를 쓸 수 없는 브라우저는 예전처럼 localStorage만 쓴다', () => {
    const local = fakeLocal(10);
    const s = createBigStore(local.kv, null);
    expect(() => s.store.setItem('ft_clubs', 'z'.repeat(50))).toThrow();
  });

  it('저장된 값을 못 읽었으면 덮어쓰지 않는다', async () => {
    const local = fakeLocal();
    local.m.set(IDB_MARK, JSON.stringify(['ft_clubs']));
    const idb = fakeIdb({ hang: true });
    idb.m.set('ft_clubs', 'kept');
    const s = createBigStore(local.kv, idb.kv);
    await s.load(10);
    expect(s.store.getItem('ft_clubs')).toBeNull();
    expect(() => s.store.setItem('ft_clubs', '{}')).toThrow();
    expect(idb.m.get('ft_clubs')).toBe('kept');
  });

  it('localStorage에 새 값이 있으면(옮기기 전 값) 그 값을 먼저 쓴다', async () => {
    const local = fakeLocal();
    local.m.set(IDB_MARK, JSON.stringify(['ft_clubs']));
    local.m.set('ft_clubs', 'legacy');
    const idb = fakeIdb();
    idb.m.set('ft_clubs', 'stale');
    const s = createBigStore(local.kv, idb.kv);
    expect(s.needsLoad()).toBe(false);
    await s.load();
    expect(s.store.getItem('ft_clubs')).toBe('legacy');
  });
});
