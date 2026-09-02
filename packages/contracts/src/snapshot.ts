import { z } from 'zod';
import { REQUEST_BODY_MAX_BYTES } from './headers.js';
import { Hex64Schema, IsoUtcSchema, Uint32Schema } from './primitives.js';
import { SemverSchema } from './versions.js';

/** domain `CheckpointType`과 같은 9개(값·순서 동일). 타입 동일성은 index.test.ts에서 expectTypeOf로 검사한다. */
export const CHECKPOINT_TYPES = [
  'CAREER_CREATED',
  'SEASON_START',
  'STEP_BOUNDARY',
  'EVENT_OFFERED',
  'EVENT_RESOLVED',
  'CHAPTER_DECISION',
  'SEASON_SETTLED',
  'CONTRACT_CONFIRMED',
  'RETIREMENT',
] as const;

export const CheckpointTypeSchema = z.enum(CHECKPOINT_TYPES);
export type CheckpointType = z.infer<typeof CheckpointTypeSchema>;

/**
 * domain `RngState`는 `{ readonly s: readonly [n,n,n,n]; readonly draws: n }`다. `.readonly()`로
 * 감싸지 않으면 튜플·객체가 mutable로 추론되어 expectTypeOf().toEqualTypeOf()가 실패한다.
 */
export const RngStateSchema = z
  .object({
    s: z.tuple([Uint32Schema, Uint32Schema, Uint32Schema, Uint32Schema]).readonly(),
    draws: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();

export type RngState = z.infer<typeof RngStateSchema>;

/** 07 "공통 규칙"의 요청 본문 상한과 같다. */
export const SNAPSHOT_STATE_MAX_BYTES = REQUEST_BODY_MAX_BYTES;

/** 05 "Snapshot 계약". */
export const CareerSnapshotSchema = z
  .object({
    id: z.string().min(1),
    careerId: z.string().min(1),
    revision: z.number().int().positive(),
    checkpoint: CheckpointTypeSchema,
    state: z.string().max(SNAPSHOT_STATE_MAX_BYTES),
    stateHash: Hex64Schema,
    rulesetVersion: SemverSchema,
    contentPackVersion: SemverSchema,
    rngState: RngStateSchema,
    createdAt: IsoUtcSchema,
  })
  .strict();

export type CareerSnapshot = z.infer<typeof CareerSnapshotSchema>;

/**
 * `decodeSnapshotState`(JSON.parse 후 domain `hashState`로 stateHash·rngState를 검증)는 여기 두지
 * 않는다. contracts → domain은 타입만 허용하므로(ADR-005) 런타임 해시 검증은 engine-client(T-0-007)와
 * api(T-0-008) 몫이다. 여기서는 파싱된 state의 최상위 형태만 검사한다: `schemaVersion: 1`이고
 * `careerId`가 있고, Snapshot 래퍼 필드인 `revision`이 섞여 들어오지 않았는지만 본다.
 */
export const SnapshotStateEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    careerId: z.string().min(1),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if ('revision' in value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'state에는 revision이 없다. revision은 CareerSnapshot 래퍼 필드다.',
        path: ['revision'],
      });
    }
  });

export type SnapshotStateEnvelope = z.infer<typeof SnapshotStateEnvelopeSchema>;
