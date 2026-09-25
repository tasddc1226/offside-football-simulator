import type { Context } from 'hono';
import type { AppEnv } from './env.js';

// T-10-015. 공개 조회(명예의 전당 · 게시판 목록) 결과를 Cloudflare 엣지 캐시(Cache API)에 잠깐 둔다 —
// 같은 데이터센터로 들어온 다음 요청은 D1까지 가지 않는다. 응답 전체가 아니라 data만 담아서 requestId·CORS
// 헤더는 요청마다 새로 붙는다. 키는 검증을 통과한 값으로만 만들어, 쿼리 문자열을 바꿔 가며 캐시를 우회하지
// 못한다. Cache API가 없는 곳(Node 테스트, workers.dev)에서는 매번 그냥 읽는다.

function edge(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

function waitUntil(c: Context<AppEnv>, p: Promise<unknown>) {
  const safe = p.catch(() => {});
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    // 실행 컨텍스트가 없다(테스트). 기다리지 않고 버린다.
  }
}

/** 이 요청과 같은 호스트의 캐시 키. path에는 정규화한 쿼리까지 담는다. */
export const edgeKey = (c: Context<AppEnv>, path: string) => `${new URL(c.req.url).origin}${path}`;

export async function edgeCached<T>(c: Context<AppEnv>, path: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const cache = edge();
  if (!cache) return load();
  const key = edgeKey(c, path);
  const hit = await cache.match(key);
  if (hit) return (await hit.json()) as T;
  const data = await load();
  if (data === undefined) return data; // 없는 대상(404)은 담지 않는다.
  const stored = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttlSec}` },
  });
  waitUntil(c, cache.put(key, stored));
  return data;
}

/** 글을 쓰거나 지웠을 때 목록 캐시를 지운다. 이 데이터센터의 사본만 지워지고, 다른 곳은 TTL 안에 새로 읽는다. */
export function purgeEdge(c: Context<AppEnv>, paths: string[]): void {
  const cache = edge();
  if (!cache) return;
  waitUntil(c, Promise.all(paths.map((p) => cache.delete(edgeKey(c, p)))));
}
