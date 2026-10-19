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

/** Count bytes before decoding; never buffer an unbounded request while checking its size. */
async function readBoundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > REQUEST_BODY_MAX_BYTES) {
        // Cleanup must not delay rejection if a producer never settles cancellation.
        void reader.cancel().catch(() => {});
        bodyTooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/** Content-Type and bounded body read, including Apple's cross-site form callback. */
export const bodyGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (STATE_CHANGING_METHODS.has(c.req.method)) {
    const appleForm = c.req.path === APPLE_WEB_CALLBACK_PATH;
    const contentType = (c.req.header(CONTENT_TYPE_HEADER) ?? '')
      .split(';')[0]!
      .trim()
      .toLowerCase();
    const expected = appleForm ? 'application/x-www-form-urlencoded' : 'application/json';
    if (contentType !== expected) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '요청 데이터 형식이 올바르지 않아요.',
        details: { reason: appleForm ? 'FORM_BODY_REQUIRED' : 'JSON_BODY_REQUIRED' },
      });
    }

    const contentLength = c.req.header('Content-Length');
    if (contentLength && Number(contentLength) > REQUEST_BODY_MAX_BYTES) {
      bodyTooLarge();
    }

    const rawBody = await readBoundedBody(c.req.raw);
    c.set('rawBody', rawBody);
  }
  await next();
});
