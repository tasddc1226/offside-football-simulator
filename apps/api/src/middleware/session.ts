import { createMiddleware } from 'hono/factory';
import { readSessionToken } from '../auth/session.js';
import { sha256Hex } from '../db/hash.js';
import { findActiveSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';

/** 결정 1·3. 세션이 없거나 무효해도 여기서는 401을 내지 않는다(라우트가 결정). */
export const session = createMiddleware<AppEnv>(async (c, next) => {
  const token = readSessionToken(c);
  if (token) {
    const db = getDb(c);
    const tokenHash = await sha256Hex(token);
    const record = await findActiveSession(db, tokenHash, new Date().toISOString());
    if (record) {
      c.set('session', { id: record.id, profileId: record.profileId, channel: record.channel });
    }
  }
  await next();
});
