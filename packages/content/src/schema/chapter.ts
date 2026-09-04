import { z } from 'zod';
import type { ChapterTrigger } from '@offside/domain';
import { CURRENT_TARGETS, EffectSchema, RELATION_TARGETS } from './effect.ts';
import { EffectPreviewSchema, NarrativeSchema, OUTCOME_KINDS, RISK_LABELS } from './event.ts';
import { STAT_GROUPS } from './ruleset.ts';
import { findNarrativeTokenIssues } from './narrative.ts';

export const CHAPTER_ID_PATTERN = /^CHP-MATCH-\d{3}$/;

const StatGroupSchema = z.enum(STAT_GROUPS);
const ImportanceSchema = z.enum(['MAJOR', 'MINOR']);

export const ChapterTriggerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('DEBUT') }),
  z.strictObject({ kind: z.literal('DERBY') }),
  z.strictObject({ kind: z.literal('CUP_FINAL') }),
  z.strictObject({ kind: z.literal('DECIDER'), maxRankGap: z.number().int().nonnegative() }),
  z.strictObject({ kind: z.literal('INJURY_RETURN') }),
  z.strictObject({ kind: z.literal('TAG'), tag: z.string().min(1) }),
]) satisfies z.ZodType<ChapterTrigger>;

// T-2-004 D-38: 챕터는 CURRENT·RELATION·DEFERRED만 허용한다(CONTEXT·PERMANENT는 Base OVR·Fit을
// 바꿔 브리프 불변 조건을 깨므로 거부). balance-targets.md "일반 상한" 표(CURRENT ±12, RELATION
// ±12)를 강제한다 — 챕터는 "중대 사건"이 아니므로 그 상향 상한(±25/±20)은 쓰지 않는다. DEFERRED는
// 나중에 CURRENT·RELATION target으로 적용되므로 같은 상한·target 제한을 받는다.
export const ChapterEffectSchema = EffectSchema.superRefine((effect, ctx) => {
  if (effect.kind !== 'CURRENT' && effect.kind !== 'RELATION' && effect.kind !== 'DEFERRED') {
    ctx.addIssue({
      code: 'custom',
      message: `챕터 Effect는 CURRENT·RELATION·DEFERRED만 허용한다: ${effect.kind}`,
      path: ['kind'],
    });
    return;
  }
  const isAllowedTarget =
    (CURRENT_TARGETS as readonly string[]).includes(effect.target) || (RELATION_TARGETS as readonly string[]).includes(effect.target);
  if (!isAllowedTarget) {
    ctx.addIssue({
      code: 'custom',
      message: `챕터 Effect의 target은 CURRENT·RELATION 대상이어야 한다: ${effect.target}`,
      path: ['target'],
    });
    return;
  }
  if (Math.abs(effect.delta) > 12) {
    ctx.addIssue({
      code: 'custom',
      message: `챕터 Effect의 delta는 ±12 이내여야 한다(balance-targets 일반 상한): ${effect.delta}`,
      path: ['delta'],
    });
  }
});

export const ChapterOutcomeSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(OUTCOME_KINDS),
  weight: z.number().int().positive(),
  title: z.string().min(1),
  ratingDeltaTenths: z.number().int().min(-15).max(15),
  effects: z.array(ChapterEffectSchema),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
  narrative: NarrativeSchema,
});

export const ChapterOptionSchema = z
  .strictObject({
    id: z.string().min(1),
    label: z.string().min(1),
    riskLabel: z.enum(RISK_LABELS),
    priorProbability: z.strictObject({ successBp: z.number().int().min(0).max(10000) }).nullable(),
    previewEffects: z.array(EffectPreviewSchema).min(1),
    outcomes: z.array(ChapterOutcomeSchema).min(1),
  })
  .superRefine((option, ctx) => {
    if (option.priorProbability === null) return;
    const totalWeight = option.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    const successWeight = option.outcomes.filter((outcome) => outcome.kind === 'SUCCESS').reduce((sum, outcome) => sum + outcome.weight, 0);
    const actualBp = totalWeight === 0 ? 0 : Math.round((successWeight / totalWeight) * 10000);
    if (Math.abs(actualBp - option.priorProbability.successBp) > 500) {
      ctx.addIssue({
        code: 'custom',
        message: `priorProbability.successBp(${option.priorProbability.successBp})가 실제 SUCCESS 비중(${actualBp}bp)과 ±500bp 넘게 다르다.`,
        path: ['priorProbability', 'successBp'],
      });
    }
  });

export const ChapterDecisionSchema = z.strictObject({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(ChapterOptionSchema).min(2).max(3),
});

export const ChapterDefinitionSchema = z
  .strictObject({
    id: z.string().regex(CHAPTER_ID_PATTERN),
    version: z.number().int().min(1),
    importance: ImportanceSchema,
    trigger: ChapterTriggerSchema,
    weight: z.number().int().positive(),
    positionGroups: z.array(StatGroupSchema).optional(),
    decisions: z.array(ChapterDecisionSchema).min(1).max(3),
  })
  .superRefine((chapter, ctx) => {
    for (const [textPath, text] of collectNarrativeStrings(chapter)) {
      for (const issue of findNarrativeTokenIssues(text)) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: textPath });
      }
    }
  });

export type ChapterDefinition = z.infer<typeof ChapterDefinitionSchema>;

function collectNarrativeStrings(chapter: {
  decisions: { prompt: string; options: { label: string; outcomes: { title: string; narrative: { situation: string } }[] }[] }[];
}): [(string | number)[], string][] {
  const entries: [(string | number)[], string][] = [];

  chapter.decisions.forEach((decision, decisionIndex) => {
    entries.push([['decisions', decisionIndex, 'prompt'], decision.prompt]);
    decision.options.forEach((option, optionIndex) => {
      entries.push([['decisions', decisionIndex, 'options', optionIndex, 'label'], option.label]);
      option.outcomes.forEach((outcome, outcomeIndex) => {
        entries.push([['decisions', decisionIndex, 'options', optionIndex, 'outcomes', outcomeIndex, 'title'], outcome.title]);
        entries.push([
          ['decisions', decisionIndex, 'options', optionIndex, 'outcomes', outcomeIndex, 'narrative', 'situation'],
          outcome.narrative.situation,
        ]);
      });
    });
  });

  return entries;
}
