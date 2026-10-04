import { AUTHORIZATION_HEADER } from '@offside/contracts';
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

/** T-11-003 앱이 첫 실행에 익명 세션을 받는 경로 — 아직 Bearer가 없다. */
const APP_SESSION_PATH = '/v1/app/session';

/**
 * 결정 4: 상태 변경 요청은 허용된 Origin이어야 한다. GET·HEAD·OPTIONS는 대상이 아니다.
 * Bearer 요청은 제외한다 — 브라우저가 다른 사이트에서 Authorization 헤더를 몰래 실어 보낼 수 없어 CSRF가 없고,
 * 네이티브 앱(T-11-003)은 Origin을 보내지 않는다.
 */
export const originGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (
    STATE_CHANGING_METHODS.has(c.req.method) &&
    !c.req.header(AUTHORIZATION_HEADER) &&
    c.req.path !== APP_SESSION_PATH
  ) {
    const origin = c.req.header('Origin');
    if (!origin || !allowedOriginsFor(c.req.url, c.env).includes(origin)) {
      throw new AppError({
        code: 'ORIGIN_NOT_ALLOWED',
        message: '이 접속 경로에서는 요청할 수 없어요.',
      });
    }
  }
  await next();
});
