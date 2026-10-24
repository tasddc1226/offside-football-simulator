import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env.js';
import { AppError, errorHandler } from '../errors.js';
import { securityHeaders } from './securityHeaders.js';

function app() {
  const server = new Hono<AppEnv>();
  server.use('*', securityHeaders);
  server.get('/v1/auth/apple/callback', (c) => c.redirect('/settings', 302));
  server.get('/v1/admin/failure', () => {
    throw new AppError({ code: 'FORBIDDEN' });
  });
  server.get('/cookie', (c) => {
    c.header('Set-Cookie', 'token=example');
    return c.text('ok');
  });
  server.get('*', (c) => {
    c.header('Cache-Control', 'public, max-age=60');
    return c.text('ok');
  });
  server.onError(errorHandler);
  return server;
}

describe('API security response headers', () => {
  it.each([
    '/v1/profile',
    '/v1/profile/settings',
    '/v1/admin/stats',
    '/v1/auth/app/exchange',
    '/v1/app/session',
    '/cookie',
  ])('prevents storage of sensitive response %s', async (path) => {
    expect((await app().request(path)).headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each(['/v1/auth/apple/callback', '/v1/admin/failure'])(
    'protects redirects and errors too: %s',
    async (path) => {
      const response = await app().request(path);
      expect([302, 403]).toContain(response.status);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    },
  );

  it.each(['/v1/hof', '/v1/avatars/public', '/v1/profile-public', '/v1/authors'])(
    'preserves unrelated public caching: %s',
    async (path) => {
      const response = await app().request(path);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    },
  );
});
