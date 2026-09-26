import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, cachedGet, clearApiCache } from './client.js';

// T-10-015 공개 조회 메모: 같은 path는 TTL 동안 한 번만, 동시 요청은 하나로, 실패는 담지 않고, 쓰기 성공 시 비운다.
describe('cachedGet', () => {
  let calls: string[];
  let fail = false;
  beforeEach(() => {
    calls = [];
    fail = false;
    clearApiCache();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${new URL(url).pathname}`);
      if (fail) return new Response(JSON.stringify({ error: { code: 'X' } }), { status: 503 });
      return new Response(JSON.stringify({ data: { n: calls.length } }), { status: 200 });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('TTL 동안 같은 path는 한 번만 요청하고 동시 요청도 합친다', async () => {
    const [a, b] = await Promise.all([
      cachedGet('/v1/hof?limit=3', 60_000),
      cachedGet('/v1/hof?limit=3', 60_000),
    ]);
    expect(a).toEqual(b);
    await cachedGet('/v1/hof?limit=3', 60_000);
    expect(calls).toEqual(['GET /v1/hof']);
    vi.advanceTimersByTime(60_001);
    await cachedGet('/v1/hof?limit=3', 60_000);
    expect(calls).toHaveLength(2);
  });

  it('실패는 담지 않는다', async () => {
    fail = true;
    expect((await cachedGet('/v1/hof', 60_000)).ok).toBe(false);
    fail = false;
    expect((await cachedGet('/v1/hof', 60_000)).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('쓰기가 성공하면 메모를 비운다', async () => {
    await cachedGet('/v1/boards/notice/posts', 60_000);
    await apiFetch('/v1/boards/posts/x/comments', { method: 'POST', body: '{}' });
    await cachedGet('/v1/boards/notice/posts', 60_000);
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(2);
  });
});
