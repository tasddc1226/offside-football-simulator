import { createMiddleware } from 'hono/factory';
import { AppError } from '../errors.js';
import type { AppEnv } from '../env.js';

/** T-2-015: 응답 본문에는 고정 문구만 나가므로(errors.ts) 원문 메시지는 여기서만 남긴다. */
const MAX_ERROR_MESSAGE_LENGTH = 500;

/** 결정 7: 요청당 JSON 한 줄. 헤더·쿠키·토큰·본문·이메일·선수명은 절대 담지 않는다. */
export const logger = createMiddleware<AppEnv>(async (c, next) => {
  const startedAt = c.get('startedAt');
  await next();

  const status = c.res.status;
  const storeFailure = c.get('storeFailure');
  const entry: Record<string, unknown> = {
    level: status >= 500 ? 'error' : status >= 400 || storeFailure ? 'warn' : 'info',
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
    entry.errorMessage = c.error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
    entry.error = { name: c.error.name, message: c.error.message, stack: c.error.stack };
  } else if (storeFailure) {
    entry.errorCode = storeFailure.code;
    entry.error = { message: storeFailure.message };
  }

  console.log(JSON.stringify(entry));
});
