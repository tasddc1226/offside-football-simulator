import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, getProfile, issueRecoveryCode } from './client.js';

const PROFILE_META = { requestId: 'req_1' };
const PROFILE_BODY = {
  id: 'prf_1',
  settings: { reducedMotion: 'SYSTEM', textScale: 100, theme: 'SYSTEM', defaultSimulationMode: 'FAST' },
  linked: { google: false, toss: false },
  recoveryCodeIssuedAt: null,
  createdAt: '2026-09-01T00:00:00Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('성공 봉투의 data를 돌려준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { data: PROFILE_BODY, meta: PROFILE_META })),
    );

    const result = await apiFetch('/v1/profile');

    expect(result).toEqual({ ok: true, data: PROFILE_BODY });
  });

  it('오류 봉투를 code·message·retryable로 정규화한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(429, {
          error: { code: 'RATE_LIMITED', message: '요청이 많습니다.', retryable: true },
          meta: PROFILE_META,
        }),
      ),
    );

    const result = await apiFetch('/v1/profile');

    expect(result).toEqual({
      ok: false,
      error: { code: 'RATE_LIMITED', message: '요청이 많습니다.', retryable: true },
    });
  });

  it('네트워크 실패는 NETWORK_ERROR·retryable true로 정규화한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    const result = await apiFetch('/v1/profile');

    expect(result).toEqual({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: '서버에 연결할 수 없습니다.', retryable: true },
    });
  });

  it('JSON이 아닌 응답은 INVALID_RESPONSE로 정규화한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<not json>', { status: 200 })));

    const result = await apiFetch('/v1/profile');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('INVALID_RESPONSE');
  });

  it('dataSchema 검증에 실패하면 INVALID_RESPONSE를 돌려준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { data: { unexpected: true }, meta: PROFILE_META })),
    );

    const result = await getProfile();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('INVALID_RESPONSE');
  });

  it('GET이 아닌 요청에는 Idempotency-Key 헤더를 붙인다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: { code: 'OFS-ABCD-2345-EFGH', issuedAt: '2026-09-02T00:00:00Z' }, meta: PROFILE_META }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await issueRecoveryCode();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get(IDEMPOTENCY_KEY_HEADER)).not.toBeNull();
  });

  it('GET 요청에는 Idempotency-Key 헤더를 붙이지 않는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: PROFILE_BODY, meta: PROFILE_META }));
    vi.stubGlobal('fetch', fetchMock);

    await getProfile();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has(IDEMPOTENCY_KEY_HEADER)).toBe(false);
  });
});
