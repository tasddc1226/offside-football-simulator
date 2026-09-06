import { z } from 'zod';
import type { AttributeKey, CareerPhase, SeasonPhase, SimulationMode, SquadRole } from '@offside/domain';

/**
 * `@offside/domain`은 devDependency(타입 전용)이므로 여기서 런타임 값을 import할 수 없다.
 * 아래 Record<Key, true> 리터럴은 도메인 union 타입과 어긋나면(키 누락·오타) 컴파일 오류가 나서
 * 런타임 import 없이도 화이트리스트가 도메인 타입과 어긋나지 않게 고정한다.
 */
const CAREER_STAGE_SET: Record<'YOUTH' | 'PRO', true> = { YOUTH: true, PRO: true };
const SQUAD_ROLE_SET: Record<SquadRole, true> = {
  STARTER: true,
  ROTATION: true,
  BENCH: true,
  RESERVE: true,
};
const SEASON_PHASE_SET: Record<SeasonPhase, true> = {
  PRESEASON: true,
  LEAGUE: true,
  CUP: true,
  TRANSFER_WINDOW: true,
  SETTLEMENT: true,
};
const SIMULATION_MODE_SET: Record<SimulationMode, true> = { FAST: true, CHAPTER: true };
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

// CareerPhase는 조건 DSL에서 직접 값으로 비교하지 않지만(EventDefinition.phases에서만 쓰인다),
// 화이트리스트 정의가 도메인과 어긋나지 않도록 같은 패턴으로 고정해둔다.
const CAREER_PHASE_SET: Record<CareerPhase, true> = {
  YOUTH: true,
  PRESEASON: true,
  IN_SEASON: true,
  TRANSFER_WINDOW: true,
  NATIONAL_TEAM: true,
  REHAB: true,
  SETTLEMENT: true,
};
export const CAREER_PHASES = Object.keys(CAREER_PHASE_SET) as CareerPhase[];

export const SEASON_STATS = [
  'goals',
  'assists',
  'appearances',
  'starts',
  'minutes',
  'rating',
  'yellowCards',
  'redCards',
] as const;
export type SeasonStat = (typeof SEASON_STATS)[number];

export type ConditionFieldType = 'int' | 'string' | 'enum' | 'tags';

export type ConditionFieldSpec = {
  path: string;
  type: ConditionFieldType;
  values?: readonly string[];
};

/**
 * 04 이벤트 엔진의 조건 DSL 화이트리스트 표와 같은 순서로 적는다.
 * `player.attributes.<AttributeKey>`와 `season.stats.<stat>`은 정적 목록이 아니라
 * `resolveConditionField`의 접두사 매칭으로 처리한다.
 */
export const CONDITION_FIELDS: readonly ConditionFieldSpec[] = [
  { path: 'career.age', type: 'int' },
  { path: 'career.stage', type: 'enum', values: Object.keys(CAREER_STAGE_SET) },
  { path: 'career.currentRole', type: 'enum', values: Object.keys(SQUAD_ROLE_SET) },
  { path: 'career.tags', type: 'tags' },
  { path: 'career.proSeasons', type: 'int' },
  { path: 'player.primaryPosition', type: 'string' },
  { path: 'player.backgroundId', type: 'string' },
  { path: 'player.positionGroup', type: 'string' },
  { path: 'player.archetypeId', type: 'string' },
  { path: 'player.baseOvr', type: 'int' },
  { path: 'state.form', type: 'int' },
  { path: 'state.fitness', type: 'int' },
  { path: 'state.morale', type: 'int' },
  { path: 'context.tacticalFit', type: 'int' },
  { path: 'context.managerTrust', type: 'int' },
  { path: 'context.squadStatus', type: 'int' },
  { path: 'context.competitionRank', type: 'int' },
  { path: 'relationships.managerTrust', type: 'int' },
  { path: 'relationships.captain', type: 'int' },
  { path: 'relationships.rival', type: 'int' },
  { path: 'relationships.fans', type: 'int' },
  { path: 'relationships.agent', type: 'int' },
  { path: 'season.step', type: 'int' },
  { path: 'season.phase', type: 'enum', values: Object.keys(SEASON_PHASE_SET) },
  { path: 'season.simulationMode', type: 'enum', values: Object.keys(SIMULATION_MODE_SET) },
  { path: 'season.tags', type: 'tags' },
  { path: 'season.chapterHighlights', type: 'int' },
  { path: 'contract.monthsRemaining', type: 'int' },
  { path: 'contract.rolePromise', type: 'string' },
  { path: 'contract.wageBand', type: 'string' },
  { path: 'health.injuryEpisode', type: 'string' },
  { path: 'health.recurrenceRisk', type: 'int' },
  { path: 'rng.injuryRoll', type: 'int' },
  // T-3-001 D-53: 트랙 A(계약·이적) 조건 화이트리스트. contract.rolePromise와 같은 방식으로
  // 계약이 없으면 빈 문자열/0을 낸다(NOT_MODELED_* 관례가 아니라 "값 없음"의 정상 표현).
  { path: 'contract.kind', type: 'string' },
  { path: 'contract.seasonsRemaining', type: 'int' },
  { path: 'contract.isLastSeason', type: 'int' },
  { path: 'contract.promiseBreaches', type: 'int' },
  { path: 'contract.onLoan', type: 'int' },
  { path: 'contract.leagueTier', type: 'string' },
  { path: 'career.permanentTransfers', type: 'int' },
  { path: 'career.clubsCount', type: 'int' },
  // T-3-001 D-53: 트랙 B(부상·인간관계·평판) 예약 — 생성기가 없어 NOT_MODELED_* 값만 낸다.
  // 소유: health.*는 T-4-001·T-4-002, reputation.popularityCenti는 T-4-001·T-4-003,
  // season.manager.*는 T-4-001·T-4-003, season.stats.recentFormAvg는 T-4-003.
  { path: 'health.activeSeverity', type: 'string' },
  { path: 'health.recurrenceRiskBp', type: 'int' },
  { path: 'health.majorInjuries', type: 'int' },
  { path: 'reputation.popularityCenti', type: 'int' },
  { path: 'season.manager.tenureSeasons', type: 'int' },
  { path: 'season.manager.id', type: 'string' },
  { path: 'season.stats.recentFormAvg', type: 'int' },
  // F1(T-4-015): 최근 5경기 중 평점을 받은 경기 수(recentFormAvg와 같은 표본). 슬럼프 트리거가
  // 이 값으로 "평점 표본이 충분한지"를 먼저 게이트한 뒤 recentFormAvg를 본다.
  { path: 'season.stats.recentRatedMatches', type: 'int' },
] as const;

const CONDITION_FIELD_MAP = new Map(CONDITION_FIELDS.map((field) => [field.path, field]));

const ATTRIBUTE_FIELD_PREFIX = 'player.attributes.';
const SEASON_STAT_PREFIX = 'season.stats.';

export function resolveConditionField(path: string): ConditionFieldSpec | undefined {
  const direct = CONDITION_FIELD_MAP.get(path);
  if (direct) return direct;

  if (path.startsWith(ATTRIBUTE_FIELD_PREFIX)) {
    const key = path.slice(ATTRIBUTE_FIELD_PREFIX.length);
    return key in ATTRIBUTE_KEY_SET ? { path, type: 'int' } : undefined;
  }

  if (path.startsWith(SEASON_STAT_PREFIX)) {
    const stat = path.slice(SEASON_STAT_PREFIX.length);
    return (SEASON_STATS as readonly string[]).includes(stat) ? { path, type: 'int' } : undefined;
  }

  return undefined;
}

export const CONDITION_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'notIn',
  'hasTag',
  'all',
  'any',
  'not',
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

type ComparisonValue = number | string;

export type Condition =
  | { eq: [string, ComparisonValue] }
  | { neq: [string, ComparisonValue] }
  | { gt: [string, number] }
  | { gte: [string, number] }
  | { lt: [string, number] }
  | { lte: [string, number] }
  | { in: [string, ComparisonValue[]] }
  | { notIn: [string, ComparisonValue[]] }
  | { hasTag: [string, string] }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type ConditionContext = Record<string, number | string | string[]>;

const ComparisonValueSchema = z.union([z.number(), z.string()]);

function checkLeafValue(
  spec: ConditionFieldSpec,
  value: ComparisonValue,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  if (spec.type === 'int') {
    if (typeof value !== 'number') {
      ctx.addIssue({ code: 'custom', message: `필드 ${spec.path}는 숫자 값이 필요하다.`, path });
    }
    return;
  }
  if (spec.type === 'string') {
    if (typeof value !== 'string') {
      ctx.addIssue({ code: 'custom', message: `필드 ${spec.path}는 문자열 값이 필요하다.`, path });
    }
    return;
  }
  if (spec.type === 'enum') {
    if (typeof value !== 'string') {
      ctx.addIssue({ code: 'custom', message: `필드 ${spec.path}는 문자열 값이 필요하다.`, path });
    } else if (spec.values && !spec.values.includes(value)) {
      ctx.addIssue({
        code: 'custom',
        message: `필드 ${spec.path}에는 ${spec.values.join('|')} 중 하나만 올 수 있다.`,
        path,
      });
    }
    return;
  }
  ctx.addIssue({ code: 'custom', message: `필드 ${spec.path}(tags)는 hasTag에만 쓸 수 있다.`, path });
}

function validateLeaf(
  operator: Exclude<ConditionOperator, 'all' | 'any' | 'not'>,
  field: string,
  ctx: z.RefinementCtx,
): ConditionFieldSpec | undefined {
  const spec = resolveConditionField(field);
  if (!spec) {
    ctx.addIssue({ code: 'custom', message: `화이트리스트에 없는 조건 필드: ${field}`, path: [operator, 0] });
    return undefined;
  }
  if (operator === 'hasTag' && spec.type !== 'tags') {
    ctx.addIssue({ code: 'custom', message: `hasTag는 tags 필드에만 쓸 수 있다: ${field}`, path: [operator, 0] });
  }
  if ((operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') && spec.type !== 'int') {
    ctx.addIssue({ code: 'custom', message: `${operator}는 int 필드에만 쓸 수 있다: ${field}`, path: [operator, 0] });
  }
  return spec;
}

const EqSchema = z.strictObject({ eq: z.tuple([z.string(), ComparisonValueSchema]) }).superRefine((node, ctx) => {
  const [field, value] = node.eq;
  const spec = validateLeaf('eq', field, ctx);
  if (spec && spec.type !== 'tags') checkLeafValue(spec, value, ctx, ['eq', 1]);
});

const NeqSchema = z.strictObject({ neq: z.tuple([z.string(), ComparisonValueSchema]) }).superRefine((node, ctx) => {
  const [field, value] = node.neq;
  const spec = validateLeaf('neq', field, ctx);
  if (spec && spec.type !== 'tags') checkLeafValue(spec, value, ctx, ['neq', 1]);
});

const GtSchema = z.strictObject({ gt: z.tuple([z.string(), z.number()]) }).superRefine((node, ctx) => {
  validateLeaf('gt', node.gt[0], ctx);
});
const GteSchema = z.strictObject({ gte: z.tuple([z.string(), z.number()]) }).superRefine((node, ctx) => {
  validateLeaf('gte', node.gte[0], ctx);
});
const LtSchema = z.strictObject({ lt: z.tuple([z.string(), z.number()]) }).superRefine((node, ctx) => {
  validateLeaf('lt', node.lt[0], ctx);
});
const LteSchema = z.strictObject({ lte: z.tuple([z.string(), z.number()]) }).superRefine((node, ctx) => {
  validateLeaf('lte', node.lte[0], ctx);
});

const InSchema = z
  .strictObject({ in: z.tuple([z.string(), z.array(ComparisonValueSchema).min(1)]) })
  .superRefine((node, ctx) => {
    const [field, values] = node.in;
    const spec = validateLeaf('in', field, ctx);
    if (spec && spec.type === 'tags') {
      ctx.addIssue({ code: 'custom', message: `in은 tags 필드에 쓸 수 없다: ${field}`, path: ['in', 0] });
    } else if (spec) {
      values.forEach((value, index) => checkLeafValue(spec, value, ctx, ['in', 1, index]));
    }
  });

const NotInSchema = z
  .strictObject({ notIn: z.tuple([z.string(), z.array(ComparisonValueSchema).min(1)]) })
  .superRefine((node, ctx) => {
    const [field, values] = node.notIn;
    const spec = validateLeaf('notIn', field, ctx);
    if (spec && spec.type === 'tags') {
      ctx.addIssue({ code: 'custom', message: `notIn은 tags 필드에 쓸 수 없다: ${field}`, path: ['notIn', 0] });
    } else if (spec) {
      values.forEach((value, index) => checkLeafValue(spec, value, ctx, ['notIn', 1, index]));
    }
  });

const HasTagSchema = z.strictObject({ hasTag: z.tuple([z.string(), z.string()]) }).superRefine((node, ctx) => {
  const [field] = node.hasTag;
  validateLeaf('hasTag', field, ctx);
});

const LeafSchema = z.union([
  EqSchema,
  NeqSchema,
  GtSchema,
  GteSchema,
  LtSchema,
  LteSchema,
  InSchema,
  NotInSchema,
  HasTagSchema,
]);

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    LeafSchema,
    z.strictObject({ all: z.array(ConditionSchema).min(1) }),
    z.strictObject({ any: z.array(ConditionSchema).min(1) }),
    z.strictObject({ not: ConditionSchema }),
  ]),
) as z.ZodType<Condition>;

export function evaluateCondition(condition: Condition, context: ConditionContext): boolean {
  if ('all' in condition) return condition.all.every((child) => evaluateCondition(child, context));
  if ('any' in condition) return condition.any.some((child) => evaluateCondition(child, context));
  if ('not' in condition) return !evaluateCondition(condition.not, context);

  if ('hasTag' in condition) {
    const [field, tag] = condition.hasTag;
    const value = context[field];
    return Array.isArray(value) && value.includes(tag);
  }
  if ('eq' in condition) {
    const [field, target] = condition.eq;
    const value = context[field];
    return value !== undefined && !Array.isArray(value) && value === target;
  }
  if ('neq' in condition) {
    const [field, target] = condition.neq;
    const value = context[field];
    return value !== undefined && !Array.isArray(value) && value !== target;
  }
  if ('gt' in condition) return compareNumber(context, condition.gt, (a, b) => a > b);
  if ('gte' in condition) return compareNumber(context, condition.gte, (a, b) => a >= b);
  if ('lt' in condition) return compareNumber(context, condition.lt, (a, b) => a < b);
  if ('lte' in condition) return compareNumber(context, condition.lte, (a, b) => a <= b);
  if ('in' in condition) {
    const [field, values] = condition.in;
    const value = context[field];
    return value !== undefined && !Array.isArray(value) && values.includes(value);
  }
  if ('notIn' in condition) {
    const [field, values] = condition.notIn;
    const value = context[field];
    return value !== undefined && !Array.isArray(value) && !values.includes(value);
  }

  return false;
}

function compareNumber(
  context: ConditionContext,
  [field, target]: [string, number],
  cmp: (a: number, b: number) => boolean,
): boolean {
  const value = context[field];
  return typeof value === 'number' && cmp(value, target);
}
