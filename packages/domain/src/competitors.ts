import { clamp } from './clamp.js';
import { computeBaseOvr } from './player.js';
import { rollInt, type RngState } from './rng.js';
import { rollRange } from './roll-range.js';
import type { Archetype, Ruleset, Team } from './ruleset.js';
import { computeSquadStatus, computeTacticalFit, findTacticalStyle } from './selection.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type Competitor, type SquadRole } from './types.js';

export type GeneratedCompetitors = { competitors: Competitor[]; rngState: RngState };

/**
 * D-34: 아키타입 roll 하나로 감독 선호(`preferredArchetypeShare`%)와 나머지를 함께 고른다. 선호 P개·
 * 나머지 O개일 때 선호 각각의 가중치를 `share×O`, 나머지 각각을 `(100-share)×P`로 두면 총합이
 * `100×P×O`인 정수 가중치가 되어(분수 없이) 선호 그룹 합/나머지 그룹 합의 비율이 `share : 100-share`를
 * 유지한다.
 */
function pickArchetype(
  preferred: readonly Archetype[],
  other: readonly Archetype[],
  preferredShare: number,
  rngState: RngState,
): { archetype: Archetype; rngState: RngState } {
  const weighted = [
    ...preferred.map((archetype) => ({ archetype, weight: preferredShare * other.length })),
    ...other.map((archetype) => ({ archetype, weight: (100 - preferredShare) * preferred.length })),
  ];
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const rolled = rollRange(rngState, 1, totalWeight);
  let cumulative = 0;
  for (const entry of weighted) {
    cumulative += entry.weight;
    if (rolled.value <= cumulative) {
      return { archetype: entry.archetype, rngState: rolled.state };
    }
  }
  throw new RangeError('pickArchetype: 가중 roll이 후보를 고르지 못했다(가중치 합 계산 오류).');
}

function rolePromiseFor(slotsAtPosition: number, indexInPosition: number): SquadRole {
  if (slotsAtPosition >= 2) return 'STARTER';
  return indexInPosition === 0 ? 'STARTER' : 'ROTATION';
}

/**
 * D-26/D-34 CMD-SIM-001: `ruleset.positions` 순서로 포지션마다 `competitorRule.perPosition`명씩
 * 생성한다. rng 소비 순서(고정): 포지션 → 경쟁자 → 아키타입 roll → 이름 roll → 능력치 jitter 20개 →
 * managerTrust roll. Base OVR은 아키타입 template을 `team.squadStrength / templateOvr` 배율로 맞춘 뒤
 * `ATTRIBUTE_KEYS` 순서로 ±2 jitter한다(각 단계 정수 반올림, `computeBaseOvr`가 최종 반올림 1회).
 */
export function generateCompetitors(ruleset: Ruleset, team: Team, rngState: RngState): GeneratedCompetitors {
  const style = findTacticalStyle(ruleset, team.tacticalStyleId);
  const rules = ruleset.selectionRules;
  const perPosition = rules.competitorRule.perPosition;

  let state = rngState;
  let namePool = ruleset.competitorNames.slice();
  const competitors: Competitor[] = [];

  for (const position of ruleset.positions) {
    const archetypesAtPosition = ruleset.archetypes.filter((archetype) => archetype.position === position);
    const preferredIds = new Set(style.preferredArchetypeIds[position]);
    const preferred = archetypesAtPosition.filter((archetype) => preferredIds.has(archetype.id));
    const other = archetypesAtPosition.filter((archetype) => !preferredIds.has(archetype.id));

    for (let index = 0; index < perPosition; index++) {
      const archetypePick = pickArchetype(preferred, other, rules.competitorRule.preferredArchetypeShare, state);
      state = archetypePick.rngState;
      const archetype = archetypePick.archetype;

      const nameRoll = rollInt(state, namePool.length);
      state = nameRoll.state;
      const name = namePool[nameRoll.value]!;
      namePool = [...namePool.slice(0, nameRoll.value), ...namePool.slice(nameRoll.value + 1)];

      const templateOvr = computeBaseOvr(archetype.template, archetype.roleWeights);
      const scale = team.squadStrength / templateOvr;
      const attributes = {} as Record<AttributeKey, number>;
      for (const key of ATTRIBUTE_KEYS) {
        const scaled = clamp(Math.round(archetype.template[key] * scale), 1, 99);
        const jitter = rollRange(state, -2, 2);
        state = jitter.state;
        attributes[key] = clamp(scaled + jitter.value, 1, 99);
      }
      const baseOvr = computeBaseOvr(attributes, archetype.roleWeights);

      const trustBase = rules.competitorRule.managerTrustBase;
      const trustSpread = rules.competitorRule.managerTrustSpread;
      const trustRoll = rollRange(state, trustBase - trustSpread, trustBase + trustSpread);
      state = trustRoll.state;

      const rolePromise = rolePromiseFor(style.slots[position], index);
      const tacticalFit = computeTacticalFit(attributes, archetype.id, position, style, rules);
      const squadStatus = computeSquadStatus(
        { rolePromise, captaincy: 'NONE', lastRating: null },
        rules,
        ruleset.contractRules.squadStatusByRole,
      );

      competitors.push({
        id: `COMP-${position}-${index + 1}`,
        name,
        position,
        archetypeId: archetype.id,
        attributes,
        baseOvr,
        form: ruleset.seasonBoundaryReset.form,
        fitness: ruleset.seasonBoundaryReset.fitness,
        morale: ruleset.seasonBoundaryReset.morale,
        tacticalFit,
        managerTrust: trustRoll.value,
        squadStatus,
        rolePromise,
      });
    }
  }

  return { competitors, rngState: state };
}
