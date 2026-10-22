import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env.js';
import { purgeEdge } from '../edgeCache.js';
import { STALE } from '../edgeKeys.js';

// Entries/schedules, champion team names, moderation and account deletion can change the summary.
export const changesCupHome = (method: string, path: string) =>
  ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
  !(method === 'PUT' && /^\/v1\/cups\/[^/]+\/matches\/[^/]+\/prediction$/.test(path)) &&
  (/^\/v1\/(cups|admin|profile)(\/|$)/.test(path) || path === '/v1/owner-team');

export const cupHomeCache = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (c.res.status < 400 && changesCupHome(c.req.method, c.req.path))
    purgeEdge(c, STALE.cupChanged());
});
