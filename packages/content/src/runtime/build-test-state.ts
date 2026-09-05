import type { AttributeKey, CareerState, PlayerDraft, PlayerProfile, TimelineEntry } from '@offside/domain';

/** condition-context/select-eligible-events 테스트 전용 리터럴 빌더. 프로덕션 코드에서 쓰지 않는다. */

const BASE_ATTRIBUTES: Record<AttributeKey, number> = {
  shooting: 60,
  passing: 54,
  dribbling: 66,
  tackling: 30,
  firstTouch: 62,
  crossing: 45,
  goalkeeping: 10,
  pace: 68,
  acceleration: 70,
  agility: 64,
  jumping: 50,
  stamina: 55,
  strength: 42,
  durability: 60,
  decisions: 52,
  concentration: 48,
  composure: 52,
  positioning: 60,
  leadership: 35,
  consistency: 45,
};

const ZERO_GROWTH_CARRY_CENTI: Record<AttributeKey, number> = Object.fromEntries(
  (Object.keys(BASE_ATTRIBUTES) as AttributeKey[]).map((key) => [key, 0]),
) as Record<AttributeKey, number>;

export const TEST_DRAFT: PlayerDraft = {
  name: '테스트 선수',
  gender: 'UNSPECIFIED',
  nationalityCode: 'KR',
  preferredFoot: 'RIGHT',
  position: 'W',
  archetypeId: 'inside-forward',
  backgroundId: 'club-academy',
};

export const TEST_PROFILE: PlayerProfile = {
  name: '테스트 선수',
  gender: 'UNSPECIFIED',
  nationalityCode: 'KR',
  preferredFoot: 'RIGHT',
  preferredPosition: 'W',
  primaryPosition: 'W',
  archetypeId: 'inside-forward',
  backgroundId: 'club-academy',
  truePotential: 75,
  scoutedPotentialMin: 68,
  scoutedPotentialMax: 82,
  baseOvr: 59,
};

export function buildTestState(overrides: Partial<CareerState> = {}): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'career-test',
    status: 'ACTIVE',
    stage: 'YOUTH',
    age: 17,
    currentStep: 0,
    seasonPhase: 'SETTLEMENT',
    simulationMode: 'FAST',
    attributes: { ...BASE_ATTRIBUTES },
    growthCarryCenti: { ...ZERO_GROWTH_CARRY_CENTI },
    state: { form: 60, fitness: 80, morale: 60 },
    context: { tacticalFit: 58, squadStatus: 40, positionProficiency: 100 },
    relationships: { managerTrust: 40, captain: 50, rival: 50, fans: 50, agent: 50 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: { draft: TEST_DRAFT, profile: TEST_PROFILE },
    pending: null,
    contract: null,
    parentContract: null,
    clubHistory: [],
    timeline: [],
    season: null,
    seasonHistory: [],
    nextManager: null,
    captaincy: 'NONE',
    captaincySeasons: 0,
    controversyFailures: 0,
    nationalityRuleState: { moduleId: 'DEFAULT', exceptions: [] },
    nationalTeam: { callUps: [], debuted: false, pendingDebut: null },
    health: { episodes: [] },
    relationshipLog: [],
    memoryTags: { managerTrust: [], captain: [], rival: [], fans: [], agent: [] },
    reputation: { popularityCenti: 5000, mediaCenti: 5000 },
    ...overrides,
  };
}

export function timelineEntry(entry: Pick<TimelineEntry, 'kind'> & Partial<TimelineEntry>): TimelineEntry {
  return { revision: 1, refId: null, age: 17, step: 0, ...entry };
}
