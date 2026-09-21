import { z } from 'zod';
import { SemverSchema } from './versions.js';

const DayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ScoreSchema = z.number().int().nonnegative().max(1000);

export const CompetitionChoiceSchema = z.strictObject({
  id: z.string().regex(/^[A-Z0-9_-]{1,32}$/),
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  points: z.number().int().nonnegative().max(100),
  outcome: z.string().min(1).max(240),
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
export const CompetitionEntrySchema = z.strictObject({
  challengeId: z.string().min(1).max(128),
  dayKey: DayKeySchema,
  weekKey: DayKeySchema,
  actionIds: z
    .array(z.string().regex(/^[A-Z0-9_-]{1,32}$/))
    .min(3)
    .max(5),
  score: ScoreSchema,
  maxScore: ScoreSchema,
  verificationStatus: z.literal('VERIFIED'),
  resultHash: z.string().regex(/^[a-f0-9]{64}$/),
  publicOptIn: z.boolean(),
  submittedAt: z.string(),
  proof: z.strictObject({
    method: z.literal('SERVER_REPLAY'),
    rulesetVersion: SemverSchema,
    contentPackVersion: SemverSchema,
    scoringPolicyVersion: z.string().min(1).max(32),
  }),
});
export const CompetitionDailyResponseSchema = z.strictObject({
  challenge: CompetitionChallengeSchema,
  entry: CompetitionEntrySchema.nullable(),
});
export const SubmitCompetitionEntrySchema = z.strictObject({
  actionIds: z
    .array(z.string().regex(/^[A-Z0-9_-]{1,32}$/))
    .min(3)
    .max(5),
  publicOptIn: z.boolean(),
});
export const CompetitionWeeklyRowSchema = z.strictObject({
  rank: z.number().int().positive(),
  alias: z.string().min(1).max(32),
  score: ScoreSchema,
  maxScore: ScoreSchema,
  challengeDays: z.number().int().positive(),
  proof: z.strictObject({
    method: z.literal('SERVER_REPLAY'),
    rulesetVersion: SemverSchema,
    contentPackVersion: SemverSchema,
    scoringPolicyVersion: z.string().min(1).max(32),
  }),
});
export const CompetitionWeeklyResponseSchema = z.strictObject({
  weekKey: DayKeySchema,
  rows: z.array(CompetitionWeeklyRowSchema).max(100),
});
export const CompetitionVisibilitySchema = z.strictObject({ publicOptIn: z.boolean() });

export type CompetitionChoice = z.infer<typeof CompetitionChoiceSchema>;
export type CompetitionScenario = z.infer<typeof CompetitionScenarioSchema>;
export type CompetitionChallenge = z.infer<typeof CompetitionChallengeSchema>;
export type CompetitionEntry = z.infer<typeof CompetitionEntrySchema>;
export type CompetitionDailyResponse = z.infer<typeof CompetitionDailyResponseSchema>;
export type SubmitCompetitionEntry = z.infer<typeof SubmitCompetitionEntrySchema>;
export type CompetitionWeeklyResponse = z.infer<typeof CompetitionWeeklyResponseSchema>;
