import { REQUEST_BODY_MAX_BYTES } from '@offside/contracts';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../env.js';
import { errorHandler } from '../errors.js';
import { bodyGuard } from './bodyGuard.js';

function app() {
  const server = new Hono<AppEnv>();
  server.use('*', bodyGuard);
  server.post('/read-json', async (c) =>
    c.json({ parsed: await c.req.json(), text: await c.req.text() }),
  );
  server.post('*', (c) => c.text(c.get('rawBody') ?? ''));
  server.onError(errorHandler);
  return server;
}

function streamed(chunks: Uint8Array[], headers: Record<string, string> = {}, path = '/write') {
  let sent = 0;
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (sent < chunks.length) controller.enqueue(chunks[sent++]!);
        else controller.close();
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: stream,
    duplex: 'half',
  };
  return { request: new Request(`http://localhost${path}`, init), cancel, sent: () => sent };
}

describe('bounded request bodies', () => {
  it('preserves Hono body caching for downstream store notification parsers', async () => {
    const body = JSON.stringify({ signedPayload: 'test-signed-payload' });
    const input = streamed([new TextEncoder().encode(body)], {}, '/read-json');
    const response = await app().request(input.request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ parsed: JSON.parse(body), text: body });
  });
  it.each([undefined, '1'])(
    'cancels oversized streams without trusting Content-Length %s',
    async (length) => {
      const input = streamed(
        [new Uint8Array(REQUEST_BODY_MAX_BYTES), new Uint8Array(1), new Uint8Array(1024)],
        length ? { 'Content-Length': length } : {},
      );
      const response = await app().request(input.request);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { details: { reason: 'BODY_TOO_LARGE' } },
      });
      expect(input.cancel).toHaveBeenCalledOnce();
      expect(input.sent()).toBe(2);
    },
  );

  it('rejects declared oversized bodies before reading any bytes', async () => {
    const input = streamed([new Uint8Array(1)], {
      'Content-Length': String(REQUEST_BODY_MAX_BYTES + 1),
    });
    expect((await app().request(input.request)).status).toBe(400);
    expect(input.sent()).toBe(0);
  });

  it('accepts exactly the byte limit', async () => {
    const bytes = new TextEncoder().encode('a'.repeat(REQUEST_BODY_MAX_BYTES));
    const response = await app().request(streamed([bytes]).request);
    expect(response.status).toBe(200);
    expect(await response.text()).toHaveLength(REQUEST_BODY_MAX_BYTES);
  });

  it('preserves UTF-8 split across chunks and counts bytes rather than characters', async () => {
    const bytes = new TextEncoder().encode('{"name":"한글⚽"}');
    const chunks = Array.from(bytes, (byte) => new Uint8Array([byte]));
    const response = await app().request(streamed(chunks).request);
    expect(await response.text()).toBe('{"name":"한글⚽"}');
    const oversized = new TextEncoder().encode('⚽'.repeat(Math.ceil(REQUEST_BODY_MAX_BYTES / 3)));
    expect((await app().request(streamed([oversized]).request)).status).toBe(400);
  });

  it('also bounds the Apple form callback before parsing or redirecting', async () => {
    const input = streamed(
      [new Uint8Array(REQUEST_BODY_MAX_BYTES + 1)],
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      '/v1/auth/apple/callback',
    );
    expect((await app().request(input.request)).status).toBe(400);
    expect(input.cancel).toHaveBeenCalledOnce();
  });

  it.each(['application/jsonp', 'application/json-invalid', 'text/plain'])(
    'rejects misleading media type %s',
    async (type) => {
      const response = await app().request('/write', {
        method: 'POST',
        headers: { 'Content-Type': type },
        body: '{}',
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { details: { reason: 'JSON_BODY_REQUIRED' } },
      });
    },
  );

  it('accepts JSON parameters and empty JSON bodies', async () => {
    const response = await app().request('/write', {
      method: 'POST',
      headers: { 'Content-Type': 'Application/JSON; charset=utf-8' },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });
});
