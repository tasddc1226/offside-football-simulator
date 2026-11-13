import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorage } from '@offside/game/storage';
import {
  apiFetch,
  clearApiCache,
  configureApi,
  invalidateApiCache,
  persistedGet,
  renewSession,
} from './client.js';

const HOST = { baseUrl: 'http://localhost:8787', auth: () => ({}) };
/** 앱을 닫았다 다시 연다: 메모리 메모는 사라지고 기기 저장소는 남는다. */
const restart = () => configureApi(HOST);

// T-11-724 잘 바뀌지 않는 공개 조회는 응답을 기기에도 남겨, 다시 열었을 때 메모 시간 안이면 서버에 묻지 않는다.
describe('persistedGet', () => {
  let calls: string[];
  let disk: Map<string, string>;
  beforeEach(() => {
    calls = [];
    disk = new Map();
    setStorage({ getItem: (k) => disk.get(k) ?? null, setItem: (k, v) => void disk.set(k, v) });
    restart();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T00:00:00.000Z'));
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const u = new URL(url);
      calls.push(`${init.method} ${u.pathname}`);
      if (u.pathname === '/v1/profile')
        return new Response(JSON.stringify({ data: { id: 'p', linked: {} } }), { status: 200 });
      return new Response(JSON.stringify({ data: { n: calls.length } }), { status: 200 });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('다시 열어도 메모 시간 안이면 기기에 남긴 응답을 쓰고, 지나면 다시 받는다', async () => {
    const first = await persistedGet('/v1/balance', 3_600_000);
    expect(calls).toEqual(['GET /v1/balance']);
    restart();
    vi.advanceTimersByTime(59 * 60_000);
    expect(await persistedGet('/v1/balance', 3_600_000)).toEqual(first);
    expect(calls).toHaveLength(1);
    // 남긴 시각부터 한 시간이 지나면(다시 연 시각이 아니라) 서버에 묻는다.
    restart();
    vi.advanceTimersByTime(60_001);
    await persistedGet('/v1/balance', 3_600_000);
    expect(calls).toHaveLength(2);
  });

  it('쓰기가 성공하면 기기에 남긴 응답도 버린다', async () => {
    await persistedGet('/v1/boards/notice/posts', 600_000);
    await apiFetch('/v1/boards/notice/posts', { method: 'POST' });
    restart();
    await persistedGet('/v1/boards/notice/posts', 600_000);
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(2);
  });

  it('한 경로만 버리면 다른 경로의 남긴 응답은 그대로다', async () => {
    await persistedGet('/v1/boards/notice/posts', 600_000);
    await persistedGet('/v1/balance', 600_000);
    invalidateApiCache('/v1/boards/notice/posts');
    restart();
    await persistedGet('/v1/boards/notice/posts', 600_000);
    await persistedGet('/v1/balance', 600_000);
    expect(calls).toEqual([
      'GET /v1/boards/notice/posts',
      'GET /v1/balance',
      'GET /v1/boards/notice/posts',
    ]);
  });

  it('실패한 응답과 받는 사이에 메모를 비운 응답은 남기지 않는다', async () => {
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${new URL(url).pathname}`);
      return new Response(JSON.stringify({ error: { code: 'X' } }), { status: 503 });
    });
    expect((await persistedGet('/v1/balance', 600_000)).ok).toBe(false);
    restart();
    await persistedGet('/v1/balance', 600_000);
    expect(calls).toHaveLength(2);
    expect([...disk.keys()].filter((k) => k.startsWith('ft_api:'))).toEqual([]);
  });

  it('저장소를 못 써도 메모로만 동작한다', async () => {
    setStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    await persistedGet('/v1/balance', 600_000);
    await persistedGet('/v1/balance', 600_000);
    expect(calls).toEqual(['GET /v1/balance']);
    expect(() => clearApiCache()).not.toThrow();
  });

  it('세션을 새로 받는 요청이 동시에 여러 번 와도 한 번만 나간다', async () => {
    const [a, b] = await Promise.all([renewSession(), renewSession()]);
    expect([a, b]).toEqual([true, true]);
    expect(calls).toEqual(['GET /v1/profile']);
    await renewSession();
    expect(calls).toHaveLength(2);
  });
});
