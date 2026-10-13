import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { cupHomeCache, changesCupHome } from './cupHomeCache.js';
import { installFakeEdgeCache, flushEdge } from '../test/edgeCache.js';
import { purgeEdgeOrigin } from '../edgeCache.js';

describe('cup summary invalidation', () => {
  it('covers entries, schedules, moderation, team rename and account deletion, skips unrelated reads/writes', () => {
    for (const path of [
      '/v1/cups/s1-1/entries',
      '/v1/cups/s1-1/entries/me',
      '/v1/admin/cups',
      '/v1/owner-team',
      '/v1/profile/delete',
    ])
      expect(changesCupHome('POST', path)).toBe(true);
    expect(changesCupHome('GET', '/v1/cups/home')).toBe(false);
    expect(changesCupHome('PUT', '/v1/careers/id/seasons/2026')).toBe(false);
  });
  it('purges successful writes only and cron uses the same canonical key', async () => {
    const fake = installFakeEdgeCache();
    try {
      const app = new Hono();
      app.use('*', cupHomeCache);
      app.post('/v1/admin/cups', (c) => c.json({}, 200));
      app.delete('/v1/cups/test/entries/me', (c) => c.json({}, 403));
      await app.request('https://api.example/v1/admin/cups', { method: 'POST' });
      await flushEdge();
      expect(fake.purged).toEqual(['https://api.example/v1/cups/home']);
      await app.request('https://api.example/v1/cups/test/entries/me', { method: 'DELETE' });
      await flushEdge();
      expect(fake.purged).toHaveLength(1);
      await purgeEdgeOrigin('https://api.example', ['/v1/cups/home']);
      expect(fake.purged).toHaveLength(2);
    } finally {
      fake.uninstall();
    }
  });
});
