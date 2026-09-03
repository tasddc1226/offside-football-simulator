import type { CheckpointType, RngState } from '@offside/domain';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { CareerSummarySchema, PutCareerBodySchema } from './careers.js';
import { COMMAND_TYPES, CommandTypeSchema } from './commands.js';
import { envelope, ErrorEnvelopeSchema, successEnvelope } from './envelope.js';
import { ERROR_CODES, ErrorCodeSchema, HTTP_STATUS_BY_CODE, RETRYABLE_BY_CODE, type ErrorCode } from './errors.js';
import { HealthDataSchema } from './health.js';
import { CONTRACTS_VERSION } from './index.js';
import { ClientIdSchema } from './primitives.js';
import { ProfileSettingsSchema } from './profile.js';
import { CheckpointTypeSchema, RngStateSchema } from './snapshot.js';

describe('CONTRACTS_VERSION', () => {
  it('is exported', () => {
    expect(CONTRACTS_VERSION).toBe('0.2.0');
  });
});

describe('07 문서 JSON 예시가 그대로 파싱된다', () => {
  it('성공 응답 봉투', () => {
    const json = `
      {
        "data": {},
        "meta": {
          "requestId": "req_...",
          "careerRevision": 12,
          "rulesetVersion": "1.0.0"
        }
      }
    `;
    const result = successEnvelope(z.looseObject({})).safeParse(JSON.parse(json));
    expect(result.success).toBe(true);
  });

  it('오류 응답 봉투', () => {
    const json = `
      {
        "error": {
          "code": "CAREER_REVISION_CONFLICT",
          "message": "다른 기기에서 커리어가 먼저 진행되었습니다.",
          "retryable": false,
          "details": { "serverRevision": 13, "serverSnapshotUrl": "/v1/careers/car_1" }
        },
        "meta": { "requestId": "req_..." }
      }
    `;
    const result = ErrorEnvelopeSchema.safeParse(JSON.parse(json));
    expect(result.success).toBe(true);
  });

  it('PUT /careers/{id} 본문', () => {
    // 07 문서 예시 그대로. "state"·"stateHash"·"resultHash"의 "..."는 형식 검사를 통과하는 값으로 바꿨다.
    // 07의 snapshot 예시는 "revision"·"checkpoint"·"state"·"stateHash"만 보여주는 축약본이라, 05
    // Snapshot 계약이 요구하는 rulesetVersion·contentPackVersion·rngState를 추가했다(PR 본문 "범위 밖
    // 발견 사항" 참고). snapshot.revision도 07 원문은 15였지만, PutCareerBodySchema는 이제
    // snapshot.revision이 마지막 command(revision 13)와 같아야 하므로 13으로 맞췄다. "payload": {}도
    // 07 원문은 자리표시자였지만, T-1-006이 CommandLogEntrySchema에 commandType·payload 정합 검사를
    // 추가해 RESOLVE_EVENT에 맞는 최소 payload로 바꿨다.
    const json = `
      {
        "baseRevision": 12,
        "snapshot": {
          "revision": 13,
          "checkpoint": "STEP_BOUNDARY",
          "state": "{\\"schemaVersion\\":1}",
          "stateHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "rulesetVersion": "1.0.0",
          "contentPackVersion": "0.1.0",
          "rngState": { "s": [1, 2, 3, 4], "draws": 0 }
        },
        "commands": [
          {
            "revision": 13,
            "commandId": "cmd_...",
            "commandType": "RESOLVE_EVENT",
            "payload": {
              "eventId": "EVT-CON-002",
              "definitionVersion": 1,
              "choiceId": "a",
              "outcomes": [{ "id": "o1", "weight": 1, "effects": [] }]
            },
            "resultHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
          }
        ],
        "createdServiceSeasonId": "svc_kickoff",
        "rulesetVersion": "1.0.0",
        "contentPackVersion": "0.1.0"
      }
    `;
    const result = PutCareerBodySchema.safeParse(JSON.parse(json));
    expect(result.success).toBe(true);
  });
});

describe('오류 코드 표', () => {
  // 07 "오류 코드" 표를 다시 적는다.
  const TABLE: Record<ErrorCode, { httpStatus: number; retryable: boolean }> = {
    VALIDATION_FAILED: { httpStatus: 400, retryable: false },
    RECOVERY_CODE_INVALID: { httpStatus: 400, retryable: false },
    TOSS_KEY_INVALID: { httpStatus: 401, retryable: false },
    ORIGIN_NOT_ALLOWED: { httpStatus: 403, retryable: false },
    PROFILE_REQUIRED: { httpStatus: 401, retryable: false },
    CAREER_NOT_OWNED: { httpStatus: 403, retryable: false },
    CAREER_NOT_FOUND: { httpStatus: 404, retryable: false },
    CAREER_REVISION_CONFLICT: { httpStatus: 409, retryable: false },
    COMMAND_ALREADY_RESOLVED: { httpStatus: 409, retryable: false },
    RECOVERY_CONFLICT: { httpStatus: 409, retryable: false },
    MERGE_REQUIRED: { httpStatus: 409, retryable: false },
    CAREER_ARCHIVED: { httpStatus: 409, retryable: false },
    VERSION_MISMATCH: { httpStatus: 422, retryable: false },
    VERIFICATION_FAILED: { httpStatus: 422, retryable: false },
    RATE_LIMITED: { httpStatus: 429, retryable: true },
    SERVICE_UNAVAILABLE: { httpStatus: 503, retryable: true },
  };

  it('16개 모두 있다', () => {
    expect(ERROR_CODES.length).toBe(16);
  });

  it.each(ERROR_CODES)('%s가 HTTP_STATUS_BY_CODE·RETRYABLE_BY_CODE와 표에 모두 있고 값이 같다', (code) => {
    expect(ErrorCodeSchema.safeParse(code).success).toBe(true);
    expect(HTTP_STATUS_BY_CODE[code]).toBe(TABLE[code].httpStatus);
    expect(RETRYABLE_BY_CODE[code]).toBe(TABLE[code].retryable);
  });
});

describe('CommandTypeSchema', () => {
  it('14개다', () => {
    expect(COMMAND_TYPES.length).toBe(14);
  });

  it.each(COMMAND_TYPES)('%s를 허용한다', (type) => {
    expect(CommandTypeSchema.safeParse(type).success).toBe(true);
  });
});

describe('CheckpointTypeSchema·RngStateSchema는 domain 타입과 동일하다', () => {
  it('CheckpointType', () => {
    expectTypeOf<z.infer<typeof CheckpointTypeSchema>>().toEqualTypeOf<CheckpointType>();
  });

  it('RngState', () => {
    expectTypeOf<z.infer<typeof RngStateSchema>>().toEqualTypeOf<RngState>();
  });
});

describe('PutCareerBodySchema', () => {
  const baseSnapshotFields = {
    checkpoint: 'STEP_BOUNDARY' as const,
    state: '{}',
    stateHash: 'a'.repeat(64),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    rngState: { s: [1, 2, 3, 4] as const, draws: 0 },
  };

  const baseBody = {
    baseRevision: 12,
    createdServiceSeasonId: 'svc_kickoff',
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  };

  it('commands revision이 baseRevision + 1부터 연속이 아니면 실패한다', () => {
    const result = PutCareerBodySchema.safeParse({
      ...baseBody,
      snapshot: { ...baseSnapshotFields, revision: 14 },
      commands: [
        {
          revision: 14, // baseRevision(12) + 1 = 13이어야 한다.
          commandId: 'cmd_1',
          commandType: 'RESOLVE_EVENT',
          payload: {},
          resultHash: 'b'.repeat(64),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('commands가 있으면 snapshot.revision이 마지막 command의 revision과 같아야 성공한다', () => {
    const result = PutCareerBodySchema.safeParse({
      ...baseBody,
      snapshot: { ...baseSnapshotFields, revision: 14 },
      commands: [
        {
          revision: 13,
          commandId: 'cmd_1',
          commandType: 'RESOLVE_EVENT',
          payload: { eventId: 'EVT-CON-002', definitionVersion: 1, choiceId: 'a', outcomes: [{ id: 'o1', weight: 1, effects: [] }] },
          resultHash: 'b'.repeat(64),
        },
        {
          revision: 14,
          commandId: 'cmd_2',
          commandType: 'ADVANCE',
          payload: { eligibleEvents: [] },
          resultHash: 'c'.repeat(64),
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('commands가 비어 있으면 snapshot.revision이 baseRevision과 같아야 성공한다', () => {
    const result = PutCareerBodySchema.safeParse({
      ...baseBody,
      snapshot: { ...baseSnapshotFields, revision: 12 },
      commands: [],
    });
    expect(result.success).toBe(true);
  });

  it('snapshot.revision이 마지막 command의 revision과 다르면 실패한다', () => {
    const result = PutCareerBodySchema.safeParse({
      ...baseBody,
      snapshot: { ...baseSnapshotFields, revision: 99 },
      commands: [
        {
          revision: 13,
          commandId: 'cmd_1',
          commandType: 'RESOLVE_EVENT',
          payload: {},
          resultHash: 'b'.repeat(64),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('stateHash가 63자리면 실패한다', () => {
    const result = PutCareerBodySchema.safeParse({
      ...baseBody,
      snapshot: { ...baseSnapshotFields, revision: 12, stateHash: 'a'.repeat(63) },
      commands: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('ClientIdSchema', () => {
  it('07 예시의 cmd_... 형식을 허용한다', () => {
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
    expect(schema.safeParse({ data: { ok: true }, meta: { requestId: 'req_1' } }).success).toBe(true);
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

describe('CareerSummarySchema', () => {
  it('API-CAR-001 필드를 받아들인다', () => {
    const result = CareerSummarySchema.safeParse({
      id: 'car_1',
      status: 'ACTIVE',
      revision: 3,
      lastSyncedAt: '2026-09-02T00:00:00Z',
      createdServiceSeasonId: 'svc_kickoff',
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });
    expect(result.success).toBe(true);
  });
});
