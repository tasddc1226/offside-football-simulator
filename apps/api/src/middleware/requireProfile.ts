import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { AppError } from '../errors.js';
import type { AppEnv, SessionContext } from '../env.js';
import { resolveSession } from './session.js';

/** 결정 2: GET /profile을 제외한 보호 라우트는 세션이 없으면 새로 만들지 않고 401을 낸다. */
export const requireProfile = createMiddleware<AppEnv>(async (c, next) => {
  if (!(await resolveSession(c))) {
    throw new AppError({ code: 'PROFILE_REQUIRED', message: '프로필 세션이 필요합니다.' });
  }
  await next();
});

/** requireProfile 뒤에서만 호출한다. 세션이 없으면 방어적으로 같은 오류를 던진다. */
export function getSessionOrThrow(c: Context<AppEnv>): SessionContext {
  const session = c.get('session');
  if (!session) {
    throw new AppError({ code: 'PROFILE_REQUIRED', message: '프로필 세션이 필요합니다.' });
  }
  return session;
}
