import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env.js';

/** OAuth URLs carry credentials. Apply also to redirects, preflights and error responses. */
export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  if (
    /^\/v1\/(auth|profile|admin)(\/|$)/.test(c.req.path) ||
    c.req.path === '/v1/app/session' ||
    c.res.headers.has('Set-Cookie')
  ) {
    c.header('Cache-Control', 'private, no-store');
  }
});
