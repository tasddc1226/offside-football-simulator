import { CONTENT_TYPE_HEADER, REQUEST_BODY_MAX_BYTES } from '@offside/contracts';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../errors.js';
import type { AppEnv } from '../env.js';
import { APPLE_WEB_CALLBACK_PATH } from './originGuard.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function bodyTooLarge(): never {
  throw new AppError({
    code: 'VALIDATION_FAILED',
    message: '요청 데이터가 너무 커요.',
    details: { reason: 'BODY_TOO_LARGE' },
  });
}

/** 결정 4: Content-Type·본문 크기 검사. 읽은 본문은 c.set('rawBody')로 라우트에 전달한다. */
export const bodyGuard = createMiddleware<AppEnv>(async (c, next) => {
  // T-11-202 Apple form_post 콜백은 폼 본문이다(라우트가 직접 읽는다).
  if (STATE_CHANGING_METHODS.has(c.req.method) && c.req.path !== APPLE_WEB_CALLBACK_PATH) {
    const contentType = c.req.header(CONTENT_TYPE_HEADER) ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '요청 데이터 형식이 올바르지 않아요.',
        details: { reason: 'JSON_BODY_REQUIRED' },
      });
    }

    const contentLength = c.req.header('Content-Length');
    if (contentLength && Number(contentLength) > REQUEST_BODY_MAX_BYTES) {
      bodyTooLarge();
    }

    const rawBody = await c.req.text();
    if (new TextEncoder().encode(rawBody).length > REQUEST_BODY_MAX_BYTES) {
      bodyTooLarge();
    }
    c.set('rawBody', rawBody);
  }
  await next();
});
