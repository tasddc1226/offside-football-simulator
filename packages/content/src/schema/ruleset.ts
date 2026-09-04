import { z } from 'zod';
import type { AttributeKey, Ruleset as DomainRuleset } from '@offside/domain';
import { SemverSchema } from './pack.ts';

/**
 * `@offside/domain`은 devDependency(타입 전용)이므로 여기서 도메인의 `ATTRIBUTE_KEYS` 런타임
 * 값을 import할 수 없다. `satisfies readonly AttributeKey[]`는 목록에 도메인 union에 없는
 * 키가 섞이면 컴파일 오류를 내지만 원소 누락은 잡지 못하므로, 길이 20 검사(`ATTRIBUTE_KEY_COUNT`)를
 * 더해 개수 드리프트도 컴파일 타임에 드러나게 한다. `ruleset.test.ts`가 이 목록을
 * `@offside/domain`의 `ATTRIBUTE_KEYS`와 런타임 값으로도 비교한다(devDependency라 테스트 시점에만).
 */
export const ATTRIBUTE_KEYS = [
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
] as const satisfies readonly AttributeKey[];

/** 도메인 AttributeKey 유니온이 20개가 아니게 되면 타입 오류로 드러난다. */
export const ATTRIBUTE_KEY_COUNT: 20 = ATTRIBUTE_KEYS.length;

export const POSITIONS = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

const PositionSchema = z.enum(POSITIONS);
const AttributeKeySchema = z.enum(ATTRIBUTE_KEYS);

const RoleWeightsSchema = z
  .partialRecord(AttributeKeySchema, z.number())
  .refine((weights) => Object.values(weights).every((w) => w > 0), {
    message: 'roleWeights의 모든 값은 0보다 커야 한다.',
  })
  .refine(
    (weights) => {
      const sum = Object.values(weights).reduce((total, w) => total + w, 0);
      return Math.abs(sum - 1) <= 1e-9;
    },
    { message: 'roleWeights의 합은 1(오차 1e-9 이내)이어야 한다.' },
  );

const TemplateSchema = z.object(
  Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, z.number().int().min(1).max(99)])) as Record<
    AttributeKey,
    z.ZodNumber
  >,
);

const PotentialRangeSchema = z
  .strictObject({ min: z.number().int(), max: z.number().int() })
  .refine((range) => range.min < range.max, { message: 'potentialRange.min은 max보다 작아야 한다.' });

export const ArchetypeSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id는 kebab-case여야 한다.'),
    position: PositionSchema,
    name: z.string().min(1),
    summary: z.string().min(1),
    roleWeights: RoleWeightsSchema,
    template: TemplateSchema,
    potentialRange: PotentialRangeSchema,
  })
  .superRefine((archetype, ctx) => {
    for (const key of Object.keys(archetype.template) as AttributeKey[]) {
      const value = archetype.template[key];
      const isNonGkGoalkeeping = key === 'goalkeeping' && archetype.position !== 'GK';

      if (isNonGkGoalkeeping) {
        if (value < 5 || value > 15) {
          ctx.addIssue({
            code: 'custom',
            message: `GK가 아닌 아키타입의 template.goalkeeping은 5~15 사이여야 한다: ${value}`,
            path: ['template', 'goalkeeping'],
          });
        }
        continue;
      }

      if (value < 30 || value > 72) {
        ctx.addIssue({
          code: 'custom',
          message: `template.${key}는 30~72 사이여야 한다: ${value}`,
          path: ['template', key],
        });
      }
    }

    const goalkeepingWeight = archetype.roleWeights.goalkeeping ?? 0;
    if (archetype.position === 'GK' && !(goalkeepingWeight > 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'GK 아키타입은 roleWeights.goalkeeping이 0보다 커야 한다.',
        path: ['roleWeights', 'goalkeeping'],
      });
    }
    if (archetype.position !== 'GK' && goalkeepingWeight > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'GK가 아닌 아키타입은 roleWeights.goalkeeping을 가질 수 없다.',
        path: ['roleWeights', 'goalkeeping'],
      });
    }

    if (archetype.potentialRange.min < 55 || archetype.potentialRange.max > 92) {
      ctx.addIssue({
        code: 'custom',
        message: 'potentialRange는 55~92 안에 있어야 한다.',
        path: ['potentialRange'],
      });
    }
  });

export type Archetype = z.infer<typeof ArchetypeSchema>;

const StateSchema = z.strictObject({ form: z.number(), fitness: z.number(), morale: z.number() });
const ContextSchema = z.strictObject({
  tacticalFit: z.number(),
  squadStatus: z.number(),
  positionProficiency: z.number(),
});
const RelationshipsSchema = z.strictObject({
  managerTrust: z.number(),
  captain: z.number(),
  rival: z.number(),
  fans: z.number(),
  agent: z.number(),
});

export const BackgroundSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  blurb: z.string().min(1),
  startTeamId: z.string().min(1),
  attributeDeltas: z.partialRecord(AttributeKeySchema, z.number()),
  state: StateSchema,
  context: ContextSchema,
  relationships: RelationshipsSchema,
});
export type Background = z.infer<typeof BackgroundSchema>;

const NationalitySchema = z.strictObject({ code: z.string().length(2), name: z.string().min(1) });

const DraftRulesSchema = z
  .strictObject({ nameMin: z.number().int().positive(), nameMax: z.number().int().positive() })
  .refine((rules) => rules.nameMin < rules.nameMax, { message: 'nameMin은 nameMax보다 작아야 한다.' });

const ScoutBandSchema = z
  .strictObject({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() })
  .refine((band) => band.min <= band.max, { message: 'min은 max 이하여야 한다.' });

const ScoutRangeSchema = z.strictObject({ minBelow: ScoutBandSchema, maxAbove: ScoutBandSchema });

const LeagueTierSchema = z.union([z.literal('YOUTH'), z.literal(1), z.literal(2), z.literal(3)]);

const WAGE_BAND_IDS = ['tier1', 'tier2', 'tier3', 'youth'] as const;
const WageBandIdSchema = z.enum(WAGE_BAND_IDS);

export const TeamSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  leagueTier: LeagueTierSchema,
  reputation: z.number().int().min(1).max(5),
  wageBandId: WageBandIdSchema,
  // T-2-002 D-34.
  leagueId: z.string().min(1),
  tacticalStyleId: z.string().min(1),
  squadStrength: z.number().int().min(40).max(90),
});
export type Team = z.infer<typeof TeamSchema>;

// T-2-002 D-34: 전술 스타일·리그·컵·경쟁자 생성·선발 규칙(`selection.ts`가 소비).
const StylePositionRecord = <T extends z.core.SomeType>(valueSchema: T) => z.record(PositionSchema, valueSchema);

const TacticalFitStyleRoleWeightsSchema = StylePositionRecord(RoleWeightsSchema);
const PreferredArchetypeIdsSchema = StylePositionRecord(z.array(z.string().min(1)));
const SlotCountRecordSchema = StylePositionRecord(z.number().int().nonnegative());

export const TacticalStyleSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id는 kebab-case여야 한다.'),
    name: z.string().min(1),
    summary: z.string().min(1),
    formation: z.string().min(1),
    slots: SlotCountRecordSchema,
    benchSlots: SlotCountRecordSchema,
    roleWeights: TacticalFitStyleRoleWeightsSchema,
    preferredArchetypeIds: PreferredArchetypeIdsSchema,
  })
  .superRefine((style, ctx) => {
    const slotsSum = POSITIONS.reduce((sum, position) => sum + style.slots[position], 0);
    if (slotsSum !== 11) {
      ctx.addIssue({ code: 'custom', message: `tacticalStyles[${style.id}].slots 합은 11이어야 한다: ${slotsSum}`, path: ['slots'] });
    }
    // 포지션마다 아키타입은 항상 정확히 3개다(ArchetypeSchema 쪽 superRefine이 보장).
    // `competitors.ts`의 `pickArchetype`이 선호/비선호 두 그룹 모두를 가중 roll 후보로 쓰므로,
    // 한 그룹이 비면(0개 또는 3개) 가중치 합이 0이 되어 roll이 깨진다. 브리프가 명시한 "포지션마다
    // 1~2개"를 스키마로 강제해 그 경우를 원천 차단한다.
    for (const position of POSITIONS) {
      const count = style.preferredArchetypeIds[position]?.length ?? 0;
      if (count < 1 || count > 2) {
        ctx.addIssue({
          code: 'custom',
          message: `tacticalStyles[${style.id}].preferredArchetypeIds.${position}는 1~2개여야 한다: ${count}`,
          path: ['preferredArchetypeIds', position],
        });
      }
    }
  });
export type TacticalStyle = z.infer<typeof TacticalStyleSchema>;

// T-2-004 D-38: `rivalOpponentIndex`(1~teamCount-1, 이름 없는 상대 `${league.id}-opp-${n}` 중
// 라이벌)와 `promotionSpots`·`relegationSpots`(DECIDER 승격·강등 경계, 0이면 그 경계 없음).
export const LeagueSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    tier: LeagueTierSchema,
    teamCount: z.number().int().min(4),
    rounds: z.literal(2),
    strength: z.number().int().min(0).max(100),
    rivalOpponentIndex: z.number().int().min(1),
    promotionSpots: z.number().int().nonnegative(),
    relegationSpots: z.number().int().nonnegative(),
  })
  .superRefine((league, ctx) => {
    if (league.rivalOpponentIndex > league.teamCount - 1) {
      ctx.addIssue({
        code: 'custom',
        message: `rivalOpponentIndex는 1 이상 teamCount-1(${league.teamCount - 1}) 이하여야 한다: ${league.rivalOpponentIndex}`,
        path: ['rivalOpponentIndex'],
      });
    }
    if (league.promotionSpots > league.teamCount) {
      ctx.addIssue({
        code: 'custom',
        message: `promotionSpots는 teamCount(${league.teamCount}) 이하여야 한다: ${league.promotionSpots}`,
        path: ['promotionSpots'],
      });
    }
    if (league.relegationSpots > league.teamCount) {
      ctx.addIssue({
        code: 'custom',
        message: `relegationSpots는 teamCount(${league.teamCount}) 이하여야 한다: ${league.relegationSpots}`,
        path: ['relegationSpots'],
      });
    }
  });
export type League = z.infer<typeof LeagueSchema>;

export const CupSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  tiers: z.array(LeagueTierSchema).min(1),
  rounds: z.tuple([z.literal('R1'), z.literal('R2'), z.literal('SEMI'), z.literal('FINAL')]),
});
export type Cup = z.infer<typeof CupSchema>;

const PerformanceWeightsSchema = z.strictObject({
  baseOvr: z.number(),
  tacticalFit: z.number(),
  form: z.number(),
  fitness: z.number(),
  morale: z.number(),
});
const SelectionWeightsSchema = z.strictObject({
  tacticalFit: z.number(),
  managerTrust: z.number(),
  expectedPerformance: z.number(),
  squadStatus: z.number(),
});
const TacticalFitWeightsSchema = z.strictObject({ style: z.number(), archetype: z.number() });
const PositionFamiliaritySchema = z.strictObject({ natural: z.number(), trained: z.number(), makeshift: z.number() });
const ProficiencyThresholdsSchema = z.strictObject({ natural: z.number(), trained: z.number() });
const PositionAdjacencySchema = StylePositionRecord(z.array(PositionSchema));
const ProficiencyOnChangeSchema = z.strictObject({ adjacent: z.number(), other: z.number() });
const SquadStatusRuleSchema = z.strictObject({
  captainBonus: z.strictObject({ NONE: z.number(), VICE: z.number(), CAPTAIN: z.number() }),
  ratingNeutral: z.number(),
  ratingScale: z.number(),
  ratingAdjMax: z.number(),
});
const CompetitorRuleSchema = z.strictObject({
  perPosition: z.number().int().positive(),
  preferredArchetypeShare: z.number(),
  ovrSpread: z.number(),
  managerTrustBase: z.number(),
  managerTrustSpread: z.number(),
});
const RoleProposalRulesSchema = z.strictObject({
  acceptTrustDelta: z.number(),
  declineTrustDelta: z.number(),
  keepConfirmTrustDelta: z.number(),
});

function refineSum1(ctx: z.core.$RefinementCtx, weights: Record<string, number>, label: string, path: (string | number)[]) {
  const sum = Object.values(weights).reduce((total, w) => total + w, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    ctx.addIssue({ code: 'custom', message: `${label} 합은 1(오차 1e-9 이내)이어야 한다: ${sum}`, path });
  }
}

export const SelectionRulesSchema = z
  .strictObject({
    performanceWeights: PerformanceWeightsSchema,
    selectionWeights: SelectionWeightsSchema,
    tacticalFitWeights: TacticalFitWeightsSchema,
    positionFamiliarity: PositionFamiliaritySchema,
    proficiencyThresholds: ProficiencyThresholdsSchema,
    positionAdjacency: PositionAdjacencySchema,
    proficiencyOnChange: ProficiencyOnChangeSchema,
    squadStatusRule: SquadStatusRuleSchema,
    competitorRule: CompetitorRuleSchema,
    roleProposal: RoleProposalRulesSchema,
  })
  .superRefine((rules, ctx) => {
    refineSum1(ctx, rules.performanceWeights, 'selectionRules.performanceWeights', ['performanceWeights']);
    refineSum1(ctx, rules.selectionWeights, 'selectionRules.selectionWeights', ['selectionWeights']);
    refineSum1(ctx, rules.tacticalFitWeights, 'selectionRules.tacticalFitWeights', ['tacticalFitWeights']);
  });
export type SelectionRules = z.infer<typeof SelectionRulesSchema>;

const SQUAD_ROLES = ['STARTER', 'ROTATION', 'BENCH', 'RESERVE'] as const;
const SquadRoleSchema = z.enum(SQUAD_ROLES);

const OfferBranchSchema = z.strictObject({
  id: z.string().min(1),
  requireTags: z.array(z.string().min(1)).min(1),
  // exactOptional: 도메인 OfferBranch의 옵션 필드는 `key?: T`(생략 또는 정확히 T)라 `exactOptionalPropertyTypes`
  // 아래 `.optional()`(`T | undefined`)로는 `satisfies z.ZodType<Ruleset>`이 통과하지 않는다.
  forbidTags: z.array(z.string().min(1)).exactOptional(),
  fixedTeamId: z.string().min(1).exactOptional(),
  tiers: z.array(LeagueTierSchema).min(1),
  fixedCount: z.number().int().positive().exactOptional(),
  topTierMinOvr: z.number().int().exactOptional(),
});

const IntRangeSchema = z
  .strictObject({ min: z.number().int(), max: z.number().int() })
  .refine((r) => r.min <= r.max, { message: 'min은 max 이하여야 한다.' });

export const OfferRulesSchema = z.strictObject({
  maxOffers: z.number().int().positive(),
  countBonusTags: z.array(z.string().min(1)),
  branches: z.array(OfferBranchSchema).min(1),
  rolePromiseByTier: z.strictObject({
    '1': z.array(SquadRoleSchema).min(1),
    '2': z.array(SquadRoleSchema).min(1),
    '3': z.array(SquadRoleSchema).min(1),
    YOUTH: z.array(SquadRoleSchema).min(1),
  }),
  lengthSeasons: IntRangeSchema,
  shirtNumber: IntRangeSchema,
  tacticalFitEstimate: IntRangeSchema,
});
export type OfferRules = z.infer<typeof OfferRulesSchema>;

// T-3-002 D-43/D-44: 결산 뒤 이적시장·step 7 재계약 상수.
const TierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const RoleKindWeightSchema = z.strictObject({ TRANSFER: z.number().int().min(0).max(100), LOAN: z.number().int().min(0).max(100) });
const NegotiationAxisBpSchema = z.strictObject({
  WAGE: z.number().int().min(0).max(10000),
  ROLE: z.number().int().min(0).max(10000),
  LENGTH: z.number().int().min(0).max(10000),
});

export const TransferRulesSchema = z.strictObject({
  offerValidityRevisions: z.number().int().positive(),
  demandBands: z.array(z.strictObject({ maxIndexCenti: z.number().int().min(0), tiers: z.array(TierSchema).min(1) })).min(1),
  interest: z.strictObject({ minRatingTenths: z.number().int(), minIndexCenti: z.number().int() }),
  kindWeightsByRole: z.strictObject({
    STARTER: RoleKindWeightSchema,
    ROTATION: RoleKindWeightSchema,
    BENCH: RoleKindWeightSchema,
    RESERVE: RoleKindWeightSchema,
  }),
  loan: z.strictObject({
    seasons: z.literal(1),
    wageShareBp: z.number().int().min(0).max(10000),
    buyOptionChanceBp: z.number().int().min(0).max(10000),
    buyMinShareBp: z.number().int().min(0).max(10000),
  }),
  feeByIndexBand: z.array(z.strictObject({ maxIndexCenti: z.number().int().min(0), feeMinor: z.number().int().nonnegative() })).min(1),
  safeRenewal: z.strictObject({ lengthSeasons: z.number().int().positive(), wageBp: z.number().int().min(0).max(10000) }),
  // wageBpByRole은 "현재 급여 대비 배율"(bp)이라 재계약 인상분을 반영해 10000(100%)을 넘을 수 있다.
  renewal: z.strictObject({
    lengthSeasons: z.number().int().positive(),
    wageBpByRole: z.strictObject({
      STARTER: z.number().int().nonnegative(),
      ROTATION: z.number().int().nonnegative(),
      BENCH: z.number().int().nonnegative(),
      RESERVE: z.number().int().nonnegative(),
    }),
  }),
  negotiation: z.strictObject({
    successBp: z.strictObject({
      TRANSFER: NegotiationAxisBpSchema,
      FREE_AGENT: NegotiationAxisBpSchema,
      LOAN: NegotiationAxisBpSchema,
      RENEWAL: NegotiationAxisBpSchema,
    }),
    reputationAdjustBpPerPoint: z.number().int(),
    // wageBp도 renewal.wageBpByRole과 같은 "현재 급여 대비 배율"이라 10000을 넘을 수 있다.
    counter: z.strictObject({ wageBp: z.number().int().nonnegative(), lengthDelta: z.number().int() }),
  }),
  relationshipCarry: z.strictObject({
    newManagerTrustBase: z.number().int(),
    fansCarryBp: z.number().int().min(0).max(10000),
    rivalMoveFansDelta: z.number().int(),
    promiseBreachMoveFansDelta: z.number().int(),
    managerTrustPromiseBreach: z.number().int(),
  }),
  rivalPairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])),
});
export type TransferRules = z.infer<typeof TransferRulesSchema>;

const WageBandRow = z.strictObject({ low: z.number().int().nonnegative(), mid: z.number().int().nonnegative(), high: z.number().int().nonnegative() });
const WageBandsSchema = z.strictObject({ tier1: WageBandRow, tier2: WageBandRow, tier3: WageBandRow, youth: WageBandRow });

const OvrBandSchema = z.strictObject({ id: z.string().min(1), maxOvr: z.number().int() });

export const ContractRulesSchema = z.strictObject({
  ovrBands: z.array(OvrBandSchema).min(1),
  wageBands: WageBandsSchema,
  signingBonus: WageBandsSchema,
  squadStatusByRole: z.strictObject({
    STARTER: z.number(),
    ROTATION: z.number(),
    BENCH: z.number(),
    RESERVE: z.number(),
  }),
  newClubManagerTrust: z.number(),
  // T-2-005 D-39: 출전 약속 이행 판정 기준(minutesShareBp 이상인 가장 높은 역할).
  promiseMinutesShareBp: z.strictObject({
    STARTER: z.number(),
    ROTATION: z.number(),
    BENCH: z.number(),
    RESERVE: z.number(),
  }),
});
export type ContractRules = z.infer<typeof ContractRulesSchema>;

// T-2-005 D-39: 성장식이 쓰는 능력 그룹(연령대는 budgetCenti의 키로만 쓰여 별도 스키마가 필요 없다).
const GROWTH_ATTRIBUTE_GROUPS = ['TECHNICAL', 'PHYSICAL', 'MENTAL', 'GOALKEEPING'] as const;

const GrowthAgeCurveRowSchema = z.strictObject({ maxAge: z.number().int(), multBp: z.number().int() });
const GrowthByAttributeGroupRecordSchema = <T extends z.core.SomeType>(valueSchema: T) =>
  z.strictObject({ TECHNICAL: valueSchema, PHYSICAL: valueSchema, MENTAL: valueSchema, GOALKEEPING: valueSchema });

// T-2-005 D-39: 결산 성장식 상수(`growth.ts`가 소비). 값은 balance-targets를 만족하도록 튜닝된다 —
// 여기서는 형태만 검사하고 구체적인 수치 범위는 강제하지 않는다.
export const GrowthRulesSchema = z.strictObject({
  budgetCenti: z.strictObject({ U21: z.number().int(), PRIME: z.number().int(), VETERAN: z.number().int() }),
  gapCap: z.number().int().positive(),
  minutesFull: z.number().int().positive(),
  minutesFloorBp: z.number().int().min(0).max(10000),
  experiencePerRatedMatchCenti: z.number().int(),
  experienceCapCenti: z.number().int(),
  goodRatingTenths: z.number().int(),
  goodRatingBonusCenti: z.number().int(),
  roleWeightScale: z.number().int(),
  baseShareBp: z.number().int().min(0).max(10000),
  focusShareBp: z.number().int().min(0).max(10000),
  seasonDeltaMin: z.number().int(),
  seasonDeltaMax: z.number().int(),
  ageCurves: GrowthByAttributeGroupRecordSchema(z.array(GrowthAgeCurveRowSchema).min(1)),
  decline: GrowthByAttributeGroupRecordSchema(z.strictObject({ startAge: z.number().int(), perYearCenti: z.number().int() })),
})
  .refine((rules) => rules.seasonDeltaMin <= rules.seasonDeltaMax, {
    message: 'growthRules.seasonDeltaMin은 seasonDeltaMax 이하여야 한다.',
  })
  .superRefine((rules, ctx) => {
    for (const group of GROWTH_ATTRIBUTE_GROUPS) {
      const curve = rules.ageCurves[group];
      const last = curve[curve.length - 1];
      if (last?.maxAge !== 99) {
        ctx.addIssue({
          code: 'custom',
          message: `growthRules.ageCurves.${group}의 마지막 원소 maxAge는 99여야 한다.`,
          path: ['ageCurves', group],
        });
      }
    }
  });
export type GrowthRules = z.infer<typeof GrowthRulesSchema>;

// T-4-001 D-49: 부상 규칙(소유 T-4-002). severityWeights·bodyParts[].weight는 합이 100이어야 한다.
// `sequelaKeys`는 AttributeKey만 허용한다.
export const INJURY_SEVERITIES = ['MINOR', 'MODERATE', 'MAJOR'] as const;
export const INJURY_BODY_PARTS = ['KNEE', 'ANKLE', 'HAMSTRING', 'SHOULDER', 'HEAD'] as const;
export const REHAB_PLANS = ['EARLY', 'STANDARD', 'CONSERVATIVE'] as const;
const InjuryBodyPartSchema = z.enum(INJURY_BODY_PARTS);
export const RehabPlanSchema = z.enum(REHAB_PLANS);

const MatchesOutRangeSchema = z
  .strictObject({ min: z.number().int().positive(), max: z.number().int().positive() })
  .refine((range) => range.min <= range.max, { message: 'min은 max 이하여야 한다.' });

const RehabPlanRuleSchema = z.strictObject({ returnShiftMatches: z.number().int(), recurrenceAddBp: z.number().int() });

export const InjuryRulesSchema = z
  .strictObject({
    severityWeights: z.strictObject({
      MINOR: z.number().int().nonnegative(),
      MODERATE: z.number().int().nonnegative(),
      MAJOR: z.number().int().nonnegative(),
    }),
    matchesOut: z.strictObject({ MINOR: MatchesOutRangeSchema, MODERATE: MatchesOutRangeSchema, MAJOR: MatchesOutRangeSchema }),
    bodyParts: z
      .array(
        z.strictObject({
          id: InjuryBodyPartSchema,
          weight: z.number().int().nonnegative(),
          recurrenceBaseBp: z.number().int().min(0).max(10000),
          sequelaKeys: z.array(AttributeKeySchema),
        }),
      )
      .min(1),
    recurrenceWindowMatches: z.number().int().positive(),
    rehab: z.strictObject({ EARLY: RehabPlanRuleSchema, STANDARD: RehabPlanRuleSchema, CONSERVATIVE: RehabPlanRuleSchema }),
    maxForcedPerSeason: z.number().int().nonnegative(),
    durabilityPivot: z.number().int(),
    severityShiftBpPerDurabilityPoint: z.number().int(),
    fitnessBelow: z.number().int().min(0).max(100),
    fitnessAddBp: z.number().int(),
    ageFrom: z.number().int().nonnegative(),
    ageAddBpPerYear: z.number().int(),
  })
  .superRefine((rules, ctx) => {
    const severitySum = rules.severityWeights.MINOR + rules.severityWeights.MODERATE + rules.severityWeights.MAJOR;
    if (severitySum !== 100) {
      ctx.addIssue({ code: 'custom', message: `injuryRules.severityWeights 합은 100이어야 한다: ${severitySum}`, path: ['severityWeights'] });
    }
    const bodyPartWeightSum = rules.bodyParts.reduce((sum, part) => sum + part.weight, 0);
    if (bodyPartWeightSum !== 100) {
      ctx.addIssue({ code: 'custom', message: `injuryRules.bodyParts weight 합은 100이어야 한다: ${bodyPartWeightSum}`, path: ['bodyParts'] });
    }
  });
export type InjuryRules = z.infer<typeof InjuryRulesSchema>;

// T-4-001 D-50: 감독 규칙(소유 T-4-003). `names`는 `buildDefaultManager`가 코드포인트 합 % length로
// 고른다 — 중복이 있으면 안 된다(RulesetSchema superRefine이 competitorNames·narrative manager
// 사전과의 중복도 함께 검사한다).
export const ManagerRulesSchema = z
  .strictObject({
    trustBase: z.number().int().min(0).max(100),
    changeProbability: z.strictObject({
      baseBp: z.number().int().min(0).max(10000),
      perRankGapBp: z.number().int().min(0).max(10000),
      maxBp: z.number().int().min(0).max(10000),
      minTenureSeasons: z.number().int().nonnegative(),
    }),
    preferredArchetypeCount: z.number().int().positive(),
    names: z.array(z.string().min(1)).min(12),
  })
  .superRefine((rules, ctx) => {
    if (new Set(rules.names).size !== rules.names.length) {
      ctx.addIssue({ code: 'custom', message: 'managerRules.names에 중복된 이름이 있다.', path: ['names'] });
    }
  });
export type ManagerRules = z.infer<typeof ManagerRulesSchema>;

// T-4-001 D-50: 관계 로그·기억 태그·주장 임명 규칙(소유 T-4-003).
export const RelationshipRulesSchema = z.strictObject({
  logMax: z.number().int().positive(),
  memoryTagsMax: z.number().int().positive(),
  captainAppointment: z.strictObject({ minCaptain: z.number().int().min(0).max(100), minSeasons: z.number().int().nonnegative() }),
});
export type RelationshipRules = z.infer<typeof RelationshipRulesSchema>;

// T-4-001 D-49/D-50: 평판 규칙(소유 T-4-003). `initialPopularityCenti`·`initialMediaCenti`는
// `CREATE_CAREER`가 읽는다(`simulate.ts`).
export const ReputationRulesSchema = z.strictObject({
  initialPopularityCenti: z.number().int().min(0).max(10000),
  initialMediaCenti: z.number().int().min(0).max(10000),
  clampMax: z.number().int().min(0).max(10000),
  settlement: z.strictObject({
    starterSeasonCenti: z.number().int(),
    ratingAbove70Centi: z.number().int(),
    titleCenti: z.number().int(),
    decayCenti: z.number().int(),
  }),
});
export type ReputationRules = z.infer<typeof ReputationRulesSchema>;

// T-4-001 D-51: 대표팀 차출 규칙(소유 T-4-004). `opponents`는 실제 국가명을 쓰지 않는다.
const NationalTeamRelationDeltaSchema = z.strictObject({ fans: z.number().int(), agent: z.number().int() });

export const NationalTeamRulesSchema = z.strictObject({
  callUpStep: z.number().int().min(1).max(12),
  minOvrByTier: z.strictObject({
    YOUTH: z.number().int().min(0).max(99),
    '1': z.number().int().min(0).max(99),
    '2': z.number().int().min(0).max(99),
    '3': z.number().int().min(0).max(99),
  }),
  minPopularityCenti: z.number().int().min(0).max(10000),
  fitnessCost: z.strictObject({
    ACCEPT: z.number().int().nonnegative(),
    CONDITIONAL: z.number().int().nonnegative(),
    DECLINE: z.number().int().nonnegative(),
  }),
  relationDelta: z.strictObject({
    ACCEPT: NationalTeamRelationDeltaSchema,
    CONDITIONAL: NationalTeamRelationDeltaSchema,
    DECLINE: NationalTeamRelationDeltaSchema,
  }),
  opponents: z.array(z.string().min(1)).min(1),
});
export type NationalTeamRules = z.infer<typeof NationalTeamRulesSchema>;

// T-2-005 D-39: 시즌 중 매 step 경기 뒤 폼·체력·사기 갱신 상수(`condition.ts`가 소비).
export const ConditionRulesSchema = z.strictObject({
  formPivotTenths: z.number().int(),
  formDivisorTenths: z.number().int().positive(),
  formStepMax: z.number().int().nonnegative(),
  formDriftPerStep: z.number().int().nonnegative(),
  fitnessRecoveryPerStep: z.number().int(),
  fitnessCostMinutes: z.number().int().positive(),
  injuryFitnessCost: z.number().int().nonnegative(),
  moraleWin: z.number().int(),
  moraleLoss: z.number().int(),
  moraleStart: z.number().int(),
  moraleNotSelected: z.number().int(),
  moraleUnusedSub: z.number().int(),
  moraleStepMax: z.number().int().nonnegative(),
});
export type ConditionRules = z.infer<typeof ConditionRulesSchema>;

// T-2-014 D-41: 시장가치 지수(`computeMarketValueIndex`) 가중치·구간표. `weightsBp`는 bp 단위로 합이
// 10000이어야 한다(03 "리그와 시장가치").
const MarketValueWeightsBpSchema = z.strictObject({
  baseOvr: z.number().int().nonnegative(),
  scoutedPotentialMid: z.number().int().nonnegative(),
  ageCurve: z.number().int().nonnegative(),
  contract: z.number().int().nonnegative(),
  league: z.number().int().nonnegative(),
  form: z.number().int().nonnegative(),
  popularity: z.number().int().nonnegative(),
});

export const MarketValueRulesSchema = z
  .strictObject({
    weightsBp: MarketValueWeightsBpSchema,
    ageCurve: z.array(z.strictObject({ maxAge: z.number().int().positive(), valueCenti: z.number().int().min(0).max(10000) })).min(1),
    contractCurve: z.strictObject({
      remaining0: z.number().int().min(0).max(10000),
      remaining1: z.number().int().min(0).max(10000),
      remaining2Plus: z.number().int().min(0).max(10000),
    }),
    leagueTierValueCenti: z.strictObject({
      '1': z.number().int().min(0).max(10000),
      '2': z.number().int().min(0).max(10000),
      '3': z.number().int().min(0).max(10000),
      YOUTH: z.number().int().min(0).max(10000),
    }),
  })
  .refine(
    (rules) =>
      rules.weightsBp.baseOvr +
        rules.weightsBp.scoutedPotentialMid +
        rules.weightsBp.ageCurve +
        rules.weightsBp.contract +
        rules.weightsBp.league +
        rules.weightsBp.form +
        rules.weightsBp.popularity ===
      10000,
    { message: 'marketValueRules.weightsBp 합은 10000(bp)이어야 한다.', path: ['weightsBp'] },
  );
export type MarketValueRules = z.infer<typeof MarketValueRulesSchema>;

// T-2-001 D-33: 슬롯 kind는 domain `DecisionSlot['kind']`와 같은 7개.
const DECISION_SLOT_KINDS = ['EVENT', 'CHAPTER', 'CONTRACT', 'ROLE', 'INJURY', 'NATIONAL_TEAM', 'SETTLEMENT'] as const;
const DecisionSlotKindSchema = z.enum(DECISION_SLOT_KINDS);
const SlotImportanceSchema = z.enum(['MAJOR', 'MINOR']);

const LeagueCalendarSlotSchema = z.strictObject({
  kind: DecisionSlotKindSchema,
  required: z.boolean(),
  importance: SlotImportanceSchema.exactOptional(),
});

const SEASON_PHASES = ['PRESEASON', 'LEAGUE', 'CUP', 'TRANSFER_WINDOW', 'SETTLEMENT'] as const;
const SeasonPhaseSchema = z.enum(SEASON_PHASES);

const LeagueCalendarStepSchema = z.strictObject({
  index: z.number().int().min(1).max(12),
  phase: SeasonPhaseSchema,
  windowOpen: z.boolean(),
  slots: z.array(LeagueCalendarSlotSchema),
});

// T-2-002 D-34: 'R2'(8강, step 7) 추가.
const CupRoundSchema = z.strictObject({
  round: z.enum(['R1', 'R2', 'SEMI', 'FINAL']),
  step: z.number().int().min(1).max(12),
});

/**
 * T-2-001 D-33/RULE-TIME-001: 12 step·index 연속·phase 순서(PRESEASON → LEAGUE → SETTLEMENT,
 * 되돌아가지 않음)·step 12는 SETTLEMENT 필수 슬롯 1개를 검사한다.
 */
export const LeagueCalendarSchema = z
  .strictObject({
    id: z.string().min(1),
    steps: z.array(LeagueCalendarStepSchema),
    transferWindowStep: z.number().int().min(1).max(12),
    cupRounds: z.array(CupRoundSchema),
  })
  .superRefine((calendar, ctx) => {
    if (calendar.steps.length !== 12) {
      ctx.addIssue({ code: 'custom', message: 'leagueCalendar.steps는 12개여야 한다.', path: ['steps'] });
      return;
    }

    const phaseRank: Record<(typeof SEASON_PHASES)[number], number> = {
      PRESEASON: 0,
      LEAGUE: 1,
      CUP: 1,
      TRANSFER_WINDOW: 1,
      SETTLEMENT: 2,
    };
    let previousRank = -1;
    for (const [i, step] of calendar.steps.entries()) {
      if (step.index !== i + 1) {
        ctx.addIssue({
          code: 'custom',
          message: `leagueCalendar.steps[${i}].index는 ${i + 1}이어야 한다: ${step.index}`,
          path: ['steps', i, 'index'],
        });
      }
      const rank = phaseRank[step.phase];
      if (rank < previousRank) {
        ctx.addIssue({
          code: 'custom',
          message: `leagueCalendar.steps[${i}].phase가 되돌아갔다: ${step.phase}`,
          path: ['steps', i, 'phase'],
        });
      }
      previousRank = rank;
    }

    const lastStep = calendar.steps[11];
    if (lastStep !== undefined) {
      const settlementSlots = lastStep.slots.filter((slot) => slot.kind === 'SETTLEMENT' && slot.required);
      if (lastStep.phase !== 'SETTLEMENT' || settlementSlots.length !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'leagueCalendar.steps[11]은 phase SETTLEMENT이고 필수 SETTLEMENT 슬롯이 정확히 1개여야 한다.',
          path: ['steps', 11],
        });
      }
    }

    const windowStepIndex = calendar.transferWindowStep;
    const windowStep = calendar.steps.find((step) => step.index === windowStepIndex);
    if (windowStep !== undefined && !windowStep.windowOpen) {
      ctx.addIssue({
        code: 'custom',
        message: `transferWindowStep(${windowStepIndex})이 가리키는 step의 windowOpen이 false다.`,
        path: ['transferWindowStep'],
      });
    }
  });
export type LeagueCalendar = z.infer<typeof LeagueCalendarSchema>;

const SeasonBoundaryResetSchema = z.strictObject({
  form: z.number().int(),
  fitness: z.number().int(),
  morale: z.number().int(),
});

// T-2-003 D-35: 경기 계산 상수. `@offside/domain`은 devDependency(타입 전용)라 `match.ts`의
// `STAT_KEYS`를 런타임 import할 수 없다(위 ATTRIBUTE_KEYS와 같은 이유) — 여기서 그대로 미러링한다.
export const STAT_GROUPS = ['GK', 'DF', 'MF', 'FW'] as const;

export const MATCH_STAT_KEYS: Record<(typeof STAT_GROUPS)[number], readonly string[]> = {
  FW: ['goals', 'assists', 'xgCenti', 'shots', 'offsides'],
  MF: ['assists', 'chancesCreated', 'progressivePasses', 'passesAttempted', 'passesCompleted', 'ballRecoveries'],
  DF: ['tackles', 'interceptions', 'aerialsWon', 'goalsConcededInvolved'],
  GK: ['saves', 'psxgMinusGoalsCenti', 'crossesClaimed', 'buildUpPasses'],
};

const ResultTableRowSchema = z.strictObject({
  diffMin: z.number().int(),
  diffMax: z.number().int(),
  win: z.number().int().nonnegative(),
  draw: z.number().int().nonnegative(),
  loss: z.number().int().nonnegative(),
});

const MatchScoreTableSchema = z.strictObject({
  winnerGoals: z.array(z.number().int().nonnegative()).min(1),
  loserGoalsRaw: z.array(z.number().int().nonnegative()).min(1),
  drawGoals: z.array(z.number().int().nonnegative()).min(1),
});

const MinutesStartOptionSchema = z.strictObject({
  subOut: z.boolean(),
  minute: z.number().int().min(0).max(90),
});

const MatchMinutesTableSchema = z.strictObject({
  start: z.array(MinutesStartOptionSchema).min(1),
  sub: z.array(z.number().int().min(0).max(90)).min(1),
});

const InvolvementRulesSchema = z.strictObject({
  performanceWeight: z.number(),
  opponentStrengthWeight: z.number(),
  rollMin: z.number().int(),
  rollMax: z.number().int(),
});

const StatBucketSchema = z
  .strictObject({
    min: z.number().int().min(0).max(100),
    max: z.number().int().min(0).max(100),
    values: z.array(z.number().int()).min(1),
  })
  .refine((bucket) => bucket.min <= bucket.max, { message: 'min은 max보다 클 수 없다.' });

const StatDistributionTableSchema = z.array(StatBucketSchema).min(1);

const StatTablesSchema = z.strictObject({
  GK: z.record(z.string(), StatDistributionTableSchema),
  DF: z.record(z.string(), StatDistributionTableSchema),
  MF: z.record(z.string(), StatDistributionTableSchema),
  FW: z.record(z.string(), StatDistributionTableSchema),
});

const DisciplineRowSchema = z.strictObject({ yellow: z.number().int().min(0).max(100), red: z.number().int().min(0).max(100) });
const DisciplineTableSchema = z.strictObject({ GK: DisciplineRowSchema, DF: DisciplineRowSchema, MF: DisciplineRowSchema, FW: DisciplineRowSchema });

const MatchInjuryRulesSchema = z.strictObject({
  perMatchPercent: z.number().int().min(0).max(100),
  lowFitnessBelow: z.number().int().min(0).max(100),
  lowFitnessExtraPercent: z.number().int().min(0).max(100),
  outMatches: z.strictObject({ min: z.number().int().positive(), max: z.number().int().positive() }),
});

const MatchRatingWeightsSchema = z.strictObject({
  stats: z.strictObject({
    GK: z.partialRecord(z.string(), z.number()),
    DF: z.partialRecord(z.string(), z.number()),
    MF: z.partialRecord(z.string(), z.number()),
    FW: z.partialRecord(z.string(), z.number()),
  }),
  resultBonusTenths: z.strictObject({ WIN: z.number().int(), DRAW: z.number().int(), LOSS: z.number().int() }),
  cardPenaltyTenths: z.strictObject({ yellow: z.number().int().nonnegative(), red: z.number().int().nonnegative() }),
});

export const MatchRulesSchema = z
  .strictObject({
    homeBonus: z.number().int(),
    resultTable: z.array(ResultTableRowSchema).min(1),
    scoreTable: MatchScoreTableSchema,
    minutesTable: MatchMinutesTableSchema,
    involvement: InvolvementRulesSchema,
    statTables: StatTablesSchema,
    disciplineTable: DisciplineTableSchema,
    yellowSuspensionAt: z.number().int().positive(),
    redSuspension: z.strictObject({ min: z.number().int().positive(), max: z.number().int().positive() }),
    injury: MatchInjuryRulesSchema,
    ratingWeights: MatchRatingWeightsSchema,
    competitorFormDrift: z.strictObject({ amplitude: z.number().int().nonnegative() }),
    opponentNameTemplate: z.string().min(1),
    cupStrengthByRound: z.strictObject({
      R1: z.number().int().min(0).max(100),
      R2: z.number().int().min(0).max(100),
      SEMI: z.number().int().min(0).max(100),
      FINAL: z.number().int().min(0).max(100),
    }),
    cleanSheetMinMinutes: z.number().int().min(0).max(90),
  })
  .superRefine((rules, ctx) => {
    for (const [index, row] of rules.resultTable.entries()) {
      if (row.win + row.draw + row.loss !== 100) {
        ctx.addIssue({
          code: 'custom',
          message: `resultTable[${index}]의 win+draw+loss 합은 100이어야 한다: ${row.win + row.draw + row.loss}`,
          path: ['resultTable', index],
        });
      }
      if (index > 0) {
        const prev = rules.resultTable[index - 1]!;
        if (row.diffMin !== prev.diffMax + 1) {
          ctx.addIssue({
            code: 'custom',
            message: `resultTable 구간이 연속이 아니다: [${index - 1}].diffMax=${prev.diffMax} → [${index}].diffMin=${row.diffMin}`,
            path: ['resultTable', index, 'diffMin'],
          });
        }
      }
    }

    for (const group of STAT_GROUPS) {
      const table = rules.statTables[group];
      const actualKeys = Object.keys(table).sort();
      const expectedKeys = [...MATCH_STAT_KEYS[group]].sort();
      if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        ctx.addIssue({
          code: 'custom',
          message: `statTables.${group}의 키가 PositionStats 항목과 다르다: [${actualKeys.join(',')}] !== [${expectedKeys.join(',')}]`,
          path: ['statTables', group],
        });
      }
      for (const key of Object.keys(table)) {
        const buckets = [...table[key]!].sort((a, b) => a.min - b.min);
        if (buckets[0]?.min !== 0 || buckets[buckets.length - 1]?.max !== 100) {
          ctx.addIssue({
            code: 'custom',
            message: `statTables.${group}.${key}는 0~100을 전부 덮어야 한다.`,
            path: ['statTables', group, key],
          });
        }
        for (let i = 1; i < buckets.length; i++) {
          if (buckets[i]!.min !== buckets[i - 1]!.max + 1) {
            ctx.addIssue({
              code: 'custom',
              message: `statTables.${group}.${key} 구간이 연속이 아니다(index ${i}).`,
              path: ['statTables', group, key],
            });
          }
        }
      }
    }

  });

export const RulesetSchema = z
  .strictObject({
    version: SemverSchema,
    positions: z.array(PositionSchema).min(1),
    archetypes: z.array(ArchetypeSchema),
    backgrounds: z.array(BackgroundSchema).min(1),
    nationalities: z.array(NationalitySchema).min(1),
    draftRules: DraftRulesSchema,
    scoutRange: ScoutRangeSchema,
    teams: z.array(TeamSchema).min(1),
    offerRules: OfferRulesSchema,
    // T-3-002 D-43/D-44.
    transferRules: TransferRulesSchema,
    contractRules: ContractRulesSchema,
    leagueCalendar: LeagueCalendarSchema,
    seasonBoundaryReset: SeasonBoundaryResetSchema,
    // T-2-002 D-34.
    leagues: z.array(LeagueSchema).min(1),
    cups: z.array(CupSchema).min(1),
    tacticalStyles: z.array(TacticalStyleSchema).min(1),
    competitorNames: z.array(z.string().min(1)),
    selectionRules: SelectionRulesSchema,
    // T-2-003 D-35.
    matchRules: MatchRulesSchema,
    // T-2-005 D-39.
    growthRules: GrowthRulesSchema,
    // T-4-001 D-49~D-51.
    injuryRules: InjuryRulesSchema,
    managerRules: ManagerRulesSchema,
    relationshipRules: RelationshipRulesSchema,
    reputationRules: ReputationRulesSchema,
    nationalTeamRules: NationalTeamRulesSchema,
    conditionRules: ConditionRulesSchema,
    // T-2-014 D-41.
    marketValueRules: MarketValueRulesSchema,
  })
  .superRefine((ruleset, ctx) => {
    const archetypeIds = new Set<string>();
    for (const [index, archetype] of ruleset.archetypes.entries()) {
      if (archetypeIds.has(archetype.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `archetypes.id 중복: ${archetype.id}`,
          path: ['archetypes', index, 'id'],
        });
      }
      archetypeIds.add(archetype.id);

      if (!ruleset.positions.includes(archetype.position)) {
        ctx.addIssue({
          code: 'custom',
          message: `archetypes[${index}].position이 positions에 없다: ${archetype.position}`,
          path: ['archetypes', index, 'position'],
        });
      }
    }

    for (const position of ruleset.positions) {
      const count = ruleset.archetypes.filter((a) => a.position === position).length;
      if (count !== 3) {
        ctx.addIssue({
          code: 'custom',
          message: `포지션 ${position}의 아키타입 수는 3이어야 한다: ${count}`,
          path: ['archetypes'],
        });
      }
    }

    const teamIds = new Set(ruleset.teams.map((t) => t.id));
    const teamIdCounts = new Map<string, number>();
    for (const team of ruleset.teams) {
      teamIdCounts.set(team.id, (teamIdCounts.get(team.id) ?? 0) + 1);
    }
    for (const [id, count] of teamIdCounts) {
      if (count > 1) {
        ctx.addIssue({ code: 'custom', message: `teams.id 중복: ${id}`, path: ['teams'] });
      }
    }

    if (ruleset.nationalities[0]?.code !== 'KR') {
      ctx.addIssue({ code: 'custom', message: '국적 첫 항목은 KR이어야 한다.', path: ['nationalities', 0, 'code'] });
    }
    const nationalityCodes = new Set<string>();
    for (const [index, nationality] of ruleset.nationalities.entries()) {
      if (nationalityCodes.has(nationality.code)) {
        ctx.addIssue({
          code: 'custom',
          message: `nationalities.code 중복: ${nationality.code}`,
          path: ['nationalities', index, 'code'],
        });
      }
      nationalityCodes.add(nationality.code);
    }

    for (const [index, background] of ruleset.backgrounds.entries()) {
      if (!teamIds.has(background.startTeamId)) {
        ctx.addIssue({
          code: 'custom',
          message: `backgrounds[${index}].startTeamId가 teams에 없다: ${background.startTeamId}`,
          path: ['backgrounds', index, 'startTeamId'],
        });
      }
    }

    for (const [index, branch] of ruleset.offerRules.branches.entries()) {
      if (branch.fixedTeamId !== undefined && !teamIds.has(branch.fixedTeamId)) {
        ctx.addIssue({
          code: 'custom',
          message: `offerRules.branches[${index}].fixedTeamId가 teams에 없다: ${branch.fixedTeamId}`,
          path: ['offerRules', 'branches', index, 'fixedTeamId'],
        });
      }
    }

    // T-2-002 D-34.
    const leagueById = new Map(ruleset.leagues.map((league) => [league.id, league]));
    const tacticalStyleIds = new Set(ruleset.tacticalStyles.map((style) => style.id));
    for (const [index, team] of ruleset.teams.entries()) {
      const league = leagueById.get(team.leagueId);
      if (league === undefined) {
        ctx.addIssue({ code: 'custom', message: `teams[${index}].leagueId가 leagues에 없다: ${team.leagueId}`, path: ['teams', index, 'leagueId'] });
      } else if (league.tier !== team.leagueTier) {
        ctx.addIssue({
          code: 'custom',
          message: `teams[${index}].leagueTier(${team.leagueTier})가 leagues[${team.leagueId}].tier(${league.tier})와 다르다.`,
          path: ['teams', index, 'leagueTier'],
        });
      }
      if (!tacticalStyleIds.has(team.tacticalStyleId)) {
        ctx.addIssue({
          code: 'custom',
          message: `teams[${index}].tacticalStyleId가 tacticalStyles에 없다: ${team.tacticalStyleId}`,
          path: ['teams', index, 'tacticalStyleId'],
        });
      }
    }

    for (const [styleIndex, style] of ruleset.tacticalStyles.entries()) {
      for (const position of ruleset.positions) {
        const archetypesAtPosition = new Set(ruleset.archetypes.filter((a) => a.position === position).map((a) => a.id));
        for (const archetypeId of style.preferredArchetypeIds[position] ?? []) {
          if (!archetypesAtPosition.has(archetypeId)) {
            ctx.addIssue({
              code: 'custom',
              message: `tacticalStyles[${styleIndex}].preferredArchetypeIds.${position}의 아키타입이 그 포지션 것이 아니다: ${archetypeId}`,
              path: ['tacticalStyles', styleIndex, 'preferredArchetypeIds', position],
            });
          }
        }
      }
    }

    const uniqueCompetitorNames = new Set(ruleset.competitorNames);
    if (uniqueCompetitorNames.size !== ruleset.competitorNames.length) {
      ctx.addIssue({ code: 'custom', message: 'competitorNames에 중복된 이름이 있다.', path: ['competitorNames'] });
    }
    const minCompetitorNames = ruleset.selectionRules.competitorRule.perPosition * ruleset.positions.length * 2;
    if (ruleset.competitorNames.length < minCompetitorNames) {
      ctx.addIssue({
        code: 'custom',
        message: `competitorNames 길이는 ${minCompetitorNames} 이상이어야 한다: ${ruleset.competitorNames.length}`,
        path: ['competitorNames'],
      });
    }

    // T-4-001 D-50: managerRules.names는 competitorNames(선수 이름 풀)와 겹치면 안 된다(둘 다 rng
    // 없이 결정론적으로 이름을 고르는 풀이라 겹치면 어느 풀에서 왔는지 흐려진다). narrative manager
    // 사전(콘텐츠 팩 별도 파일)과의 중복은 스키마가 볼 수 없어 데이터 저작 시점에 수동으로 피한다.
    for (const name of ruleset.managerRules.names) {
      if (uniqueCompetitorNames.has(name)) {
        ctx.addIssue({ code: 'custom', message: `managerRules.names가 competitorNames와 겹친다: ${name}`, path: ['managerRules', 'names'] });
      }
    }

    // T-3-002 D-43/D-44: transferRules 정합성.
    for (const role of ['STARTER', 'ROTATION', 'BENCH', 'RESERVE'] as const) {
      const weight = ruleset.transferRules.kindWeightsByRole[role];
      if (weight.TRANSFER + weight.LOAN !== 100) {
        ctx.addIssue({
          code: 'custom',
          message: `transferRules.kindWeightsByRole.${role}의 TRANSFER+LOAN 합은 100이어야 한다: ${weight.TRANSFER + weight.LOAN}`,
          path: ['transferRules', 'kindWeightsByRole', role],
        });
      }
    }

    for (const [key, bands] of [
      ['demandBands', ruleset.transferRules.demandBands] as const,
      ['feeByIndexBand', ruleset.transferRules.feeByIndexBand] as const,
    ]) {
      for (let i = 1; i < bands.length; i++) {
        if (bands[i]!.maxIndexCenti <= bands[i - 1]!.maxIndexCenti) {
          ctx.addIssue({
            code: 'custom',
            message: `transferRules.${key}는 maxIndexCenti 오름차순이어야 한다(index ${i}).`,
            path: ['transferRules', key, i, 'maxIndexCenti'],
          });
        }
      }
      const last = bands[bands.length - 1];
      if (last !== undefined && last.maxIndexCenti !== 10000) {
        ctx.addIssue({
          code: 'custom',
          message: `transferRules.${key}의 마지막 구간은 maxIndexCenti 10000이어야 한다: ${last.maxIndexCenti}`,
          path: ['transferRules', key, bands.length - 1, 'maxIndexCenti'],
        });
      }
    }

    for (const [index, pair] of ruleset.transferRules.rivalPairs.entries()) {
      for (const teamId of pair) {
        if (!teamIds.has(teamId)) {
          ctx.addIssue({
            code: 'custom',
            message: `transferRules.rivalPairs[${index}]의 팀이 teams에 없다: ${teamId}`,
            path: ['transferRules', 'rivalPairs', index],
          });
        }
      }
    }

    if (ruleset.transferRules.relationshipCarry.newManagerTrustBase !== ruleset.contractRules.newClubManagerTrust) {
      ctx.addIssue({
        code: 'custom',
        message: `transferRules.relationshipCarry.newManagerTrustBase(${ruleset.transferRules.relationshipCarry.newManagerTrustBase})는 contractRules.newClubManagerTrust(${ruleset.contractRules.newClubManagerTrust})와 같아야 한다.`,
        path: ['transferRules', 'relationshipCarry', 'newManagerTrustBase'],
      });
    }
  }) satisfies z.ZodType<DomainRuleset>;

export type Ruleset = z.infer<typeof RulesetSchema>;
