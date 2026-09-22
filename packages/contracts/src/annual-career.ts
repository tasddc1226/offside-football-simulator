import { z } from 'zod';
import { PlayerDraftSchema } from './player.js';
import { CareerSnapshotSchema } from './snapshot.js';
import { SeasonSummarySchema } from './career-state.js';

export const AnnualPolicySchema = z.strictObject({
  training: z.strictObject({
    drill: z.enum(['CONTROL', 'ENGINE', 'VISION']),
    load: z.enum(['RECOVERY', 'BALANCED', 'PUSH']),
    partner: z.enum(['COACH', 'CAPTAIN', 'RIVAL']),
  }),
  routineChoice: z.enum(['CAUTIOUS', 'BALANCED']),
});
export const CreateServerCareerSchema = z.strictObject({
  expectedProfileId: z.string().min(1),
  draft: PlayerDraftSchema,
  simulationMode: z.enum(['FAST', 'CHAPTER']).optional(),
});
export const StartAnnualRunSchema = z.strictObject({
  expectedCareerRevision: z.number().int().nonnegative(),
  policy: AnnualPolicySchema.optional(),
});
export const AdvanceAnnualRunSchema = z.strictObject({
  expectedJobRevision: z.number().int().nonnegative(),
});
export const ChooseAnnualDecisionSchema = AdvanceAnnualRunSchema.extend({
  decisionKey: z.string().min(1).max(512),
  choiceId: z.string().min(1).max(256),
});
export const AnnualDecisionViewSchema = z.strictObject({
  key: z.string(),
  revision: z.number().int(),
  kind: z.string(),
  title: z.string(),
  choices: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      risk: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
      detail: z.string().optional(),
    }),
  ),
});
const StorySchema = z.strictObject({
  id: z.string(),
  family: z.enum(['OPPORTUNITY', 'ROLE_TENSION', 'SCOUT_INTEREST']),
  actor: z.strictObject({ id: z.string(), name: z.string(), teamId: z.string() }),
  sourceRevision: z.number().int(),
  sourceSeason: z.number().int(),
  sourceStep: z.number().int(),
  sourceMinutes: z.number().int(),
  stage: z.enum(['OPEN', 'FOLLOW_UP', 'CLOSED', 'CANCELLED']),
  dueCareerStep: z.number().int(),
  choiceId: z.string().nullable(),
  outcome: z.enum(['SUCCESS', 'NEUTRAL', 'FAIL', 'FIXED']).nullable(),
  resolvedRevision: z.number().int().nullable(),
});
export const AnnualReportSchema = z.strictObject({
  targetSeasonIndex: z.number().int(),
  startAge: z.number().int(),
  endAge: z.number().int(),
  startRevision: z.number().int(),
  endRevision: z.number().int(),
  startedMidSeason: z.boolean(),
  retired: z.boolean(),
  minutes: z.number().int(),
  baseOvr: z.strictObject({ before: z.number(), after: z.number(), delta: z.number() }),
  attributes: z.array(
    z.strictObject({
      key: z.string(),
      before: z.number(),
      after: z.number(),
      delta: z.number(),
      settlementDelta: z.number(),
      duringYearDelta: z.number(),
    }),
  ),
  season: SeasonSummarySchema.nullable(),
  stories: z.array(StorySchema),
  events: z.array(
    z.strictObject({
      eventId: z.string(),
      choiceId: z.string(),
      outcomeId: z.string(),
      revision: z.number().int(),
      step: z.number().int(),
    }),
  ),
});
export const AnnualRunViewSchema = z.strictObject({
  id: z.string(),
  careerId: z.string(),
  revision: z.number().int(),
  careerRevision: z.number().int(),
  status: z.enum(['RUNNING', 'WAITING_DECISION', 'COMPLETED']),
  targetSeasonIndex: z.number().int(),
  completedCommands: z.number().int(),
  currentStep: z.number().int(),
  policy: AnnualPolicySchema,
  decision: AnnualDecisionViewSchema.nullable(),
  report: AnnualReportSchema.nullable(),
});
export const AnnualRunResponseSchema = z.strictObject({
  run: AnnualRunViewSchema,
  snapshot: CareerSnapshotSchema.optional(),
});
export type AnnualRunView = z.infer<typeof AnnualRunViewSchema>;
export type AnnualRunResponse = z.infer<typeof AnnualRunResponseSchema>;
export type AnnualDecisionView = z.infer<typeof AnnualDecisionViewSchema>;
export type AnnualReportView = z.infer<typeof AnnualReportSchema>;
