import { z } from 'zod';

import { DYNAMIC_CLUB_ID, DYNAMIC_LEAGUES } from './club-strength-spec.js';
export { DYNAMIC_LEAGUES, CLUB_LEAGUE_AVG } from './club-strength-spec.js';
export const ClubStrengthLeagueSchema = z.enum(DYNAMIC_LEAGUES);
const values = z.record(z.string().regex(DYNAMIC_CLUB_ID), z.number().int().min(1).max(99));
export const ClubStrengthSnapshotSchema = z.object({
  v: z.number().int().min(1),
  asOf: z.iso.date(),
  source: z.string().max(100),
  values,
});
export type ClubStrengthSnapshot = z.infer<typeof ClubStrengthSnapshotSchema>;
export const StrengthChangeSchema = z.object({
  id: z.string(),
  before: z.number(),
  after: z.number(),
});
export const StrengthLeagueRunSchema = z.object({
  league: ClubStrengthLeagueSchema,
  status: z.enum(['changed', 'unchanged', 'failed', 'unconfigured']),
  reason: z.string().max(300),
  season: z.string().nullable(),
  changes: z.array(StrengthChangeSchema).max(40),
});
export type StrengthLeagueRun = z.infer<typeof StrengthLeagueRunSchema>;
export const StrengthRunSchema = z.object({
  day: z.iso.date(),
  at: z.iso.datetime(),
  version: z.number().int(),
  leagues: z.array(StrengthLeagueRunSchema).max(DYNAMIC_LEAGUES.length),
});
export type StrengthRun = z.infer<typeof StrengthRunSchema>;
export const StrengthHistorySchema = z.object({
  current: ClubStrengthSnapshotSchema,
  runs: z.array(StrengthRunSchema).max(31),
  nextBefore: z.iso.date().nullable(),
});
export type StrengthHistory = z.infer<typeof StrengthHistorySchema>;

export const StrengthHistoryBeforeSchema = z.iso.date().optional();
