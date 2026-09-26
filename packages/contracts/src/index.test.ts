import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { envelope, ErrorEnvelopeSchema, successEnvelope } from './envelope.js';
import {
  ERROR_CODES,
  ErrorCodeSchema,
  HTTP_STATUS_BY_CODE,
  RETRYABLE_BY_CODE,
  type ErrorCode,
} from './errors.js';
import { HealthDataSchema } from './health.js';
import { CONTRACTS_VERSION } from './index.js';
import { ClientIdSchema } from './primitives.js';
import { ProfileSettingsSchema } from './profile.js';

describe('CONTRACTS_VERSION', () => {
  it('is exported', () => {
    expect(CONTRACTS_VERSION).toBe('0.2.0');
  });
});

describe('봉투 스키마', () => {
  it('성공 응답 봉투', () => {
    const json = `
      {
        "data": {},
        "meta": { "requestId": "req_..." }
      }
    `;
    const result = successEnvelope(z.looseObject({})).safeParse(JSON.parse(json));
    expect(result.success).toBe(true);
  });

  it('오류 응답 봉투', () => {
    const json = `
      {
        "error": {
          "code": "VALIDATION_FAILED",
          "message": "요청이 올바르지 않습니다.",
          "retryable": false
        },
        "meta": { "requestId": "req_..." }
      }
    `;
    const result = ErrorEnvelopeSchema.safeParse(JSON.parse(json));
    expect(result.success).toBe(true);
  });
});

describe('오류 코드 표', () => {
  const TABLE: Record<ErrorCode, { httpStatus: number; retryable: boolean }> = {
    VALIDATION_FAILED: { httpStatus: 400, retryable: false },
    RECOVERY_CODE_INVALID: { httpStatus: 400, retryable: false },
    TOSS_KEY_INVALID: { httpStatus: 401, retryable: false },
    ORIGIN_NOT_ALLOWED: { httpStatus: 403, retryable: false },
    PROFILE_REQUIRED: { httpStatus: 401, retryable: false },
    RATE_LIMITED: { httpStatus: 429, retryable: true },
    SERVICE_UNAVAILABLE: { httpStatus: 503, retryable: true },
    CAREER_OWNER_MISMATCH: { httpStatus: 409, retryable: false },
    FORBIDDEN: { httpStatus: 403, retryable: false },
  };

  it('9개 모두 있다', () => {
    expect(ERROR_CODES.length).toBe(9);
  });

  it.each(ERROR_CODES)(
    '%s가 HTTP_STATUS_BY_CODE·RETRYABLE_BY_CODE와 표에 모두 있고 값이 같다',
    (code) => {
      expect(ErrorCodeSchema.safeParse(code).success).toBe(true);
      expect(HTTP_STATUS_BY_CODE[code]).toBe(TABLE[code].httpStatus);
      expect(RETRYABLE_BY_CODE[code]).toBe(TABLE[code].retryable);
    },
  );
});

describe('ClientIdSchema', () => {
  it('cmd_... 형식을 허용한다', () => {
    expect(ClientIdSchema.safeParse('cmd_1234567890').success).toBe(true);
  });

  it('UUID 형식도 허용한다', () => {
    expect(ClientIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('65자는 실패한다', () => {
    expect(ClientIdSchema.safeParse('a'.repeat(65)).success).toBe(false);
  });

  it('공백이 포함되면 실패한다', () => {
    expect(ClientIdSchema.safeParse('cmd 1234').success).toBe(false);
  });
});

describe('ProfileSettingsSchema', () => {
  it('textScale: 110은 실패한다', () => {
    const result = ProfileSettingsSchema.safeParse({
      reducedMotion: 'SYSTEM',
      textScale: 110,
      theme: 'SYSTEM',
      defaultSimulationMode: 'FAST',
    });
    expect(result.success).toBe(false);
  });

  it('유효한 설정은 성공한다', () => {
    const result = ProfileSettingsSchema.safeParse({
      reducedMotion: 'ON',
      textScale: 125,
      theme: 'DARK',
      defaultSimulationMode: 'CHAPTER',
    });
    expect(result.success).toBe(true);
  });
});

describe('envelope', () => {
  it('성공·오류 봉투 양쪽을 받아들인다', () => {
    const schema = envelope(HealthDataSchema);
    expect(schema.safeParse({ data: { ok: true }, meta: { requestId: 'req_1' } }).success).toBe(
      true,
    );
    expect(
      schema.safeParse({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'x', retryable: true },
        meta: { requestId: 'req_1' },
      }).success,
    ).toBe(true);
  });

  it('meta.requestId 없으면 실패한다', () => {
    const schema = envelope(HealthDataSchema);
    expect(schema.safeParse({ data: { ok: true }, meta: {} }).success).toBe(false);
  });
});
