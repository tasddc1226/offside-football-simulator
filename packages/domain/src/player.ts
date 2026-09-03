import { clamp } from './clamp.js';
import { rollRange } from './roll-range.js';
import type { RngState } from './rng.js';
import type { Archetype, Background, Ruleset } from './ruleset.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type PlayerGender, type Position, type PreferredFoot } from './types.js';

/** CONFIRM_PLAYER가 요구하는, 7개 필드가 모두 채워진 draft. */
export type ConfirmedPlayerDraft = {
  name: string;
  gender: PlayerGender;
  nationalityCode: string;
  preferredFoot: PreferredFoot;
  position: Position;
  archetypeId: string;
  backgroundId: string;
};

export type GeneratedPlayer = {
  profile: {
    name: string;
    gender: PlayerGender;
    nationalityCode: string;
    preferredFoot: PreferredFoot;
    preferredPosition: Position;
    primaryPosition: Position;
    archetypeId: string;
    backgroundId: string;
    truePotential: number;
    scoutedPotentialMin: number;
    scoutedPotentialMax: number;
    baseOvr: number;
  };
  attributes: Record<AttributeKey, number>;
  state: { form: number; fitness: number; morale: number };
  context: { tacticalFit: number; squadStatus: number; positionProficiency: number };
  relationships: { managerTrust: number; captain: number; rival: number; fans: number; agent: number };
  rngState: RngState;
};

/**
 * D-4: `baseOvr = round(Σ roleWeights[k] × attributes[k])`. 가중치에 없는 키는 0으로 취급한다.
 * 가중치 합이 1(±1e-9)이 아니면 콘텐츠 데이터 오류로 보고 throw한다(computeBaseOvr는 항상
 * 검증된 아키타입으로만 호출된다는 전제). 부동소수 합은 `ATTRIBUTE_KEYS` 순서로 더하고
 * 반올림은 `Math.round` 한 번뿐이다.
 */
export function computeBaseOvr(
  attributes: Record<AttributeKey, number>,
  roleWeights: Partial<Record<AttributeKey, number>>,
): number {
  let weightSum = 0;
  for (const key of ATTRIBUTE_KEYS) {
    weightSum += roleWeights[key] ?? 0;
  }
  if (Math.abs(weightSum - 1) > 1e-9) {
    throw new RangeError(`computeBaseOvr: roleWeights 합은 1이어야 한다. 받은 값: ${weightSum}`);
  }

  let total = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const weight = roleWeights[key];
    if (weight !== undefined) {
      total += attributes[key] * weight;
    }
  }
  return Math.round(total);
}

function findArchetype(ruleset: Ruleset, archetypeId: string): Archetype {
  const archetype = ruleset.archetypes.find((candidate) => candidate.id === archetypeId);
  if (archetype === undefined) {
    throw new RangeError(`generatePlayerProfile: 룰셋에 archetypeId '${archetypeId}'가 없다.`);
  }
  return archetype;
}

function findBackground(ruleset: Ruleset, backgroundId: string): Background {
  const background = ruleset.backgrounds.find((candidate) => candidate.id === backgroundId);
  if (background === undefined) {
    throw new RangeError(`generatePlayerProfile: 룰셋에 backgroundId '${backgroundId}'가 없다.`);
  }
  return background;
}

/**
 * D-7 CONFIRM_PLAYER의 rng 소비 순서: (1) `ATTRIBUTE_KEYS` 순서로 능력 jitter 20회
 * (`rollInt(-2, 2)`), (2) truePotential, (3) scoutedMin 편차, (4) scoutedMax 편차. 총 23회.
 */
export function generatePlayerProfile(draft: ConfirmedPlayerDraft, ruleset: Ruleset, rng: RngState): GeneratedPlayer {
  const archetype = findArchetype(ruleset, draft.archetypeId);
  const background = findBackground(ruleset, draft.backgroundId);

  let state = rng;
  const attributes = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) {
    const jitter = rollRange(state, -2, 2);
    state = jitter.state;
    const delta = background.attributeDeltas[key] ?? 0;
    attributes[key] = clamp(archetype.template[key] + delta + jitter.value, 1, 99);
  }

  const truePotentialRoll = rollRange(state, archetype.potentialRange.min, archetype.potentialRange.max);
  state = truePotentialRoll.state;
  const truePotential = truePotentialRoll.value;

  const minBelowRoll = rollRange(state, ruleset.scoutRange.minBelow.min, ruleset.scoutRange.minBelow.max);
  state = minBelowRoll.state;
  const scoutedPotentialMin = clamp(truePotential - minBelowRoll.value, 40, 99);

  const maxAboveRoll = rollRange(state, ruleset.scoutRange.maxAbove.min, ruleset.scoutRange.maxAbove.max);
  state = maxAboveRoll.state;
  const scoutedPotentialMax = clamp(truePotential + maxAboveRoll.value, 40, 99);

  const baseOvr = computeBaseOvr(attributes, archetype.roleWeights);

  return {
    profile: {
      name: draft.name,
      gender: draft.gender,
      nationalityCode: draft.nationalityCode,
      preferredFoot: draft.preferredFoot,
      preferredPosition: draft.position,
      primaryPosition: draft.position,
      archetypeId: draft.archetypeId,
      backgroundId: draft.backgroundId,
      truePotential,
      scoutedPotentialMin,
      scoutedPotentialMax,
      baseOvr,
    },
    attributes,
    state: { ...background.state },
    context: { ...background.context },
    relationships: { ...background.relationships },
    rngState: state,
  };
}
