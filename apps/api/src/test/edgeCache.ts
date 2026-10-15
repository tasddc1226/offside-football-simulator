// Workers의 caches.default를 흉내 낸다(키 = URL 문자열). 테스트가 끝나면 uninstall로 지운다.
export function installFakeEdgeCache() {
  const store = new Map<string, string>();
  /** 담은 키마다 Cache-Control(TTL 확인용). */
  const controls = new Map<string, string | null>();
  /** purgeEdge가 지운 키(순서대로). */
  const purged: string[] = [];
  const cache = {
    match: async (k: string) => (store.has(k) ? new Response(store.get(k)) : undefined),
    put: async (k: string, r: Response) => {
      controls.set(k, r.headers.get('Cache-Control'));
      store.set(k, await r.text());
    },
    delete: async (k: string) => (purged.push(k), store.delete(k)),
  };
  (globalThis as { caches?: unknown }).caches = { default: cache };
  return {
    store,
    controls,
    purged,
    uninstall: () => delete (globalThis as { caches?: unknown }).caches,
  };
}

/** 응답 뒤로 미룬 캐시 쓰기·지우기(waitUntil)가 끝나기를 기다린다. */
export const flushEdge = () => new Promise((r) => setTimeout(r, 0));
