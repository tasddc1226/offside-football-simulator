import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { profiles } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { errorHandler } from '../errors.js';
import { createTestD1, spyDb, type TestD1 } from '../test/d1.js';
import { requireOwner } from './requireOwner.js';

describe('shared owner authorization (R4)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it.each(['google', 'apple', 'anonymous', 'deleted', 'missing', 'no-session'] as const)(
    '%s retains authorization, error copy and one profile query',
    async (kind) => {
      const now = '2026-11-01T00:00:00.000Z';
      if (kind !== 'missing' && kind !== 'no-session')
        await ctx.db.insert(profiles).values({
          id: 'owner-fixture',
          settingsJson: JSON.stringify({
            reducedMotion: 'SYSTEM',
            textScale: 100,
            theme: 'SYSTEM',
            defaultSimulationMode: 'CHAPTER',
          }),
          createdAt: now,
          lastSeenAt: now,
          googleSub: kind === 'google' || kind === 'deleted' ? 'owner-google' : null,
          appleSub: kind === 'apple' ? 'owner-apple' : null,
          deletedAt: kind === 'deleted' ? now : null,
        });
      const app = new Hono<AppEnv>();
      app.onError(errorHandler);
      app.use('*', async (c, next) => {
        c.set('requestId', 'owner-auth-fixture');
        if (kind !== 'no-session')
          c.set('session', { id: 'test-session', profileId: 'owner-fixture', channel: 'web' });
        await next();
      });
      app.get('/', async (c) => c.json({ id: (await requireOwner(c)).id }));
      const spy = spyDb(ctx.env.DB);
      const response = await app.request('/', {}, { ...ctx.env, DB: spy.DB });
      expect(spy.seen).toHaveLength(kind === 'no-session' ? 0 : 1);
      if (kind === 'google' || kind === 'apple') {
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ id: 'owner-fixture' });
      } else {
        expect(response.status).toBe(kind === 'no-session' ? 401 : 403);
        expect(await response.json()).toEqual({
          error:
            kind === 'no-session'
              ? {
                  code: 'PROFILE_REQUIRED',
                  message: '접속 정보가 없어요. 다시 연결해 주세요.',
                  retryable: false,
                }
              : {
                  code: 'FORBIDDEN',
                  message: '로그인하면 팀을 만들 수 있어요.',
                  retryable: false,
                  details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
                },
          meta: { requestId: 'owner-auth-fixture' },
        });
      }
    },
  );
});
