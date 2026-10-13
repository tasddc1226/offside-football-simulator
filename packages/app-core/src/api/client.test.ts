import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@offside/contracts/i18n';
import {
  apiFetch,
  ownerCachedGet,
  getProfile,
  cachedGet,
  clearApiCache,
  invalidateApiCache,
  withLang,
} from './client.js';

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
  it('새 알림으로 연 기능만 새로 읽고 다른 화면의 캐시는 보존한다', async () => {
    await cachedGet('/v1/friends', 60_000);
    await cachedGet('/v1/owner-team/matches?season=0', 60_000);
    await cachedGet('/v1/hof', 60_000);
    invalidateApiCache('/v1/friends');
    invalidateApiCache('/v1/owner-team');
    await cachedGet('/v1/friends', 60_000);
    await cachedGet('/v1/owner-team/matches?season=0', 60_000);
    await cachedGet('/v1/hof', 60_000);
    expect(calls.filter((c) => c === 'GET /v1/friends')).toHaveLength(2);
    expect(calls.filter((c) => c === 'GET /v1/owner-team/matches')).toHaveLength(2);
    expect(calls.filter((c) => c === 'GET /v1/hof')).toHaveLength(1);
  });

  it('쓰기가 성공하면 메모를 비운다', async () => {
    await cachedGet('/v1/boards/notice/posts', 60_000);
    await apiFetch('/v1/boards/posts/x/comments', { method: 'POST', body: '{}' });
    await cachedGet('/v1/boards/notice/posts', 60_000);
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(2);
  });
});

// T-11-106 영어일 때만 서버에 lang=en을 붙인다 — 한국어 요청 주소(엣지 캐시 키)는 그대로다.
describe('withLang', () => {
  afterEach(() => setLocale('ko'));
  it('한국어는 그대로, 영어는 lang=en을 붙인다', () => {
    expect(withLang('/v1/firsts?season=1')).toBe('/v1/firsts?season=1');
    setLocale('en', {});
    expect(withLang('/v1/firsts?season=1')).toBe('/v1/firsts?season=1&lang=en');
    expect(withLang('/v1/firsts')).toBe('/v1/firsts?lang=en');
  });
});

describe('ownerCachedGet server-confirmed denial', () => {
  beforeEach(() => {
    clearApiCache();
    vi.useFakeTimers();
    setLocale('ko');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setLocale('ko');
  });
  it('shares only owner denials across optional reads, expires and resets on login/cache clear', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Login required',
              details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
            },
          }),
          { status: 403 },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    await ownerCachedGet('/v1/items', 30_000);
    const denied = await ownerCachedGet('/v1/items/rewards', 30_000);
    expect(denied).toMatchObject({ ok: false, error: { reason: 'GOOGLE_LOGIN_REQUIRED' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    setLocale('en', {});
    await ownerCachedGet('/v1/items', 30_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(600_001);
    await ownerCachedGet('/v1/items', 30_000);
    expect(fetch).toHaveBeenCalledTimes(3);
    clearApiCache();
    await ownerCachedGet('/v1/items', 30_000);
    expect(fetch).toHaveBeenCalledTimes(4);
    fetch.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ data: { linked: { apple: true, google: false } } }), {
          status: 200,
        }),
    );
    await getProfile();
    await ownerCachedGet('/v1/items/rewards', 30_000);
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it('does not cache server/network failures or a denial that finishes after auth changes', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    await ownerCachedGet('/v1/items', 30_000);
    await ownerCachedGet('/v1/items', 30_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    let resolve!: (r: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    const pending = ownerCachedGet('/v1/items', 30_000);
    clearApiCache();
    resolve(
      new Response(
        JSON.stringify({
          error: { code: 'FORBIDDEN', details: { reason: 'GOOGLE_LOGIN_REQUIRED' } },
        }),
        { status: 403 },
      ),
    );
    await pending;
    await ownerCachedGet('/v1/items/rewards', 30_000);
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
