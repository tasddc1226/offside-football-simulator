import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Effect as DomainEffect } from '@offside/domain';
import { z } from 'zod';
import { EFFECT_DEFAULTS, EffectSchema } from './effect.ts';

describe('EffectSchema type', () => {
  // T-2-014 D-40 규칙 4: `restoreTo`는 `applyEffects`가 REPLACE 적용 시점에 채우는 런타임 전용
  // 필드라 콘텐츠 `EffectSchema`는 이 필드를 모른다(effect.ts 주석 참고) — 도메인 `Effect`와
  // 완전히 같은 모양이 아니라 `restoreTo`를 뺀 모양과 같아야 한다.
  it('matches the domain Effect shape exactly except the runtime-only restoreTo field', () => {
    expectTypeOf<z.infer<typeof EffectSchema>>().toEqualTypeOf<Omit<DomainEffect, 'restoreTo'>>();
  });
});

describe('EffectSchema validation', () => {
  it('accepts a PERMANENT effect targeting an attribute key', () => {
    expect(() =>
      EffectSchema.parse({
        kind: 'PERMANENT',
        sourceId: 'EVT-DEV-001.A.success',
        target: 'shooting',
        delta: 1,
        ...EFFECT_DEFAULTS.PERMANENT,
      }),
    ).not.toThrow();
  });

  it('rejects RELATION effects that target an attribute (Base OVR 직접 변경 금지)', () => {
    expect(() =>
      EffectSchema.parse({
        kind: 'RELATION',
        sourceId: 'x',
        target: 'shooting',
        delta: 1,
        ...EFFECT_DEFAULTS.RELATION,
      }),
    ).toThrowError(/Base OVR/);
  });

  it('rejects CONTEXT effects that target an attribute (Base OVR 직접 변경 금지)', () => {
    expect(() =>
      EffectSchema.parse({
        kind: 'CONTEXT',
        sourceId: 'x',
        target: 'dribbling',
        delta: 1,
        ...EFFECT_DEFAULTS.CONTEXT,
      }),
    ).toThrowError(/Base OVR/);
  });

  it('rejects DEFERRED effects whose appliesAt is not NEXT_SEASON_STEP', () => {
    expect(() =>
      EffectSchema.parse({
        kind: 'DEFERRED',
        sourceId: 'x',
        target: 'form',
        delta: 1,
        clamp: EFFECT_DEFAULTS.DEFERRED.clamp,
        appliesAt: { kind: 'IMMEDIATE' },
        expiresAt: null,
        stackingRule: 'ONCE_PER_SOURCE',
      }),
    ).toThrowError(/NEXT_SEASON_STEP/);
  });

  it('accepts a DEFERRED effect targeting a CONTEXT field with NEXT_SEASON_STEP', () => {
    expect(() =>
      EffectSchema.parse({
        kind: 'DEFERRED',
        sourceId: 'x',
        target: 'tacticalFit',
        delta: 4,
        ...EFFECT_DEFAULTS.DEFERRED,
      }),
    ).not.toThrow();
  });

  // T-2-014 D-40 규칙 4: REPLACE는 이제 만료될 수 있다(만료 시 `applyEffects`가 채운
  // `restoreTo`로 되돌린다 — 콘텐츠 저작 시점엔 이 필드가 없어도 된다).
  it('accepts a REPLACE effect that has a non-null expiresAt', () => {
    expect(() =>
      EffectSchema.parse({
        kind: 'CURRENT',
        sourceId: 'x',
        target: 'form',
        delta: 1,
        clamp: { min: 0, max: 100 },
        appliesAt: { kind: 'IMMEDIATE' },
        expiresAt: { kind: 'STEPS_AFTER', steps: 2 },
        stackingRule: 'REPLACE',
      }),
    ).not.toThrow();
  });

  // T-2-014 D-40 규칙 3: PERMANENT는 영구 변화라 만료 개념이 없다.
  it('rejects a PERMANENT effect that has a non-null expiresAt', () => {
    expect(() =>
      EffectSchema.parse({
        kind: 'PERMANENT',
        sourceId: 'x',
        target: 'shooting',
        delta: 1,
        clamp: { min: 0, max: 99 },
        appliesAt: { kind: 'IMMEDIATE' },
        expiresAt: { kind: 'STEPS_AFTER', steps: 2 },
        stackingRule: 'ONCE_PER_SOURCE',
      }),
    ).toThrowError(/PERMANENT/);
  });

  it('accepts a REPLACE effect with a null expiresAt', () => {
    expect(() =>
      EffectSchema.parse({
        kind: 'CONTEXT',
        sourceId: 'x',
        target: 'positionProficiency',
        delta: 97,
        clamp: { min: 0, max: 100 },
        appliesAt: { kind: 'IMMEDIATE' },
        expiresAt: null,
        stackingRule: 'REPLACE',
      }),
    ).not.toThrow();
  });

  it.each(['form', 'fitness', 'morale'] as const)('accepts CURRENT target %s', (target) => {
    expect(() =>
      EffectSchema.parse({ kind: 'CURRENT', sourceId: 'x', target, delta: 1, ...EFFECT_DEFAULTS.CURRENT }),
    ).not.toThrow();
  });

  it.each(['managerTrust', 'captain', 'rival', 'fans', 'agent'] as const)('accepts RELATION target %s', (target) => {
    expect(() =>
      EffectSchema.parse({ kind: 'RELATION', sourceId: 'x', target, delta: 1, ...EFFECT_DEFAULTS.RELATION }),
    ).not.toThrow();
  });
});

describe('EFFECT_DEFAULTS', () => {
  it('matches the prototype table defaults', () => {
    expect(EFFECT_DEFAULTS.PERMANENT.clamp).toEqual({ min: 0, max: 99 });
    expect(EFFECT_DEFAULTS.CURRENT.clamp).toEqual({ min: 0, max: 100 });
    expect(EFFECT_DEFAULTS.CURRENT.expiresAt).toEqual({ kind: 'STEPS_AFTER', steps: 2 });
    expect(EFFECT_DEFAULTS.CONTEXT.expiresAt).toBeNull();
    expect(EFFECT_DEFAULTS.RELATION.expiresAt).toBeNull();
    expect(EFFECT_DEFAULTS.DEFERRED.appliesAt).toEqual({ kind: 'NEXT_SEASON_STEP', step: 1 });
    expect(EFFECT_DEFAULTS.PERMANENT.appliesAt).toEqual({ kind: 'IMMEDIATE' });
    for (const kind of Object.keys(EFFECT_DEFAULTS) as (keyof typeof EFFECT_DEFAULTS)[]) {
      expect(EFFECT_DEFAULTS[kind].stackingRule).toBe('ONCE_PER_SOURCE');
    }
  });
});
