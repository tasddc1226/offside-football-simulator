import { createMiddleware } from 'hono/factory';
import { AppError } from '../errors.js';
import { parseAllowedOrigins, type AppEnv } from '../env.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 결정 4: 상태 변경 요청은 허용된 Origin이어야 한다. GET·HEAD·OPTIONS는 대상이 아니다. */
export const originGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (STATE_CHANGING_METHODS.has(c.req.method)) {
    const origin = c.req.header('Origin');
    const allowed = parseAllowedOrigins(c.env);
    if (!origin || !allowed.includes(origin)) {
      throw new AppError({ code: 'ORIGIN_NOT_ALLOWED', message: '허용되지 않은 origin입니다.' });
    }
  }
  await next();
});
