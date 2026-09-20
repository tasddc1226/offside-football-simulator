import { z } from 'zod';
import { IsoUtcSchema } from './primitives.js';

export const TEAM_FORMATIONS = {
  '4-3-3': ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CM', 'RCM', 'LW', 'ST', 'RW'],
  '4-4-2': ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LM', 'LCM', 'RCM', 'RM', 'LST', 'RST'],
  '3-5-2': ['GK', 'LCB', 'CB', 'RCB', 'LWB', 'LCM', 'DM', 'RCM', 'RWB', 'LST', 'RST'],
} as const;
export const FormationSchema = z.enum(['4-3-3', '4-4-2', '3-5-2']);
export type TeamFormation = z.infer<typeof FormationSchema>;
export const LineupSchema = z
  .array(z.string().min(1).max(100).nullable())
  .length(18)
  .refine(
    (slots) =>
      new Set(slots.filter((id) => id !== null)).size === slots.filter((id) => id !== null).length,
    '한 선수는 한 자리만 맡을 수 있습니다.',
  );
export const TeamInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(30),
  formation: FormationSchema,
  lineup: LineupSchema,
});
export const SaveTeamSchema = TeamInputSchema.extend({ revision: z.number().int().nonnegative() });
export const LockerTeamSchema = TeamInputSchema.extend({
  id: z.string(),
  revision: z.number().int().positive(),
  updatedAt: IsoUtcSchema,
});
export type LockerTeam = z.infer<typeof LockerTeamSchema>;
export type TeamInput = z.infer<typeof TeamInputSchema>;
export const LockerPlayerSchema = z.strictObject({
  careerId: z.string(),
  name: z.string(),
  position: z.enum(['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST']),
  ovr: z.number().int().min(1).max(99),
  age: z.number().int().nonnegative(),
  status: z.enum(['ACTIVE', 'RETIRED', 'ARCHIVED']),
  seasons: z.number().int().nonnegative(),
  isTest: z.boolean(),
});
export type LockerPlayer = z.infer<typeof LockerPlayerSchema>;
export const LockerRoomSchema = z.strictObject({
  profileId: z.string(),
  players: z.array(LockerPlayerSchema),
  teams: z.array(LockerTeamSchema),
});
export type LockerRoom = z.infer<typeof LockerRoomSchema>;
