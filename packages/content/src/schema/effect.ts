import { z } from 'zod';
import type { AttributeKey, Effect, EffectKind } from '@offside/domain';

/**
 * `@offside/domain`은 devDependency(타입 전용)라 ATTRIBUTE_KEYS 같은 런타임 값을 가져올 수 없다.
 * Record<AttributeKey, true> 리터럴은 도메인의 AttributeKey union과 어긋나면(키 누락·오타)
 * 컴파일 오류가 나므로, 런타임 import 없이 20개 키 목록을 도메인과 동기화된 상태로 유지한다.
 */
const ATTRIBUTE_TARGET_SET: Record<AttributeKey, true> = {
  shooting: true,
  passing: true,
  dribbling: true,
  tackling: true,
  firstTouch: true,
  crossing: true,
  goalkeeping: true,
  pace: true,
  acceleration: true,
  agility: true,
  jumping: true,
  stamina: true,
  strength: true,
  durability: true,
  decisions: true,
  concentration: true,
  composure: true,
  positioning: true,
  leadership: true,
  consistency: true,
};
export const PERMANENT_TARGETS = Object.keys(ATTRIBUTE_TARGET_SET) as AttributeKey[];

export const CURRENT_TARGETS = ['form', 'fitness', 'morale'] as const;
export const CONTEXT_TARGETS = ['tacticalFit', 'squadStatus', 'positionProficiency'] as const;
export const RELATION_TARGETS = ['managerTrust', 'captain', 'rival', 'fans', 'agent'] as const;

const DEFERRED_TARGETS = new Set<string>([...PERMANENT_TARGETS, ...CURRENT_TARGETS, ...CONTEXT_TARGETS, ...RELATION_TARGETS]);

const EFFECT_KIND_SET: Record<EffectKind, true> = {
  PERMANENT: true,
  CURRENT: true,
  CONTEXT: true,
  RELATION: true,
  DEFERRED: true,
};
export const EFFECT_KINDS = Object.keys(EFFECT_KIND_SET) as EffectKind[];

// T-2-014 D-40 규칙 2: `ONCE_PER_SEASON`은 시즌마다 1회(`season:<index>:<sourceId>`로 dedupe).
export const STACKING_RULES = ['ONCE_PER_SOURCE', 'ONCE_PER_SEASON', 'REPLACE', 'SUM'] as const;

const ClampSchema = z.strictObject({ min: z.number(), max: z.number() });

const AppliesAtSchema = z.union([
  z.strictObject({ kind: z.literal('IMMEDIATE') }),
  z.strictObject({ kind: z.literal('NEXT_SEASON_STEP'), step: z.number().int().min(1) }),
]);

// T-2-014 D-40 규칙 3: `AT_SEASON_END`(결산 직전 되돌림)·`SEASONS_AFTER`(저장 시 도메인이
// `AT_SEASON_INDEX`로 치환 — effects.ts `resolveExpiresAtForStorage`)가 콘텐츠 저작 대상으로
// 더해진다. `AT_STEP`·`AT_SEASON_INDEX`는 도메인이 저장 시 채우는 형태라 콘텐츠가 직접 쓰지 않지만,
// `EffectSchema`가 도메인 `Effect` 전체 union을 만족해야 하므로(`satisfies z.ZodType<Effect>`) 스키마
// 자체는 계속 허용한다.
const ExpiresAtSchema = z.union([
  z.null(),
  z.strictObject({ kind: z.literal('STEPS_AFTER'), steps: z.number().int().min(1) }),
  z.strictObject({ kind: z.literal('AT_STEP'), step: z.number().int().min(1) }),
  z.strictObject({ kind: z.literal('AT_SEASON_END') }),
  z.strictObject({ kind: z.literal('SEASONS_AFTER'), seasons: z.number().int().min(1) }),
  z.strictObject({ kind: z.literal('AT_SEASON_INDEX'), index: z.number().int().min(0) }),
]);

export const EffectSchema = z
  .strictObject({
    kind: z.enum(EFFECT_KINDS as [EffectKind, ...EffectKind[]]),
    sourceId: z.string().min(1),
    target: z.string().min(1),
    delta: z.number(),
    clamp: ClampSchema,
    appliesAt: AppliesAtSchema,
    expiresAt: ExpiresAtSchema,
    stackingRule: z.enum(STACKING_RULES),
    // T-2-014 D-40 규칙 6: 결과 원인 태그(선택, 04 "결과가 0이면… 원인 문구"). `restoreTo`는 여기
    // 없다 — `applyEffects`가 REPLACE 적용 시점에 채우는 런타임 전용 필드다(콘텐츠가 직접 쓰지 않는다).
    reasonTag: z.string().min(1).exactOptional(),
  })
  .superRefine((effect, ctx) => {
    validateEffectTarget(effect, ctx);

    if (effect.kind === 'DEFERRED' && effect.appliesAt.kind !== 'NEXT_SEASON_STEP') {
      ctx.addIssue({
        code: 'custom',
        message: 'DEFERRED 효과는 appliesAt.kind가 NEXT_SEASON_STEP이어야 한다.',
        path: ['appliesAt'],
      });
    }

    // T-2-014 D-40 규칙 3: PERMANENT는 영구 변화라 만료가 있으면 안 된다(만료 시 되돌릴 "이전 값"
    // 개념 자체가 PERMANENT엔 없다 — CURRENT/RELATION처럼 일시 상태가 아니다).
    if (effect.kind === 'PERMANENT' && effect.expiresAt !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'PERMANENT 효과는 expiresAt이 null이어야 한다(영구 변화라 만료 개념이 없다).',
        path: ['expiresAt'],
      });
    }
  }) satisfies z.ZodType<Effect>;

function validateEffectTarget(effect: z.infer<typeof EffectSchema>, ctx: z.RefinementCtx): void {
  const isAttributeTarget = (PERMANENT_TARGETS as readonly string[]).includes(effect.target);

  switch (effect.kind) {
    case 'PERMANENT':
      if (!isAttributeTarget) {
        ctx.addIssue({
          code: 'custom',
          message: `PERMANENT 효과의 target은 능력치 키여야 한다: ${effect.target}`,
          path: ['target'],
        });
      }
      return;
    case 'CURRENT':
      if (!(CURRENT_TARGETS as readonly string[]).includes(effect.target)) {
        ctx.addIssue({
          code: 'custom',
          message: `CURRENT 효과의 target은 form|fitness|morale 중 하나여야 한다: ${effect.target}`,
          path: ['target'],
        });
      }
      return;
    case 'CONTEXT':
      if (isAttributeTarget) {
        ctx.addIssue({ code: 'custom', message: 'Base OVR 직접 변경 금지', path: ['target'] });
        return;
      }
      if (!(CONTEXT_TARGETS as readonly string[]).includes(effect.target)) {
        ctx.addIssue({
          code: 'custom',
          message: `CONTEXT 효과의 target은 tacticalFit|squadStatus|positionProficiency 중 하나여야 한다: ${effect.target}`,
          path: ['target'],
        });
      }
      return;
    case 'RELATION':
      if (isAttributeTarget) {
        ctx.addIssue({ code: 'custom', message: 'Base OVR 직접 변경 금지', path: ['target'] });
        return;
      }
      if (!(RELATION_TARGETS as readonly string[]).includes(effect.target)) {
        ctx.addIssue({
          code: 'custom',
          message: `RELATION 효과의 target은 managerTrust|captain|rival|fans|agent 중 하나여야 한다: ${effect.target}`,
          path: ['target'],
        });
      }
      return;
    case 'DEFERRED':
      if (!DEFERRED_TARGETS.has(effect.target)) {
        ctx.addIssue({
          code: 'custom',
          message: `DEFERRED 효과의 target은 PERMANENT·CURRENT·CONTEXT·RELATION target 중 하나여야 한다: ${effect.target}`,
          path: ['target'],
        });
      }
      return;
  }
}

export type EffectDefaults = Pick<Effect, 'clamp' | 'appliesAt' | 'expiresAt' | 'stackingRule'>;

/** 프로토타입 표기 규칙(`docs/content/prototype/season-01-inside-forward.md` "Effect 표기 규칙")의 기본값. */
export const EFFECT_DEFAULTS: Record<EffectKind, EffectDefaults> = {
  PERMANENT: {
    clamp: { min: 0, max: 99 },
    appliesAt: { kind: 'IMMEDIATE' },
    expiresAt: null,
    stackingRule: 'ONCE_PER_SOURCE',
  },
  CURRENT: {
    clamp: { min: 0, max: 100 },
    appliesAt: { kind: 'IMMEDIATE' },
    expiresAt: { kind: 'STEPS_AFTER', steps: 2 },
    stackingRule: 'ONCE_PER_SOURCE',
  },
  CONTEXT: {
    clamp: { min: 0, max: 100 },
    appliesAt: { kind: 'IMMEDIATE' },
    expiresAt: null,
    stackingRule: 'ONCE_PER_SOURCE',
  },
  RELATION: {
    clamp: { min: 0, max: 100 },
    appliesAt: { kind: 'IMMEDIATE' },
    expiresAt: null,
    stackingRule: 'ONCE_PER_SOURCE',
  },
  DEFERRED: {
    clamp: { min: 0, max: 100 },
    appliesAt: { kind: 'NEXT_SEASON_STEP', step: 1 },
    expiresAt: null,
    stackingRule: 'ONCE_PER_SOURCE',
  },
};
