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
});
export type Team = z.infer<typeof TeamSchema>;

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
});
export type ContractRules = z.infer<typeof ContractRulesSchema>;

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

const CupRoundSchema = z.strictObject({
  round: z.enum(['R1', 'SEMI', 'FINAL']),
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
    contractRules: ContractRulesSchema,
    leagueCalendar: LeagueCalendarSchema,
    seasonBoundaryReset: SeasonBoundaryResetSchema,
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
  }) satisfies z.ZodType<DomainRuleset>;

export type Ruleset = z.infer<typeof RulesetSchema>;
