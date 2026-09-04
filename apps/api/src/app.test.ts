import { ErrorEnvelopeSchema } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { createTestD1, type TestD1 } from './test/d1.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';
const DISALLOWED_ORIGIN = 'https://evil.example';

describe('CORS', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('프리플라이트(허용 origin)에 필요한 헤더를 모두 준다', async () => {
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      {
        method: 'OPTIONS',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'Access-Control-Request-Method': 'PATCH',
          'Access-Control-Request-Headers': 'content-type, idempotency-key',
        },
      },
      ctx.env,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    const allowHeaders = res.headers.get('Access-Control-Allow-Headers') ?? '';
    expect(allowHeaders).toContain('Content-Type');
    expect(allowHeaders).toContain('Idempotency-Key');
    expect(allowHeaders).toContain('If-Match');
    expect(allowHeaders).toContain('Authorization');
    // SyncClient(packages/engine-client)가 모든 GET/PUT에 X-Request-Id 요청 헤더를 보낸다 —
    // Allow-Headers에 없으면 실제 브라우저 preflight가 이 헤더를 거부해 동기화가 전부 실패한다.
    expect(allowHeaders).toContain('X-Request-Id');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('X-Request-Id');
  });

  it('프리플라이트(허용되지 않은 origin)에는 Access-Control-Allow-Origin이 없다', async () => {
    const app = createApp();
    const res = await app.request(
      '/v1/profile/settings',
      {
        method: 'OPTIONS',
        headers: {
          Origin: DISALLOWED_ORIGIN,
          'Access-Control-Request-Method': 'PATCH',
        },
      },
      ctx.env,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('오류 봉투', () => {
  let ctx: TestD1;

  beforeEach(async () => {
    ctx = await createTestD1();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('알 수 없는 경로는 404와 ErrorEnvelopeSchema를 돌려준다', async () => {
    const app = createApp();
    const res = await app.request('/v1/does-not-exist', {}, ctx.env);

    expect(res.status).toBe(404);
    const body = await res.json();
    const parsed = ErrorEnvelopeSchema.parse(body);
    expect(parsed.error.code).toBe('VALIDATION_FAILED');
  });

  it('예상하지 못한 예외는 503 SERVICE_UNAVAILABLE(retryable)로 나가고 원문 대신 고정 문구를 담는다(T-2-015)', async () => {
    const app = createApp({ testRoutes: true });
    const res = await app.request('/v1/test/throw', {}, ctx.env);

    expect(res.status).toBe(503);
    const body = await res.json();
    const parsed = ErrorEnvelopeSchema.parse(body);
    expect(parsed.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(parsed.error.retryable).toBe(true);
    expect(parsed.error.message).toBe('일시적인 오류입니다. 잠시 후 다시 시도해 주세요.');
    expect(parsed.error.message).not.toContain('boom');
    expect(JSON.stringify(body)).not.toContain('.ts:');
  });

  it('모든 오류 응답의 meta.requestId가 X-Request-Id 헤더와 같고 req_로 시작한다', async () => {
    const app = createApp({ testRoutes: true });

    for (const path of ['/v1/does-not-exist', '/v1/test/throw']) {
      const res = await app.request(path, {}, ctx.env);
      const body = await res.json();
      const parsed = ErrorEnvelopeSchema.parse(body);
      const headerId = res.headers.get('X-Request-Id');
      expect(headerId).toMatch(/^req_/);
      expect(parsed.meta.requestId).toBe(headerId);
    }
  });
});

describe('로그', () => {
  let ctx: TestD1;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    ctx = await createTestD1();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await ctx.dispose();
  });

  it('요청마다 JSON 한 줄을 남기고 필수 키를 포함한다', async () => {
    const app = createApp();
    await app.request('/v1/profile', {}, ctx.env);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed).toHaveProperty('requestId');
    expect(parsed).toHaveProperty('method');
    expect(parsed).toHaveProperty('path');
    expect(parsed).toHaveProperty('status');
    expect(parsed).toHaveProperty('durationMs');
  });

  it('쿠키·토큰·Authorization 값·이메일 문자열이 로그에 없다', async () => {
    const app = createApp();
    const first = await app.request('/v1/profile', {}, ctx.env);
    const setCookie = first.headers.get('Set-Cookie') ?? '';
    const token = /offside_session=([^;]+)/.exec(setCookie)?.[1] ?? '';
    expect(token.length).toBeGreaterThan(0);

    logSpy.mockClear();
    const bearerValue = `Bearer ${token}`;
    await app.request(
      '/v1/profile',
      { headers: { Cookie: `offside_session=${token}`, Authorization: bearerValue, 'X-Fake-Email': 'user@example.com' } },
      ctx.env,
    );

    const lines = logSpy.mock.calls.map((call: unknown[]) => call[0] as string);
    for (const line of lines) {
      expect(line).not.toContain(token);
      expect(line).not.toContain(bearerValue);
      expect(line).not.toContain('user@example.com');
    }
  });

  it('503 케이스 로그에는 error.stack이 있다', async () => {
    const app = createApp({ testRoutes: true });
    await app.request('/v1/test/throw', {}, ctx.env);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as { error?: { stack?: string }; errorCode?: string };
    expect(parsed.errorCode).toBe('SERVICE_UNAVAILABLE');
    expect(parsed.error?.stack).toBeTruthy();
  });
});
