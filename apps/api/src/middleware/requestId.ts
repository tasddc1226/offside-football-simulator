import { REQUEST_ID_HEADER } from '@offside/contracts';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env.js';

/**
 * 요청 부트스트랩. 들어온 X-Request-Id는 신뢰하지 않고 항상 새로 만든다.
 * 이 미들웨어가 체인의 첫 단계이므로 이후 미들웨어가 공통으로 쓰는 시작 시각도 여기서 만든다.
 * db는 `getDb(c)`가 실제로 쓰는 시점에 지연 생성한다(health처럼 DB가 필요 없는 라우트도 있다).
 */
export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const id = `req_${crypto.randomUUID()}`;
  c.set('requestId', id);
  c.set('startedAt', Date.now());
  c.header(REQUEST_ID_HEADER, id);
  await next();
});
