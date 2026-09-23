import { z } from 'zod';

/** T-9-001a: 로그인·프로필 API에서 실제로 쓰는 오류 코드만 남겼다(07 문서 표의 부분집합). */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'RECOVERY_CODE_INVALID',
  'TOSS_KEY_INVALID',
  'ORIGIN_NOT_ALLOWED',
  'PROFILE_REQUIRED',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

type HttpStatus = 400 | 401 | 403 | 429 | 503;

/** 07 "오류 코드" 표의 HTTP 열. */
export const HTTP_STATUS_BY_CODE: Record<ErrorCode, HttpStatus> = {
  VALIDATION_FAILED: 400,
  RECOVERY_CODE_INVALID: 400,
  TOSS_KEY_INVALID: 401,
  ORIGIN_NOT_ALLOWED: 403,
  PROFILE_REQUIRED: 401,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
};

/** RATE_LIMITED, SERVICE_UNAVAILABLE만 재시도 가능. */
export const RETRYABLE_BY_CODE: Record<ErrorCode, boolean> = {
  VALIDATION_FAILED: false,
  RECOVERY_CODE_INVALID: false,
  TOSS_KEY_INVALID: false,
  ORIGIN_NOT_ALLOWED: false,
  PROFILE_REQUIRED: false,
  RATE_LIMITED: true,
  SERVICE_UNAVAILABLE: true,
};
