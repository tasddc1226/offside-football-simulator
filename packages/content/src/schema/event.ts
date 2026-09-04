import { z } from 'zod';
import type { CareerPhase } from '@offside/domain';
import { CAREER_PHASES, ConditionSchema } from './condition.ts';
import { EffectSchema } from './effect.ts';
import { findNarrativeTokenIssues } from './narrative.ts';

export const EVENT_ID_PATTERN = /^EVT-(MGR|CON|REL|INJ|MATCH|MEDIA|NAT|DEV|ETH|SLUMP)-\d{3}$/;

const CareerPhaseSchema = z.enum(CAREER_PHASES as [CareerPhase, ...CareerPhase[]]);

export const CooldownSchema = z
  .strictObject({
    steps: z.number().int().min(1).optional(),
    seasons: z.number().int().min(1).optional(),
  })
  .superRefine((cooldown, ctx) => {
    if (cooldown.steps === undefined && cooldown.seasons === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'cooldown은 steps 또는 seasons 중 하나 이상이 필요하다.',
      });
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

// T-4-001 D-52: presentation이 INJURY/NATIONAL_TEAM인 이벤트의 choice가 클라이언트에 알려주는, 이
// choice를 고르면 RESOLVE_EVENT payload에 실어 보낼 값(실제로 payload에 옮기는 것은 T-4-005).
export const REHAB_PLANS = ['EARLY', 'STANDARD', 'CONSERVATIVE'] as const;
export const RehabPlanSchema = z.enum(REHAB_PLANS);
export const NATIONAL_TEAM_CALL_UPS = ['ACCEPT', 'DECLINE', 'CONDITIONAL'] as const;
export const NationalTeamCallUpSchema = z.enum(NATIONAL_TEAM_CALL_UPS);

export const ChoiceSchema = z.strictObject({
  id: ChoiceIdSchema,
  label: z.string().min(1),
  riskLabel: z.enum(RISK_LABELS),
  previewEffects: z.array(EffectPreviewSchema).min(1),
  outcomes: z.array(OutcomeSchema).min(1),
  rehabPlan: RehabPlanSchema.optional(),
  callUp: NationalTeamCallUpSchema.optional(),
});

export const NarrativeSchema = z.strictObject({ situation: z.string().min(1) });

// T-3-001 D-52: 이 값이 있는 정의는 일반 EVENT 슬롯 후보에서 제외되고, 해당 pending 생성기(T-3-002·
// T-4-002·T-4-004)만 고른다. 현재 팩에는 이 필드를 쓰는 정의가 없다.
export const PRESENTATION_KINDS = [
  'INJURY',
  'SLUMP',
  'LOCKER_ROOM',
  'ETHICS',
  'MEDIA',
  'NATIONAL_TEAM',
  'RUMOUR',
] as const;
export const PresentationKindSchema = z.enum(PRESENTATION_KINDS);

// T-3-006 U-013 (A): 워커가 쓴 최소 문구는 authoring: 'PROTOTYPE'로 표시하고 manifest
// playtested: false와 함께 다닌다. 정식 문구 승격 전까지는 이 표시로 구분한다.
export const AUTHORING_KINDS = ['PROTOTYPE', 'PLAYTESTED'] as const;
export const AuthoringKindSchema = z.enum(AUTHORING_KINDS);

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
    presentation: PresentationKindSchema.optional(),
    authoring: AuthoringKindSchema.optional(),
  })
  .superRefine((event, ctx) => {
    const seenPhases = new Set<string>();
    event.phases.forEach((phase, index) => {
      if (seenPhases.has(phase)) {
        ctx.addIssue({
          code: 'custom',
          message: `phases에 중복된 값: ${phase}`,
          path: ['phases', index],
        });
      }
      seenPhases.add(phase);
    });

    for (const [textPath, text] of collectNarrativeStrings(event)) {
      for (const issue of findNarrativeTokenIssues(text)) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: textPath });
      }
    }

    // T-4-001 D-52: presentation === INJURY면 모든 choice에 rehabPlan 필수(callUp 금지),
    // NATIONAL_TEAM이면 모든 choice에 callUp 필수(rehabPlan 금지), 그 외(또는 없음)는 둘 다 금지.
    event.choices.forEach((choice, index) => {
      if (event.presentation === 'INJURY') {
        if (choice.rehabPlan === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'presentation이 INJURY인 이벤트의 choice는 rehabPlan이 필요하다.',
            path: ['choices', index, 'rehabPlan'],
          });
        }
        if (choice.callUp !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'presentation이 INJURY인 이벤트의 choice에는 callUp을 쓸 수 없다.',
            path: ['choices', index, 'callUp'],
          });
        }
      } else if (event.presentation === 'NATIONAL_TEAM') {
        if (choice.callUp === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'presentation이 NATIONAL_TEAM인 이벤트의 choice는 callUp이 필요하다.',
            path: ['choices', index, 'callUp'],
          });
        }
        if (choice.rehabPlan !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'presentation이 NATIONAL_TEAM인 이벤트의 choice에는 rehabPlan을 쓸 수 없다.',
            path: ['choices', index, 'rehabPlan'],
          });
        }
      } else {
        if (choice.rehabPlan !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'rehabPlan은 presentation이 INJURY인 choice에만 쓸 수 있다.',
            path: ['choices', index, 'rehabPlan'],
          });
        }
        if (choice.callUp !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'callUp은 presentation이 NATIONAL_TEAM인 choice에만 쓸 수 있다.',
            path: ['choices', index, 'callUp'],
          });
        }
      }
    });

    // T-4-003 P4-6: presentation 실패가 커리어를 막지 않도록 후속 이벤트 또는 유한 만료 경로를
    // 반드시 둔다. PERMANENT 음수 효과는 어떤 경우에도 허용하지 않는다.
    if (
      event.presentation === 'SLUMP' ||
      event.presentation === 'LOCKER_ROOM' ||
      event.presentation === 'ETHICS' ||
      event.presentation === 'MEDIA'
    ) {
      event.choices.forEach((choice, choiceIndex) => {
        choice.outcomes.forEach((outcome, outcomeIndex) => {
          if (outcome.kind !== 'FAIL') return;
          const hasFollowUp = (outcome.followUps?.length ?? 0) > 0;
          const hasPermanentNegative = outcome.effects.some(
            (effect) => effect.kind === 'PERMANENT' && effect.delta < 0,
          );
          if (hasPermanentNegative) {
            ctx.addIssue({
              code: 'custom',
              message: 'presentation FAIL outcome에는 PERMANENT 음수 효과를 쓸 수 없다.',
              path: ['choices', choiceIndex, 'outcomes', outcomeIndex],
            });
          }
          const hasUnboundedTransientNegative = outcome.effects.some(
            (effect) =>
              (effect.kind === 'CURRENT' || effect.kind === 'CONTEXT') &&
              effect.delta < 0 &&
              effect.expiresAt === null,
          );
          if (!hasFollowUp && hasUnboundedTransientNegative) {
            ctx.addIssue({
              code: 'custom',
              message:
                'presentation FAIL outcome은 followUp 또는 유한 만료 효과 회복 경로가 필요하다.',
              path: ['choices', choiceIndex, 'outcomes', outcomeIndex],
            });
          }
        });
      });
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
  const entries: [(string | number)[], string][] = [
    ['narrative.situation'.split('.'), event.narrative.situation],
  ];

  event.choices.forEach((choice, choiceIndex) => {
    entries.push([['choices', choiceIndex, 'label'], choice.label]);
    choice.previewEffects.forEach((preview, previewIndex) => {
      entries.push([
        ['choices', choiceIndex, 'previewEffects', previewIndex, 'label'],
        preview.label,
      ]);
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
