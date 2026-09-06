import { CORS_ALLOWED_HEADERS, CORS_EXPOSED_HEADERS } from '@offside/contracts';
import { cors as honoCors } from 'hono/cors';
import { parseAllowedOrigins, type Bindings } from '../env.js';
import { resolveRequestHostPair } from '../production-hosts.js';

export const cors = honoCors({
  origin: (origin, c) => {
    // c.env는 바인딩 없는 테스트 경로(예: 바인딩을 넘기지 않은 app.request())에서 undefined일 수 있다.
    // parseAllowedOrigins처럼 옵셔널 접근으로 방어한다 — 실제 Workers 런타임(local·staging·production)은
    // wrangler.jsonc의 vars로 ENVIRONMENT를 항상 채우므로 아래 분기와 정책은 그대로다.
    const env = c.env as Bindings | undefined;
    if (env && env.ENVIRONMENT === 'production') {
      const pair = resolveRequestHostPair(c.req.url, env);
      return pair?.webOrigin === origin ? origin : undefined;
    }
    const allowed = parseAllowedOrigins(env);
    return allowed.includes(origin) ? origin : undefined;
  },
  allowHeaders: [...CORS_ALLOWED_HEADERS],
  exposeHeaders: [...CORS_EXPOSED_HEADERS],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 600,
});
