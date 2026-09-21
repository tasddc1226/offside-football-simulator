import { z } from 'zod';
import { PositionSchema } from './player.js';
import { SemverSchema } from './versions.js';

const DayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ScoreSchema = z.number().int().nonnegative().max(1000);
const ActionIdSchema = z.string().regex(/^[A-Z0-9_-]{1,32}$/);

export const CompetitionChoiceSchema = z.strictObject({
  id: ActionIdSchema,
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
});
export const CompetitionStepSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  title: z.string().min(1).max(80),
  prompt: z.string().min(1).max(240),
  choices: z.array(CompetitionChoiceSchema).min(3).max(5),
});
export const CompetitionScenarioSchema = z.strictObject({
  title: z.string().min(1).max(100),
  intro: z.string().min(1).max(400),
  position: PositionSchema,
  opponentName: z.string().min(1).max(100),
  steps: z.array(CompetitionStepSchema).min(3).max(5),
  scorePolicy: z.strictObject({
    version: z.string().min(1).max(32),
    description: z.string().min(1).max(240),
  }),
});
export const CompetitionChallengeSchema = z.strictObject({
  id: z.string().min(1).max(128),
  dayKey: DayKeySchema,
  weekKey: DayKeySchema,
  startsAt: z.string(),
  endsAt: z.string(),
  rulesetVersion: SemverSchema,
  contentPackVersion: SemverSchema,
  scoringPolicyVersion: z.string().min(1).max(32),
  scenario: CompetitionScenarioSchema,
});
export const CompetitionProofSchema = z.strictObject({
  method: z.literal('SERVER_MATCH'),
  rulesetVersion: SemverSchema,
  contentPackVersion: SemverSchema,
  scoringPolicyVersion: z.string().min(1).max(32),
});
export const CompetitionEntrySchema = z.strictObject({
  challengeId: z.string().min(1).max(128),
  dayKey: DayKeySchema,
  weekKey: DayKeySchema,
  actionIds: z.array(ActionIdSchema).max(5),
  revision: z.number().int().nonnegative(),
  completed: z.boolean(),
  score: ScoreSchema.nullable(),
  maxScore: ScoreSchema.nullable(),
  verificationStatus: z.enum(['IN_PROGRESS', 'VERIFIED']),
  resultHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  publicOptIn: z.boolean(),
  submittedAt: z.string().nullable(),
  evidence: z.strictObject({
    appearance: z.enum(['START', 'SUB', 'OUT']),
    minutes: z.number().int().nonnegative().max(90),
    ratingTenths: z.number().int().nullable(),
    outcome: z.enum(['WIN', 'DRAW', 'LOSS']),
    scoreline: z.strictObject({ goalsFor: z.number().int().nonnegative(), goalsAgainst: z.number().int().nonnegative() }),
    positionContribution: z.number().int().nonnegative(),
    statLines: z.array(z.strictObject({ label: z.string().min(1).max(60), value: z.string().min(1).max(60) })).max(8),
    positionStats: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  }).nullable(),
  proof: CompetitionProofSchema,
});
export const CompetitionDailyResponseSchema = z.strictObject({
  challenge: CompetitionChallengeSchema,
  entry: CompetitionEntrySchema.nullable(),
});
export const SubmitCompetitionActionSchema = z.strictObject({
  actionId: ActionIdSchema,
  expectedRevision: z.number().int().nonnegative(),
});
export const CompetitionActionResponseSchema = z.strictObject({
  entry: CompetitionEntrySchema,
  nextStepIndex: z.number().int().nonnegative().max(5),
});
export const CompetitionWeeklyRowSchema = z.strictObject({
  rank: z.number().int().positive(),
  alias: z.string().min(1).max(32),
  score: ScoreSchema,
  maxScore: ScoreSchema,
  challengeDays: z.number().int().positive(),
  proof: CompetitionProofSchema,
});
export const CompetitionWeeklyResponseSchema = z.strictObject({
  weekKey: DayKeySchema,
  rows: z.array(CompetitionWeeklyRowSchema).max(100),
});
export const CompetitionHistoryResponseSchema = z.strictObject({
  entries: z.array(CompetitionEntrySchema).max(366),
});
export const CompetitionVisibilitySchema = z.strictObject({ publicOptIn: z.boolean() });

export type CompetitionChoice = z.infer<typeof CompetitionChoiceSchema>;
export type CompetitionScenario = z.infer<typeof CompetitionScenarioSchema>;
export type CompetitionChallenge = z.infer<typeof CompetitionChallengeSchema>;
export type CompetitionEntry = z.infer<typeof CompetitionEntrySchema>;
export type CompetitionDailyResponse = z.infer<typeof CompetitionDailyResponseSchema>;
export type SubmitCompetitionAction = z.infer<typeof SubmitCompetitionActionSchema>;
export type CompetitionWeeklyResponse = z.infer<typeof CompetitionWeeklyResponseSchema>;
export type CompetitionHistoryResponse = z.infer<typeof CompetitionHistoryResponseSchema>;
export type CompetitionPosition = z.infer<typeof PositionSchema>;
