import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { edgeCached, purgeEdge } from './edgeCache.js';
import type { AppEnv } from './env.js';

// Workers의 caches.default를 흉내 낸다(키 = URL 문자열).
function fakeCache() {
  const store = new Map<string, string>();
  return {
    store,
    match: async (k: string) => (store.has(k) ? new Response(store.get(k)) : undefined),
    put: async (k: string, r: Response) => void store.set(k, await r.text()),
    delete: async (k: string) => store.delete(k),
  };
}

describe('edgeCached (T-10-015)', () => {
  let cache: ReturnType<typeof fakeCache>;
  let loads = 0;
  const app = new Hono<AppEnv>();
  app.get('/v1/x', async (c) => c.json(await edgeCached(c, `/v1/x?k=${c.req.query('k') ?? ''}`, 60, async () => (loads++, { n: loads }))));
  app.get('/v1/miss', async (c) => c.json((await edgeCached(c, '/v1/miss', 60, async () => (loads++, undefined))) ?? null));
  app.post('/v1/x', (c) => (purgeEdge(c, ['/v1/x?k=a']), c.body(null, 204)));

  beforeEach(() => {
    cache = fakeCache();
    loads = 0;
    (globalThis as { caches?: unknown }).caches = { default: cache };
  });
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches;
  });

  const read = async (q: string) => (await (await app.request(`http://api.test/v1/x?${q}`)).json()) as { n: number };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('같은 키는 한 번만 읽고, 모르는 쿼리를 붙여도 정규화한 키로 캐시를 탄다', async () => {
    expect(await read('k=a')).toEqual({ n: 1 });
    await flush();
    expect(await read('k=a&junk=1')).toEqual({ n: 1 });
    expect(loads).toBe(1);
    expect([...cache.store.keys()]).toEqual(['http://api.test/v1/x?k=a']);
  });

  it('purgeEdge 뒤에는 다시 읽는다', async () => {
    await read('k=a');
    await flush();
    await app.request('http://api.test/v1/x', { method: 'POST' });
    await flush();
    expect(await read('k=a')).toEqual({ n: 2 });
  });

  it('없는 대상(undefined)은 담지 않는다', async () => {
    await app.request('http://api.test/v1/miss');
    await app.request('http://api.test/v1/miss');
    expect(loads).toBe(2);
    expect(cache.store.size).toBe(0);
  });
});
