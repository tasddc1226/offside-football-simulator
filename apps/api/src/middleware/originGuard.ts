import { createMiddleware } from 'hono/factory';
import { AppError } from '../errors.js';
import { parseAllowedOrigins, type AppEnv, type Bindings } from '../env.js';
import { resolveRequestHostPair } from '../production-hosts.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 이 요청이 받아들이는 웹 Origin. 운영은 들어온 호스트와 짝인 웹 하나뿐이다(production-hosts.ts). */
export function allowedOriginsFor(requestUrl: string, env: Bindings): string[] {
  if (env.ENVIRONMENT !== 'production') return parseAllowedOrigins(env);
  const pair = resolveRequestHostPair(requestUrl, env);
  return pair === null ? [] : [pair.webOrigin];
}

/** 결정 4: 상태 변경 요청은 허용된 Origin이어야 한다. GET·HEAD·OPTIONS는 대상이 아니다. */
export const originGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (STATE_CHANGING_METHODS.has(c.req.method)) {
    const origin = c.req.header('Origin');
    if (!origin || !allowedOriginsFor(c.req.url, c.env).includes(origin)) {
      throw new AppError({ code: 'ORIGIN_NOT_ALLOWED', message: '허용되지 않은 origin입니다.' });
    }
  }
  await next();
});
