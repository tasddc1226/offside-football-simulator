import { z } from 'zod';
import type { CareerPhase } from '@offside/domain';
import { CAREER_PHASES, ConditionSchema } from './condition.ts';
import { EffectSchema } from './effect.ts';
import { findNarrativeTokenIssues } from './narrative.ts';

export const EVENT_ID_PATTERN = /^EVT-(MGR|CON|REL|INJ|MATCH|MEDIA|NAT|DEV)-\d{3}$/;

const CareerPhaseSchema = z.enum(CAREER_PHASES as [CareerPhase, ...CareerPhase[]]);

export const CooldownSchema = z
  .strictObject({
    steps: z.number().int().min(1).optional(),
    seasons: z.number().int().min(1).optional(),
  })
  .superRefine((cooldown, ctx) => {
    if (cooldown.steps === undefined && cooldown.seasons === undefined) {
      ctx.addIssue({ code: 'custom', message: 'cooldown은 steps 또는 seasons 중 하나 이상이 필요하다.' });
    }
  });

export const SafetySchema = z.strictObject({ minorSafe: z.boolean() });

export const EffectPreviewSchema = z.strictObject({
  label: z.string().min(1),
  target: z.string().optional(),
  direction: z.enum(['UP', 'DOWN']).optional(),
});

export const CHOICE_IDS = ['A', 'B', 'C'] as const;
export const ChoiceIdSchema = z.enum(CHOICE_IDS);

export const OutcomeFollowUpSchema = z.strictObject({
  eventId: z.string().regex(EVENT_ID_PATTERN),
  weightMultiplierBp: z.number().int().positive().optional(),
});

export const OUTCOME_KINDS = ['SUCCESS', 'NEUTRAL', 'FAIL', 'FIXED'] as const;

export const OutcomeSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(OUTCOME_KINDS),
  weight: z.number().int().positive(),
  title: z.string().min(1),
  cause: z.string().optional(),
  effects: z.array(EffectSchema),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
  followUps: z.array(OutcomeFollowUpSchema).optional(),
});

export const RISK_LABELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export const ChoiceSchema = z.strictObject({
  id: ChoiceIdSchema,
  label: z.string().min(1),
  riskLabel: z.enum(RISK_LABELS),
  previewEffects: z.array(EffectPreviewSchema).min(1),
  outcomes: z.array(OutcomeSchema).min(1),
});

export const NarrativeSchema = z.strictObject({ situation: z.string().min(1) });

export const EventDefinitionSchema = z
  .strictObject({
    id: z.string().regex(EVENT_ID_PATTERN),
    version: z.number().int().min(1),
    phases: z.array(CareerPhaseSchema).min(1),
    triggers: ConditionSchema,
    exclusionTags: z.array(z.string()),
    cooldown: CooldownSchema.optional(),
    weight: z.number().int().positive(),
    minAge: z.number().int().optional(),
    maxAge: z.number().int().optional(),
    safety: SafetySchema,
    choices: z.array(ChoiceSchema).min(2).max(3),
    narrative: NarrativeSchema,
  })
  .superRefine((event, ctx) => {
    const seenPhases = new Set<string>();
    event.phases.forEach((phase, index) => {
      if (seenPhases.has(phase)) {
        ctx.addIssue({ code: 'custom', message: `phases에 중복된 값: ${phase}`, path: ['phases', index] });
      }
      seenPhases.add(phase);
    });

    for (const [textPath, text] of collectNarrativeStrings(event)) {
      for (const issue of findNarrativeTokenIssues(text)) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: textPath });
      }
    }
  });

export type EventDefinition = z.infer<typeof EventDefinitionSchema>;

function collectNarrativeStrings(event: {
  narrative: { situation: string };
  choices: {
    label: string;
    previewEffects: { label: string }[];
    outcomes: { title: string; cause?: string | undefined }[];
  }[];
}): [(string | number)[], string][] {
  const entries: [(string | number)[], string][] = [['narrative.situation'.split('.'), event.narrative.situation]];

  event.choices.forEach((choice, choiceIndex) => {
    entries.push([['choices', choiceIndex, 'label'], choice.label]);
    choice.previewEffects.forEach((preview, previewIndex) => {
      entries.push([['choices', choiceIndex, 'previewEffects', previewIndex, 'label'], preview.label]);
    });
    choice.outcomes.forEach((outcome, outcomeIndex) => {
      entries.push([['choices', choiceIndex, 'outcomes', outcomeIndex, 'title'], outcome.title]);
      if (outcome.cause !== undefined) {
        entries.push([['choices', choiceIndex, 'outcomes', outcomeIndex, 'cause'], outcome.cause]);
      }
    });
  });

  return entries;
}
