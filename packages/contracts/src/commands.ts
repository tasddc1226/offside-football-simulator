import { z } from 'zod';
import { successEnvelope } from './envelope.js';
import { Hex64Schema, IsoUtcSchema } from './primitives.js';
import { CareerSnapshotSchema } from './snapshot.js';

/**
 * 07 "로컬 명령 계약"의 12개 명령. domain의 Phase 0 명령 이름(`ADVANCE_STEP`)과 여기 `ADVANCE`가
 * 다르다. 계약은 07을 따르고, 매핑은 engine-client가 한다.
 */
export const COMMAND_TYPES = [
  'CREATE_CAREER',
  'UPDATE_PLAYER_DRAFT',
  'CONFIRM_PLAYER',
  'RESOLVE_EVENT',
  'START_SEASON',
  'ADVANCE',
  'SETTLE_SEASON',
  'NEGOTIATE',
  'ACCEPT_OFFER',
  'REJECT_OFFER',
  'LOAN_RETURN',
  'RETIRE',
] as const;

export const CommandTypeSchema = z.enum(COMMAND_TYPES);
export type CommandType = z.infer<typeof CommandTypeSchema>;

export const CommandRequestSchema = z
  .object({
    commandId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    type: CommandTypeSchema,
    payload: z.record(z.unknown()),
  })
  .strict();

export type CommandRequest = z.infer<typeof CommandRequestSchema>;

/** 02 `CommandLogEntry`. `commandId`는 클라이언트가 발급한 문자열 ID이며 UUID 형식을 강제하지 않는다. */
export const CommandLogEntrySchema = z
  .object({
    careerId: z.string().min(1),
    revision: z.number().int().positive(),
    commandId: z.string().min(1),
    commandType: CommandTypeSchema,
    payload: z.record(z.unknown()),
    resultHash: Hex64Schema,
    createdAt: IsoUtcSchema,
  })
  .strict();

export type CommandLogEntry = z.infer<typeof CommandLogEntrySchema>;

export const NextActionSchema = z.enum(['DECISION', 'ADVANCE', 'SETTLEMENT']);
export type NextAction = z.infer<typeof NextActionSchema>;

export const CommandResponseSchema = successEnvelope(
  z
    .object({
      snapshot: CareerSnapshotSchema,
      nextAction: NextActionSchema,
      roll: z.number().int().optional(),
      outcomeId: z.string().optional(),
    })
    .strict(),
);

export type CommandResponse = z.infer<typeof CommandResponseSchema>;
