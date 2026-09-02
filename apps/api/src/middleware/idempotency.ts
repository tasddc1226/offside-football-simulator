import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts';
import { createMiddleware } from 'hono/factory';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { sha256Hex } from '../db/hash.js';
import { getIdempotent, putIdempotent } from '../db/repos/idempotency.js';
import { AppError } from '../errors.js';
import { getDb, type AppEnv } from '../env.js';
import { getSessionOrThrow } from './requireProfile.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';

/** 결정 5. requireProfile 뒤에 둔다. */
export const idempotency = createMiddleware<AppEnv>(async (c, next) => {
  const key = c.req.header(IDEMPOTENCY_KEY_HEADER);
  if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: 'Idempotency-Key가 필요합니다.',
      details: { reason: 'IDEMPOTENCY_KEY_REQUIRED' },
    });
  }

  const session = getSessionOrThrow(c);
  const db = getDb(c);
  const rawBody = c.get('rawBody') ?? '';
  const requestHash = await sha256Hex(`${c.req.method}:${new URL(c.req.url).pathname}:${rawBody}`);
  const now = new Date().toISOString();

  const existing = await getIdempotent(db, session.profileId, key, now);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '같은 Idempotency-Key가 다른 요청에 재사용되었습니다.',
        details: { reason: 'IDEMPOTENCY_KEY_REUSED' },
      });
    }
    c.header(IDEMPOTENT_REPLAYED_HEADER, 'true');
    return c.body(existing.responseBody, existing.responseStatus as ContentfulStatusCode, {
      'Content-Type': 'application/json',
    });
  }

  await next();

  const status = c.res.status;
  const shouldStore = (status >= 200 && status < 300) || status === 409;
  if (shouldStore) {
    const responseBody = await c.res.clone().text();
    try {
      await putIdempotent(db, {
        ownerProfileId: session.profileId,
        key,
        requestHash,
        responseStatus: status,
        responseBody,
        createdAt: now,
        expiresAt: new Date(Date.parse(now) + IDEMPOTENCY_TTL_MS).toISOString(),
      });
    } catch (err) {
      // 라우트는 이미 성공했다. 저장 실패로 응답을 바꾸지 않고 로그로만 남긴다.
      c.set('storeFailure', {
        code: 'IDEMPOTENCY_STORE_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
});
