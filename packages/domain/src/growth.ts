import { compareCodePoints } from './canonical.js';
import { clamp } from './clamp.js';
import { computeBaseOvr } from './player.js';
import type { GrowthAttributeGroup, GrowthRules, Ruleset } from './ruleset.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type GrowthCause, type TrainingFocus } from './types.js';

const TECHNICAL_KEYS: readonly AttributeKey[] = ['shooting', 'passing', 'dribbling', 'tackling', 'firstTouch', 'crossing'];
const PHYSICAL_KEYS: readonly AttributeKey[] = ['pace', 'acceleration', 'agility', 'jumping', 'stamina', 'strength', 'durability'];
const MENTAL_KEYS: readonly AttributeKey[] = [
  'decisions',
  'concentration',
  'composure',
  'positioning',
  'leadership',
  'consistency',
];

/**
 * D-39: 성장식 연령 곡선·하락 그룹(TECHNICAL·PHYSICAL·MENTAL·GOALKEEPING). `goalkeeping` 키만
 * GOALKEEPING이고(기술 7 중 유일하게 별도 그룹), 나머지 19키는 기존 3그룹(기술 6·신체 7·정신 6)이다.
 * `focusGroup`(trainingFocus === 'TECHNICAL') 판정은 "기술 7"(goalkeeping 포함)을 쓰므로 이 함수의
 * TECHNICAL 결과에 goalkeeping을 더해 별도로 판단한다(아래 `isInFocusGroup` 참고).
 */
export function attributeGroupOf(key: AttributeKey): GrowthAttributeGroup {
  if (key === 'goalkeeping') return 'GOALKEEPING';
  if (TECHNICAL_KEYS.includes(key)) return 'TECHNICAL';
  if (PHYSICAL_KEYS.includes(key)) return 'PHYSICAL';
  return 'MENTAL';
}

function isInFocusGroup(key: AttributeKey, focus: TrainingFocus): boolean {
  if (focus === 'ROLE') return false;
  if (focus === 'TECHNICAL') return key === 'goalkeeping' || TECHNICAL_KEYS.includes(key);
  if (focus === 'PHYSICAL') return PHYSICAL_KEYS.includes(key);
  return MENTAL_KEYS.includes(key);
}

function ageBandOf(age: number): 'U21' | 'PRIME' | 'VETERAN' {
  if (age <= 21) return 'U21';
  if (age <= 29) return 'PRIME';
  return 'VETERAN';
}

/** 오름차순 구간표(마지막 maxAge 99)에서 age를 담는 첫 구간의 multBp를 찾는다. */
function ageMultBpOf(rules: GrowthRules, group: GrowthAttributeGroup, age: number): number {
  const curve = rules.ageCurves[group];
  const entry = curve.find((candidate) => age <= candidate.maxAge);
  if (entry === undefined) {
    throw new RangeError(`ageMultBpOf: ${group} 곡선에 age ${age}를 담는 구간이 없다.`);
  }
  return entry.multBp;
}

export type GrowthInput = {
  age: number;
  attributes: Record<AttributeKey, number>;
  archetypeId: string;
  truePotential: number;
  /** 결산 직전 baseOvr(성장 적용 전). */
  baseOvrBefore: number;
  minutes: number;
  ratedMatches: number;
  ratingSumTenths: number;
  trainingFocus: TrainingFocus;
  growthCarryCenti: Record<AttributeKey, number>;
};

export type GrowthAttributeDelta = { key: AttributeKey; delta: number; causes: Array<{ cause: GrowthCause; centi: number }> };

export type GrowthResult = {
  attributes: Record<AttributeKey, number>;
  growthCarryCenti: Record<AttributeKey, number>;
  attributeDeltas: GrowthAttributeDelta[];
  baseOvr: { before: number; after: number };
};

/**
 * D-39 성장식(결산 시 1회, roll 없음). 브리프 "성장식" 1~11번 단계를 그대로 따른다. 각 능력별 centi는
 * budgetCenti·shareBp·ageMultBp·minutesBp·experienceCenti를 부동소수로 조합한 뒤 `Math.trunc`를
 * 한 번만 적용해 구한다(브리프 8번 "한 번에 계산, Math.trunc 1회") — 중간값을 미리 정수로 자르지
 * 않는다. `growthCarryCenti`에는 시즌 상한(9번)·잠재력 cap(10번)으로 잘린 양을 되돌리지 않는다
 * (브리프 "잘린 양은 carry에 남기지 않는다").
 */
export function computeGrowth(input: GrowthInput, ruleset: Ruleset): GrowthResult {
  const rules = ruleset.growthRules;
  const archetype = ruleset.archetypes.find((candidate) => candidate.id === input.archetypeId);
  if (archetype === undefined) {
    throw new RangeError(`computeGrowth: 룰셋에 archetypeId '${input.archetypeId}'가 없다.`);
  }

  const ageBand = ageBandOf(input.age);
  const gap = Math.max(0, input.truePotential - input.baseOvrBefore);
  const budgetCenti = (rules.budgetCenti[ageBand] * Math.min(gap, rules.gapCap)) / rules.gapCap;

  const minutesBp = clamp((input.minutes * 10000) / rules.minutesFull, rules.minutesFloorBp, 10000);

  const avgRatingTenths = input.ratedMatches > 0 ? Math.trunc(input.ratingSumTenths / input.ratedMatches) : 0;
  const experienceCentiSeason =
    Math.min(input.ratedMatches * rules.experiencePerRatedMatchCenti, rules.experienceCapCenti) +
    (input.ratedMatches > 0 && avgRatingTenths >= rules.goodRatingTenths ? rules.goodRatingBonusCenti : 0);

  const attributesAfter: Record<AttributeKey, number> = { ...input.attributes };
  const nextCarry: Record<AttributeKey, number> = { ...input.growthCarryCenti };
  const causesByKey = new Map<AttributeKey, Array<{ cause: GrowthCause; centi: number }>>();

  for (const key of ATTRIBUTE_KEYS) {
    const group = attributeGroupOf(key);
    const roleWeightBp = Math.round((archetype.roleWeights[key] ?? 0) * 10000);
    const shareBp = clamp(
      roleWeightBp * rules.roleWeightScale + rules.baseShareBp + (isInFocusGroup(key, input.trainingFocus) ? rules.focusShareBp : 0),
      0,
      10000,
    );
    const ageMultBp = ageMultBpOf(rules, group, input.age);

    const fullDevelopmentCenti = Math.trunc(((budgetCenti * shareBp) / 10000) * (ageMultBp / 10000));
    // ANNUAL_V1 separates modest training from positive, actual playing exposure.
    // Historical rules retain the exact old floor and arithmetic.
    const trainingCenti = ruleset.annualRules === undefined ? fullDevelopmentCenti
      : Math.trunc(fullDevelopmentCenti * ruleset.annualRules.trainingShareBp / 10000);
    const minutesCenti = ruleset.annualRules === undefined
      ? Math.trunc((trainingCenti * minutesBp) / 10000) - trainingCenti
      : Math.trunc((fullDevelopmentCenti - trainingCenti) * minutesBp / 10000);
    const experienceCenti = Math.trunc(((experienceCentiSeason * shareBp) / 10000) * (ageMultBp / 10000));
    const decline = rules.decline[group];
    const declineCenti = Math.max(0, input.age - decline.startAge) * decline.perYearCenti;
    const ageDecline = -declineCenti;

    const carry = input.growthCarryCenti[key] + trainingCenti + minutesCenti + experienceCenti + ageDecline;
    const deltaRaw = Math.trunc(carry / 100);
    nextCarry[key] = carry - deltaRaw * 100;

    const deltaSeasonClamped = clamp(deltaRaw, rules.seasonDeltaMin, rules.seasonDeltaMax);
    const before = input.attributes[key];
    attributesAfter[key] = clamp(before + deltaSeasonClamped, 1, 99);

    const causes: Array<{ cause: GrowthCause; centi: number }> = [];
    if (trainingCenti !== 0) causes.push({ cause: 'TRAINING', centi: trainingCenti });
    if (minutesCenti !== 0) causes.push({ cause: 'MINUTES', centi: minutesCenti });
    if (experienceCenti !== 0) causes.push({ cause: 'EXPERIENCE', centi: experienceCenti });
    if (ageDecline !== 0) causes.push({ cause: 'AGE_DECLINE', centi: ageDecline });
    causesByKey.set(key, causes);
  }

  // 10번: 잠재력 cap. roleWeight 내림차순(같으면 키 오름차순)으로 정렬한 "이번 시즌 양의 delta를 받은
  // 키" 목록을 한 바퀴씩 순환하며 1씩 줄인다(라운드로빈) — 시즌 상한(±3~+4)이 있어 전체 양의 delta
  // 합이 작으므로(20키 기준 최대 80) 유한 반복으로 항상 끝난다.
  const roleWeightOf = (key: AttributeKey): number => archetype.roleWeights[key] ?? 0;
  const potentialCapCentiByKey = new Map<AttributeKey, number>();
  let baseOvrAfter = computeBaseOvr(attributesAfter, archetype.roleWeights);
  if (baseOvrAfter > input.truePotential) {
    const candidates = ATTRIBUTE_KEYS.filter((key) => attributesAfter[key] > input.attributes[key]).sort(
      (a, b) => roleWeightOf(b) - roleWeightOf(a) || compareCodePoints(a, b),
    );
    let i = 0;
    while (baseOvrAfter > input.truePotential && candidates.some((key) => attributesAfter[key] > input.attributes[key])) {
      const key = candidates[i % candidates.length]!;
      if (attributesAfter[key] > input.attributes[key]) {
        attributesAfter[key] -= 1;
        potentialCapCentiByKey.set(key, (potentialCapCentiByKey.get(key) ?? 0) - 100);
        baseOvrAfter = computeBaseOvr(attributesAfter, archetype.roleWeights);
      }
      i += 1;
    }
  }
  for (const [key, centi] of potentialCapCentiByKey) {
    causesByKey.get(key)!.push({ cause: 'POTENTIAL_CAP', centi });
  }

  const attributeDeltas: GrowthAttributeDelta[] = ATTRIBUTE_KEYS.map((key) => ({
    key,
    delta: attributesAfter[key] - input.attributes[key],
    causes: causesByKey.get(key)!,
  })).filter((entry) => entry.delta !== 0 || entry.causes.length > 0);

  return {
    attributes: attributesAfter,
    growthCarryCenti: nextCarry,
    attributeDeltas,
    baseOvr: { before: input.baseOvrBefore, after: baseOvrAfter },
  };
}
