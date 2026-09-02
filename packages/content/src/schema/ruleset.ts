import { z } from 'zod';
import type { AttributeKey } from '@offside/domain';
import { SemverSchema } from './pack.ts';

/**
 * `@offside/domain`은 devDependency(타입 전용)이므로 여기서 `ATTRIBUTE_KEYS` 런타임 값을
 * import할 수 없다. 아래 Record<AttributeKey, true> 리터럴은 도메인 union 타입과 어긋나면
 * (키 누락·오타) 컴파일 오류가 나서, 런타임 import 없이도 20개 키 목록이 도메인과 어긋나지
 * 않게 고정한다. `ruleset.test.ts`가 이 복제본을 `@offside/domain`의 `ATTRIBUTE_KEYS`와
 * 값으로 비교해(devDependency이므로 테스트 시점에만) 드리프트를 잡는다.
 */
const ATTRIBUTE_KEY_SET: Record<AttributeKey, true> = {
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
export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_KEY_SET) as AttributeKey[];

export const POSITIONS = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

const PositionSchema = z.enum(POSITIONS);
const AttributeKeySchema = z.enum(ATTRIBUTE_KEYS as [AttributeKey, ...AttributeKey[]]);

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
      const isGoalkeeping = key === 'goalkeeping';
      if (archetype.position === 'GK') {
        if (isGoalkeeping) continue;
        if (value < 30 || value > 72) {
          ctx.addIssue({
            code: 'custom',
            message: `template.${key}는 30~72 사이여야 한다: ${value}`,
            path: ['template', key],
          });
        }
        continue;
      }

      if (isGoalkeeping) {
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
  forbidTags: z.array(z.string().min(1)).optional(),
  fixedTeamId: z.string().min(1).optional(),
  tiers: z.array(LeagueTierSchema).min(1),
  fixedCount: z.number().int().positive().optional(),
  topTierMinOvr: z.number().int().optional(),
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
  });

export type Ruleset = z.infer<typeof RulesetSchema>;
