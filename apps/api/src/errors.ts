import {
  HTTP_STATUS_BY_CODE,
  RETRYABLE_BY_CODE,
  type ErrorCode,
  type ErrorEnvelope,
} from '@offside/contracts';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from './env.js';

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly status?: ErrorStatus;

  constructor(input: { code: ErrorCode; message?: string; details?: unknown; status?: ErrorStatus }) {
    super(input.message ?? input.code);
    this.name = 'AppError';
    this.code = input.code;
    if (input.details !== undefined) {
      this.details = input.details;
    }
    if (input.status !== undefined) {
      this.status = input.status;
    }
  }
}

/** zod를 직접 의존하지 않고 구조적 타입으로 `safeParse`를 받는다(브리프: 새 의존성 없음). */
type SafeParseIssue = { path: PropertyKey[]; message: string };
type SafeParseResult<T> = { success: true; data: T } | { success: false; error: { issues: SafeParseIssue[] } };
export type SchemaLike<T> = { safeParse: (data: unknown) => SafeParseResult<T> };

/** Zod 실패를 AppError(VALIDATION_FAILED)로 바꾼다. 값은 담지 않고 path·message만 담는다. */
export function parseWithAppError<T>(schema: SchemaLike<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: '입력값이 올바르지 않습니다.',
      details: { issues: result.error.issues.map((issue) => ({ path: issue.path, message: issue.message })) },
    });
  }
  return result.data;
}

/** T-2-015: unknown error(AppError 아님)는 원문(예: SQL 전문)을 응답에 절대 담지 않는다. 원문은
 * middleware/logger.ts가 서버 로그로만 남긴다. */
const UNKNOWN_ERROR_MESSAGE = '일시적인 오류입니다. 잠시 후 다시 시도해 주세요.';

export function toErrorEnvelope(err: unknown, requestId: string): { status: ErrorStatus; body: ErrorEnvelope } {
  if (err instanceof AppError) {
    return {
      status: err.status ?? HTTP_STATUS_BY_CODE[err.code],
      body: {
        error: {
          code: err.code,
          message: err.message,
          retryable: RETRYABLE_BY_CODE[err.code],
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
        meta: { requestId },
      },
    };
  }

  return {
    status: 503,
    body: {
      error: { code: 'SERVICE_UNAVAILABLE', message: UNKNOWN_ERROR_MESSAGE, retryable: true },
      meta: { requestId },
    },
  };
}

export function errorHandler(err: Error, c: Context<AppEnv>): Response {
  const { status, body } = toErrorEnvelope(err, c.get('requestId'));
  return c.json(body, status as ContentfulStatusCode);
}

export function notFoundHandler(c: Context<AppEnv>): Response {
  const body: ErrorEnvelope = {
    error: { code: 'VALIDATION_FAILED', message: '알 수 없는 경로입니다.', retryable: false },
    meta: { requestId: c.get('requestId') },
  };
  return c.json(body, 404);
}

/** bodyGuard가 담아 둔 rawBody를 JSON으로 읽는다(빈 본문은 {}). */
export function parseJsonBody(rawBody: string): unknown {
  try {
    return rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
  }
}
