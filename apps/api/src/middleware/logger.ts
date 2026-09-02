import { createMiddleware } from 'hono/factory';
import { AppError } from '../errors.js';
import type { AppEnv } from '../env.js';

/** 결정 7: 요청당 JSON 한 줄. 헤더·쿠키·토큰·본문·이메일·선수명은 절대 담지 않는다. */
export const logger = createMiddleware<AppEnv>(async (c, next) => {
  const startedAt = c.get('startedAt');
  await next();

  const status = c.res.status;
  const entry: Record<string, unknown> = {
    level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
    ts: new Date().toISOString(),
    requestId: c.get('requestId'),
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status,
    durationMs: Date.now() - startedAt,
  };

  const session = c.get('session');
  if (session) {
    entry.profileId = session.profileId;
  }

  if (c.error) {
    entry.errorCode = c.error instanceof AppError ? c.error.code : 'SERVICE_UNAVAILABLE';
    entry.error = { name: c.error.name, message: c.error.message, stack: c.error.stack };
  }

  console.log(JSON.stringify(entry));
});
