import { z } from 'zod';
import type { FriendlyInput, FriendlyResult } from '@offside/domain';
import { FormationSchema } from './locker-room.js';
import { IsoUtcSchema } from './primitives.js';

const PositionSchema = z.enum(['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST']);
const AttributeSchema = z.number().int().min(1).max(99);
const AttributesSchema = z.strictObject({
  shooting: AttributeSchema,
  passing: AttributeSchema,
  dribbling: AttributeSchema,
  tackling: AttributeSchema,
  firstTouch: AttributeSchema,
  crossing: AttributeSchema,
  goalkeeping: AttributeSchema,
  pace: AttributeSchema,
  acceleration: AttributeSchema,
  agility: AttributeSchema,
  jumping: AttributeSchema,
  stamina: AttributeSchema,
  strength: AttributeSchema,
  durability: AttributeSchema,
  decisions: AttributeSchema,
  concentration: AttributeSchema,
  composure: AttributeSchema,
  positioning: AttributeSchema,
  leadership: AttributeSchema,
  consistency: AttributeSchema,
});
export const FriendlyTacticSchema = z.enum(['BALANCED', 'PRESS', 'COUNTER']);
export const StartFriendlySchema = z.strictObject({
  revision: z.number().int().positive(),
  tactic: FriendlyTacticSchema,
});
const PlayerSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  position: PositionSchema,
  attributes: AttributesSchema,
  archiveHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const FriendlyInputSchema: z.ZodType<FriendlyInput> = z.strictObject({
  version: z.literal('FRIENDLY_V1'),
  seed: z.string().min(1),
  formation: FormationSchema,
  tactic: FriendlyTacticSchema,
  lineup: z.array(PlayerSchema.nullable()).length(18),
});
const AppearanceSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  position: PositionSchema,
  slot: z.number().int().min(0).max(10),
  basic: z.boolean(),
  fromMinute: z.number().int().min(0).max(90),
  toMinute: z.number().int().min(0).max(90),
  fitPercent: z.number().int().min(0).max(100),
  goals: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
});
export const FriendlyResultSchema: z.ZodType<FriendlyResult> = z.strictObject({
  version: z.literal('FRIENDLY_V1'),
  homeGoals: z.number().int().nonnegative(),
  awayGoals: z.number().int().nonnegative(),
  home: z.array(AppearanceSchema),
  away: z.array(AppearanceSchema),
  strengths: z.array(
    z.strictObject({
      half: z.number().int(),
      homeAttack: z.number().int(),
      homeControl: z.number().int(),
      homeDefence: z.number().int(),
    }),
  ),
  moments: z.array(
    z.strictObject({
      minute: z.number().int().min(1).max(90),
      side: z.enum(['HOME', 'AWAY']),
      shooterId: z.string(),
      providerId: z.string(),
      keeperId: z.string(),
      outcome: z.enum(['GOAL', 'SAVE', 'WIDE']),
      goalChancePercent: z.number().int().min(0).max(100),
    }),
  ),
});
export const FriendlyReceiptSchema = z.strictObject({
  id: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  teamRevision: z.number().int().positive(),
  createdAt: IsoUtcSchema,
  input: FriendlyInputSchema,
  result: FriendlyResultSchema,
});
export type FriendlyReceipt = z.infer<typeof FriendlyReceiptSchema>;
export const FriendlyHistorySchema = z.strictObject({ matches: z.array(FriendlyReceiptSchema) });
