import { createMiddleware } from 'hono/factory';
import { readSessionToken } from '../auth/session.js';
import { sha256Hex } from '../db/hash.js';
import { getProfile } from '../db/repos/profiles.js';
import { findActiveSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';

/**
 * 결정 1·3. 세션이 없거나 무효해도 여기서는 401을 내지 않는다(라우트가 결정).
 * T-1-004 브리프 항목 8: `deleted_at`이 있는 프로필의 세션은 무효로 취급한다(설정하지 않는다).
 * `requireProfile`이 나머지 라우트에서 401 PROFILE_REQUIRED로 이어간다.
 */
export const session = createMiddleware<AppEnv>(async (c, next) => {
  const token = readSessionToken(c);
  if (token) {
    const db = getDb(c);
    const tokenHash = await sha256Hex(token);
    const record = await findActiveSession(db, tokenHash, new Date().toISOString());
    if (record) {
      const profile = await getProfile(db, record.profileId);
      if (profile && profile.deletedAt === null) {
        c.set('session', { id: record.id, profileId: record.profileId, channel: record.channel });
      }
    }
  }
  await next();
});
