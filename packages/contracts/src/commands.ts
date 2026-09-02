import { z } from 'zod';
import { successEnvelope } from './envelope.js';
import { ClientIdSchema, Hex64Schema, IsoUtcSchema } from './primitives.js';
import { CareerSnapshotSchema } from './snapshot.js';

/**
 * 07 "로컬 명령 계약"의 12개 명령. domain Command의 이름과 같게 유지한다(T-0-014가 domain의
 * ADVANCE_STEP을 ADVANCE로 정렬).
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

export const CommandRequestSchema = z.strictObject({
  commandId: ClientIdSchema,
  expectedRevision: z.number().int().nonnegative(),
  type: CommandTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});

export type CommandRequest = z.infer<typeof CommandRequestSchema>;

/** 02 `CommandLogEntry`. `commandId`·`careerId`는 클라이언트가 발급한 ID이며 UUID 형식을 강제하지 않는다. */
export const CommandLogEntrySchema = z.strictObject({
  careerId: ClientIdSchema,
  revision: z.number().int().positive(),
  commandId: ClientIdSchema,
  commandType: CommandTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  resultHash: Hex64Schema,
  createdAt: IsoUtcSchema,
});

export type CommandLogEntry = z.infer<typeof CommandLogEntrySchema>;

export const NextActionSchema = z.enum(['DECISION', 'ADVANCE', 'SETTLEMENT']);
export type NextAction = z.infer<typeof NextActionSchema>;

export const CommandResponseSchema = successEnvelope(
  z.strictObject({
    snapshot: CareerSnapshotSchema,
    nextAction: NextActionSchema,
    roll: z.number().int().optional(),
    outcomeId: z.string().optional(),
  }),
);

export type CommandResponse = z.infer<typeof CommandResponseSchema>;
