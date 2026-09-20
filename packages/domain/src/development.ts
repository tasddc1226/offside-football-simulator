import { clamp } from './clamp.js';
import { computeBaseOvr } from './player.js';
import { rollInt } from './rng.js';
import type { Ruleset } from './ruleset.js';
import type { AttributeKey, CareerState, ChapterOutcomeKind } from './types.js';

export type DevelopmentPlan = {
  drill: 'CONTROL' | 'ENGINE' | 'VISION';
  load: 'RECOVERY' | 'BALANCED' | 'PUSH';
  partner: 'COACH' | 'CAPTAIN' | 'RIVAL';
};
export type DevelopmentSession = {
  drill: DevelopmentPlan['drill'];
  load: DevelopmentPlan['load'];
  partner: DevelopmentPlan['partner'];
  season: number;
  block: number;
  gains: Array<{ attribute: AttributeKey; delta: number }>;
  fitnessDelta: number;
  relationDelta: number;
  response: 'SUPPORT' | 'CHALLENGE' | 'DISTANCE';
  breakthrough: boolean;
};
export type MatchTactic = 'CONTROL' | 'ENGINE' | 'VISION';
export type DevelopmentState = {
  mastery: Record<MatchTactic, number>;
  sessions: DevelopmentSession[];
  duels: Array<{
    season: number;
    matchId: string;
    optionId: string;
    tactic: MatchTactic;
    successBp: number;
    result: ChapterOutcomeKind;
  }>;
};
export const DEVELOPMENT_DEFAULT: DevelopmentPlan = {
  drill: 'CONTROL',
  load: 'BALANCED',
  partner: 'COACH',
};
export const developmentBlock = (step: number): number => (step < 5 ? 1 : step < 9 ? 2 : 3);
export function needsDevelopment(state: CareerState, ruleset: Ruleset): boolean {
  return (
    ruleset.developmentRules !== undefined &&
    state.status === 'ACTIVE' &&
    state.season !== null &&
    state.season.currentStep < 12 &&
    state.pending === null &&
    !state.development?.sessions.some(
      (s) =>
        s.season === state.season!.index && s.block === developmentBlock(state.season!.currentStep),
    )
  );
}
export function developmentPrepared(state: CareerState, step: number): boolean {
  return (
    state.development?.sessions.some(
      (s) => s.season === state.season?.index && s.block === developmentBlock(step),
    ) ?? false
  );
}
const TARGETS: Record<MatchTactic, readonly AttributeKey[]> = {
  CONTROL: ['firstTouch', 'passing', 'dribbling'],
  ENGINE: ['stamina', 'acceleration', 'strength'],
  VISION: ['decisions', 'positioning', 'composure'],
};
/** Technical work follows the player's position; physical and mental work stay universal. */
export function developmentTargets(
  state: CareerState,
  drill: MatchTactic,
): readonly AttributeKey[] {
  if (drill !== 'CONTROL') return TARGETS[drill];
  switch (state.player.profile?.primaryPosition) {
    case 'GK':
      return ['goalkeeping', 'firstTouch', 'agility'];
    case 'CB':
      return ['tackling', 'positioning', 'jumping'];
    case 'FB':
      return ['tackling', 'crossing', 'dribbling'];
    case 'DM':
      return ['tackling', 'passing', 'firstTouch'];
    case 'W':
      return ['dribbling', 'crossing', 'firstTouch'];
    case 'ST':
      return ['shooting', 'firstTouch', 'composure'];
    default:
      return TARGETS.CONTROL;
  }
}
export function initialDevelopment(): DevelopmentState {
  return { mastery: { CONTROL: 0, ENGINE: 0, VISION: 0 }, sessions: [], duels: [] };
}
/** One saved session per block. The same seed/command always yields the same response. */
export function developPlayer(
  state: CareerState,
  plan: DevelopmentPlan,
  ruleset: Ruleset,
  revision: number,
): CareerState {
  if (!needsDevelopment(state, ruleset) || state.player.profile === null || state.season === null)
    throw new Error('지금은 훈련 구간을 준비할 수 없습니다.');
  if (
    !['CONTROL', 'ENGINE', 'VISION'].includes(plan.drill) ||
    !['RECOVERY', 'BALANCED', 'PUSH'].includes(plan.load) ||
    !['COACH', 'CAPTAIN', 'RIVAL'].includes(plan.partner)
  )
    throw new Error('훈련 계획을 확인해 주세요.');
  const injured = state.health.episodes.some((e) => e.status === 'REHAB' || e.status === 'ACTIVE');
  if (injured && plan.load === 'PUSH')
    throw new Error('재활 중에는 회복이나 균형 훈련을 선택해 주세요.');
  const development = state.development ?? initialDevelopment();
  const block = developmentBlock(state.season.currentStep);
  const rolled = rollInt(state.rngState, 100);
  const relationKey =
    plan.partner === 'COACH' ? 'managerTrust' : plan.partner === 'CAPTAIN' ? 'captain' : 'rival';
  const familiarity = state.relationships[relationKey];
  const response =
    rolled.value < Math.max(15, 65 - familiarity)
      ? 'DISTANCE'
      : plan.partner === 'RIVAL'
        ? 'CHALLENGE'
        : 'SUPPORT';
  const breakthrough =
    plan.load === 'PUSH' && !injured && state.state.fitness >= 65 && rolled.value >= 80;
  const gain =
    plan.load === 'RECOVERY' || injured || state.state.fitness < 35
      ? 0
      : Math.min(
          3,
          (plan.load === 'PUSH' ? 2 + Number(breakthrough) : 1) +
            Number(response === 'SUPPORT' && familiarity >= 70),
        );
  const targets = developmentTargets(state, plan.drill);
  const attributes = { ...state.attributes };
  const gains: DevelopmentSession['gains'] = [];
  // Rotate two of three skills so repeated training develops a recognizable specialty.
  for (const attribute of [
    targets[(state.season.index + block) % 3]!,
    targets[(state.season.index + block + 1) % 3]!,
  ]) {
    const delta = Math.max(
      0,
      Math.min(gain, Math.min(99, state.player.profile.truePotential + 5) - attributes[attribute]),
    );
    attributes[attribute] += delta;
    if (delta > 0) gains.push({ attribute, delta });
  }
  const fitness = clamp(
    state.state.fitness + (plan.load === 'RECOVERY' ? 20 : plan.load === 'PUSH' ? -18 : -5),
    0,
    100,
  );
  const relationDelta = response === 'DISTANCE' ? 1 : plan.partner === 'RIVAL' ? 4 : 6;
  const relationships = {
    ...state.relationships,
    [relationKey]: clamp(familiarity + relationDelta, 0, 100),
  };
  const mastery = {
    ...development.mastery,
    [plan.drill]: Math.min(100, development.mastery[plan.drill] + (gain > 0 ? gain * 3 : 1)),
  };
  const archetype = ruleset.archetypes.find((a) => a.id === state.player.profile!.archetypeId)!;
  const session: DevelopmentSession = {
    ...plan,
    season: state.season.index,
    block,
    gains,
    fitnessDelta: fitness - state.state.fitness,
    relationDelta: relationships[relationKey] - familiarity,
    response,
    breakthrough,
  };
  return {
    ...state,
    attributes,
    relationships,
    player: {
      ...state.player,
      profile: {
        ...state.player.profile,
        baseOvr: computeBaseOvr(attributes, archetype.roleWeights),
      },
    },
    state: {
      ...state.state,
      fitness,
      morale: clamp(
        state.state.morale + (response === 'SUPPORT' ? 4 : response === 'DISTANCE' ? -2 : 1),
        0,
        100,
      ),
    },
    context: {
      ...state.context,
      tacticalFit: clamp(
        state.context.tacticalFit + (plan.partner === 'COACH' && response === 'SUPPORT' ? 2 : 0),
        0,
        100,
      ),
    },
    development: { ...development, mastery, sessions: [...development.sessions, session] },
    rngState: rolled.state,
    timeline: [
      ...state.timeline,
      {
        kind: 'DEVELOPMENT_COMPLETED',
        revision,
        age: state.age,
        step: state.season.currentStep,
        refId: `${state.season.index}:${block}:${plan.drill}:${plan.partner}`,
      },
    ],
  };
}
const ENGINE_OPTIONS = new Set([
  'BOLD',
  'HERO',
  'GAMBLE',
  'PUSH',
  'LONG',
  'RISKY',
  'PRESS',
  'TEMPO',
  'TACKLE_RISK',
  'SOLO',
  'OWN',
  'VARIATION',
]);
const VISION_OPTIONS = new Set([
  'ROLE',
  'LEAD',
  'HUDDLE',
  'LINK',
  'VOICE',
  'ASK',
  'ADAPT',
  'HOLD_LINE',
]);
export function matchTactic(optionId: string): MatchTactic {
  return ENGINE_OPTIONS.has(optionId)
    ? 'ENGINE'
    : VISION_OPTIONS.has(optionId)
      ? 'VISION'
      : 'CONTROL';
}
/** Public scouting explanation and authoritative outcome weighting share this exact function. */
export function matchReadiness(
  state: CareerState,
  optionId: string,
): {
  tactic: MatchTactic;
  skill: number;
  mastery: number;
  support: number;
  condition: number;
  bonus: number;
} {
  const tactic = matchTactic(optionId);
  const keys = developmentTargets(state, tactic);
  const skill = Math.round(keys.reduce((sum, key) => sum + state.attributes[key], 0) / keys.length);
  const mastery = state.development?.mastery[tactic] ?? 0;
  const support =
    tactic === 'VISION'
      ? state.relationships.captain
      : tactic === 'CONTROL'
        ? state.relationships.managerTrust
        : state.relationships.rival;
  const condition = tactic === 'ENGINE' ? state.state.fitness : state.state.morale;
  const bonus = clamp(
    Math.round((skill - 55) / 3 + mastery / 8 + (support - 50) / 10 + (condition - 60) / 8),
    -20,
    25,
  );
  return { tactic, skill, mastery, support, condition, bonus };
}
export function weightMatchOutcomes<T extends { kind: ChapterOutcomeKind; weight: number }>(
  state: CareerState,
  optionId: string,
  outcomes: readonly T[],
  ruleset: Ruleset,
): T[] {
  if (ruleset.developmentRules === undefined) return [...outcomes];
  const { bonus } = matchReadiness(state, optionId);
  return outcomes.map((o) => ({
    ...o,
    weight:
      o.weight === 0
        ? 0
        : Math.max(
            1,
            Math.round(
              (o.weight *
                (100 + (o.kind === 'SUCCESS' ? bonus * 3 : o.kind === 'FAIL' ? -bonus * 3 : 0))) /
                100,
            ),
          ),
  }));
}
export function recordMatchLesson(
  state: CareerState,
  optionId: string,
  outcomes: readonly { kind: ChapterOutcomeKind; weight: number }[],
  result: ChapterOutcomeKind,
): CareerState {
  if (state.season === null || state.pending?.kind !== 'CHAPTER') return state;
  const development = state.development ?? initialDevelopment();
  const tactic = matchTactic(optionId);
  const successBp = Math.round(
    (outcomes.filter((o) => o.kind === 'SUCCESS').reduce((sum, o) => sum + o.weight, 0) * 10000) /
      outcomes.reduce((sum, o) => sum + o.weight, 0),
  );
  const delta = result === 'SUCCESS' ? 3 : result === 'FAIL' ? -2 : 1;
  const key = tactic === 'VISION' ? 'captain' : tactic === 'CONTROL' ? 'managerTrust' : 'rival';
  return {
    ...state,
    state: {
      ...state.state,
      morale: clamp(
        state.state.morale + (result === 'SUCCESS' ? 3 : result === 'FAIL' ? -4 : 0),
        0,
        100,
      ),
      fitness: clamp(state.state.fitness - (tactic === 'ENGINE' ? 4 : 0), 0, 100),
    },
    relationships: {
      ...state.relationships,
      [key]: clamp(state.relationships[key] + delta, 0, 100),
    },
    development: {
      ...development,
      mastery: {
        ...development.mastery,
        [tactic]: Math.min(100, development.mastery[tactic] + (result === 'FAIL' ? 2 : 1)),
      },
      duels: [
        ...development.duels,
        {
          season: state.season.index,
          matchId: state.pending.matchId,
          optionId,
          tactic,
          successBp,
          result,
        },
      ].slice(-36),
    },
  };
}
