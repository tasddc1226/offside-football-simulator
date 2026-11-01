import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFetch,
  cachedGet,
  clearApiCache,
  configureApi,
  ownerCachedGet,
  withProfile,
} from './client.js';

const error = {
  code: 'FORBIDDEN',
  message: 'Owner access required',
  retryable: false,
  details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
};
const expected = {
  code: error.code,
  message: error.message,
  retryable: error.retryable,
  reason: error.details.reason,
};
const response = (body: unknown, status = 403) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  configureApi({ baseUrl: 'https://api.example.test', auth: () => ({}) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  configureApi({ baseUrl: 'http://localhost:8787', auth: () => ({ credentials: 'include' }) });
});

describe('API error request IDs', () => {
  it('preserves the server ID alongside the existing error fields without another request', async () => {
    const fetch = vi.fn(async () => response({ error, meta: { requestId: 'req_owner' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await apiFetch('/v1/items')).toEqual({
      ok: false,
      error: { ...expected, requestId: 'req_owner' },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    undefined,
    null,
    {},
    'req_wrong_container',
    { requestId: null },
    { requestId: 123 },
    { requestId: {} },
    { requestId: [] },
    { requestId: '' },
    { requestId: '   ' },
  ])('keeps the legacy error shape for absent or malformed metadata: %j', async (meta) => {
    vi.stubGlobal('fetch', async () => response({ error, meta }));
    expect(await apiFetch('/v1/items')).toEqual({ ok: false, error: expected });
  });

  it('keeps an available ID when a parsed HTTP error has no error envelope', async () => {
    vi.stubGlobal('fetch', async () => response({ meta: { requestId: 'req_invalid' } }, 503));
    const result = await apiFetch('/v1/items');
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_RESPONSE', retryable: true, requestId: 'req_invalid' },
    });
  });

  it('keeps an available ID when a successful HTTP response has an invalid data envelope', async () => {
    vi.stubGlobal('fetch', async () => response({ meta: { requestId: 'req_bad_shape' } }, 200));
    expect(await apiFetch('/v1/items')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_RESPONSE', retryable: false, requestId: 'req_bad_shape' },
    });
  });

  it.each([null, 0, false, 'invalid', [], {}])(
    'preserves HTTP error fallback behavior for a JSON body without an envelope: %j',
    async (body) => {
      vi.stubGlobal('fetch', async () => response(body, 503));
      const result = await apiFetch('/v1/items');
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'INVALID_RESPONSE', retryable: true },
      });
      if (!result.ok) expect(result.error).not.toHaveProperty('requestId');
    },
  );

  it.each([false, 0, ''])(
    'keeps falsy JSON error values on the existing UNKNOWN path: %j',
    async (value) => {
      vi.stubGlobal('fetch', async () =>
        response({ error: value, meta: { requestId: 'req_unknown' } }, 503),
      );
      expect(await apiFetch('/v1/items')).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN', retryable: false, requestId: 'req_unknown' },
      });
    },
  );

  it('does not add metadata to successful results', async () => {
    vi.stubGlobal('fetch', async () =>
      response({ data: { n: 1 }, meta: { requestId: 'req_ok' } }, 200),
    );
    expect(await apiFetch('/v1/items')).toEqual({ ok: true, data: { n: 1 } });
  });

  it('does not invent IDs for network failures or invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')));
    const network = await apiFetch('/v1/items');
    expect(network).toMatchObject({ ok: false, error: { code: 'NETWORK_ERROR', retryable: true } });
    if (!network.ok) expect(network.error).not.toHaveProperty('requestId');
    vi.stubGlobal('fetch', async () => new Response('not JSON', { status: 503 }));
    const invalid = await apiFetch('/v1/items');
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: 'INVALID_RESPONSE', retryable: false },
    });
    if (!invalid.ok) expect(invalid.error).not.toHaveProperty('requestId');
  });

  it('does not cache failed GETs or reuse an earlier request ID', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ error, meta: { requestId: 'req_first' } }))
      .mockResolvedValueOnce(response({ error, meta: { requestId: 'req_second' } }));
    vi.stubGlobal('fetch', fetch);
    expect(await cachedGet('/v1/items', 60_000)).toMatchObject({
      error: { requestId: 'req_first' },
    });
    expect(await cachedGet('/v1/items', 60_000)).toMatchObject({
      error: { requestId: 'req_second' },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('preserves the original ID for an intentionally cached owner denial and clears it on reset', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ error, meta: { requestId: 'req_denied' } }))
      .mockResolvedValueOnce(response({ error, meta: { requestId: 'req_fresh' } }));
    vi.stubGlobal('fetch', fetch);
    await ownerCachedGet('/v1/items', 60_000);
    expect(await ownerCachedGet('/v1/items/rewards', 60_000)).toMatchObject({
      error: { requestId: 'req_denied' },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    clearApiCache();
    expect(await ownerCachedGet('/v1/items', 60_000)).toMatchObject({
      error: { requestId: 'req_fresh' },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    'retains the correct response ID when session renewal succeeds: %s',
    async (renewed) => {
      const renewSession = vi.fn(async () => renewed);
      configureApi({ baseUrl: 'https://api.example.test', auth: () => ({}), renewSession });
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          response({ error: { code: 'PROFILE_REQUIRED' }, meta: { requestId: 'req_auth' } }, 401),
        )
        .mockResolvedValueOnce(response({ error, meta: { requestId: 'req_retry' } }));
      vi.stubGlobal('fetch', fetch);
      const result = await withProfile(() => apiFetch('/v1/items'));
      expect(result).toMatchObject({ error: { requestId: renewed ? 'req_retry' : 'req_auth' } });
      expect(fetch).toHaveBeenCalledTimes(renewed ? 2 : 1);
      expect(renewSession).toHaveBeenCalledTimes(1);
    },
  );
});
