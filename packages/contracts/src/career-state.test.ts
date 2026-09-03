import type {
  CareerState as DomainCareerState,
  Contract as DomainContract,
  Effect as DomainEffect,
  Offer as DomainOffer,
  Pending as DomainPending,
  SquadRole,
  TimelineEntry as DomainTimelineEntry,
} from '@offside/domain';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  CareerStateSchema,
  ContractSchema,
  EffectSchema,
  OfferSchema,
  PendingSchema,
  SquadRoleSchema,
  TimelineEntrySchema,
} from './career-state.js';

describe('domain 타입 동일성', () => {
  it('SquadRole', () => {
    expectTypeOf<z.infer<typeof SquadRoleSchema>>().toEqualTypeOf<SquadRole>();
  });

  it('Offer', () => {
    expectTypeOf<z.infer<typeof OfferSchema>>().toEqualTypeOf<DomainOffer>();
  });

  it('Contract', () => {
    expectTypeOf<z.infer<typeof ContractSchema>>().toEqualTypeOf<DomainContract>();
  });

  it('Pending', () => {
    expectTypeOf<z.infer<typeof PendingSchema>>().toEqualTypeOf<DomainPending>();
  });

  it('TimelineEntry', () => {
    expectTypeOf<z.infer<typeof TimelineEntrySchema>>().toEqualTypeOf<DomainTimelineEntry>();
  });

  it('Effect', () => {
    expectTypeOf<z.infer<typeof EffectSchema>>().toEqualTypeOf<DomainEffect>();
  });

  it('CareerState', () => {
    expectTypeOf<z.infer<typeof CareerStateSchema>>().toEqualTypeOf<DomainCareerState>();
  });
});

const VALID_OFFER = {
  id: 'OFR-2-0',
  teamId: 'hangang-u18',
  teamName: '한강 U18',
  leagueTier: 'YOUTH' as const,
  lengthSeasons: 1,
  wageMinorPerWeek: 300_000,
  signingBonusMinor: 0,
  rolePromise: 'STARTER' as const,
  shirtNumber: 10,
  tacticalFitEstimate: 60,
};

const VALID_CONTRACT = {
  id: 'CTR-3',
  offerId: 'OFR-2-0',
  teamId: 'hangang-u18',
  teamName: '한강 U18',
  leagueTier: 'YOUTH' as const,
  lengthSeasons: 1,
  wageMinorPerWeek: 300_000,
  signingBonusMinor: 0,
  rolePromise: 'STARTER' as const,
  shirtNumber: 10,
  signatureType: 'AUTO' as const,
  signedAtRevision: 3,
};

const VALID_EFFECT = {
  kind: 'PERMANENT' as const,
  sourceId: 'EVT-CON-002:a:outcome-1',
  target: 'shooting',
  delta: 2,
  clamp: { min: 1, max: 99 },
  appliesAt: { kind: 'IMMEDIATE' as const },
  expiresAt: null,
  stackingRule: 'ONCE_PER_SOURCE' as const,
};

describe('OfferSchema·ContractSchema·EffectSchema 스모크', () => {
  it('유효한 Offer를 받아들인다', () => {
    expect(OfferSchema.safeParse(VALID_OFFER).success).toBe(true);
  });

  it('유효한 Contract를 받아들인다', () => {
    expect(ContractSchema.safeParse(VALID_CONTRACT).success).toBe(true);
  });

  it("signatureType이 'AUTO'가 아니면 거부한다", () => {
    expect(ContractSchema.safeParse({ ...VALID_CONTRACT, signatureType: 'MANUAL' }).success).toBe(false);
  });

  it('유효한 Effect를 받아들인다(appliesAt IMMEDIATE, expiresAt null)', () => {
    expect(EffectSchema.safeParse(VALID_EFFECT).success).toBe(true);
  });

  it('유효한 Effect를 받아들인다(appliesAt NEXT_SEASON_STEP, expiresAt STEPS_AFTER)', () => {
    const effect = {
      ...VALID_EFFECT,
      appliesAt: { kind: 'NEXT_SEASON_STEP', step: 3 },
      expiresAt: { kind: 'STEPS_AFTER', steps: 2 },
    };
    expect(EffectSchema.safeParse(effect).success).toBe(true);
  });
});

describe('PendingSchema', () => {
  it('null을 받아들인다', () => {
    expect(PendingSchema.safeParse(null).success).toBe(true);
  });

  it("kind 'EVENT'를 받아들인다", () => {
    expect(PendingSchema.safeParse({ kind: 'EVENT', eventId: 'EVT-CON-002', version: 1 }).success).toBe(true);
  });

  it("kind 'OFFERS'를 받아들인다", () => {
    expect(PendingSchema.safeParse({ kind: 'OFFERS', offers: [VALID_OFFER] }).success).toBe(true);
  });

  it("kind 'OFFERS'인데 offers가 없으면 거부한다", () => {
    expect(PendingSchema.safeParse({ kind: 'OFFERS' }).success).toBe(false);
  });
});

function zeroAttributes(): Record<string, number> {
  const attrs: Record<string, number> = {};
  for (const key of [
    'shooting',
    'passing',
    'dribbling',
    'tackling',
    'firstTouch',
    'crossing',
    'goalkeeping',
    'pace',
    'acceleration',
    'agility',
    'jumping',
    'stamina',
    'strength',
    'durability',
    'decisions',
    'concentration',
    'composure',
    'positioning',
    'leadership',
    'consistency',
  ]) {
    attrs[key] = 50;
  }
  return attrs;
}

/** D-7 CONFIRM_PLAYER 직후 상태, D-5 club-academy 배경 값(golden과 같은 초기값)으로 만든 리터럴. */
function confirmedStateLiteral() {
  return {
    schemaVersion: 1 as const,
    careerId: 'car_1',
    status: 'ACTIVE' as const,
    stage: 'YOUTH' as const,
    age: 17,
    currentStep: 12,
    seasonPhase: 'SETTLEMENT' as const,
    simulationMode: 'FAST' as const,
    attributes: zeroAttributes(),
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 58, squadStatus: 40, positionProficiency: 100 },
    relationships: { managerTrust: 40, captain: 50, rival: 50, fans: 50, agent: 50 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    rngState: { s: [1, 2, 3, 4] as const, draws: 23 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: {
        name: '김서준',
        gender: 'UNSPECIFIED' as const,
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT' as const,
        position: 'W' as const,
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
      },
      profile: {
        name: '김서준',
        gender: 'UNSPECIFIED' as const,
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT' as const,
        preferredPosition: 'W' as const,
        primaryPosition: 'W' as const,
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
        truePotential: 80,
        scoutedPotentialMin: 72,
        scoutedPotentialMax: 85,
        baseOvr: 59,
      },
    },
    pending: null,
    contract: null,
    timeline: [{ revision: 2, kind: 'CAREER_CONFIRMED' as const, refId: null, age: 17, step: 12 }],
    season: null,
    seasonHistory: [],
  };
}

describe('CareerStateSchema', () => {
  it('확정 직후 상태 리터럴을 받아들인다', () => {
    const result = CareerStateSchema.safeParse(confirmedStateLiteral());
    expect(result.success).toBe(true);
  });

  it('알 수 없는 최상위 키는 거부한다', () => {
    const state = { ...confirmedStateLiteral(), extraField: 1 };
    expect(CareerStateSchema.safeParse(state).success).toBe(false);
  });

  it('능력 키가 하나 빠지면 거부한다', () => {
    const state = confirmedStateLiteral();
    const attributes = { ...state.attributes };
    delete (attributes as Record<string, number>).consistency;
    expect(CareerStateSchema.safeParse({ ...state, attributes }).success).toBe(false);
  });

  it('schemaVersion: 2는 거부한다', () => {
    const state = { ...confirmedStateLiteral(), schemaVersion: 2 };
    expect(CareerStateSchema.safeParse(state).success).toBe(false);
  });

  it("pending이 { kind: 'OFFERS' }인데 offers가 없으면 거부한다", () => {
    const state = { ...confirmedStateLiteral(), pending: { kind: 'OFFERS' } };
    expect(CareerStateSchema.safeParse(state).success).toBe(false);
  });
});
