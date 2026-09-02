import type { RngState } from './rng.js';

export type CareerPhase =
  | 'YOUTH'
  | 'PRESEASON'
  | 'IN_SEASON'
  | 'TRANSFER_WINDOW'
  | 'NATIONAL_TEAM'
  | 'REHAB'
  | 'SETTLEMENT';

export type SeasonPhase = 'PRESEASON' | 'LEAGUE' | 'CUP' | 'TRANSFER_WINDOW' | 'SETTLEMENT';

export type SimulationMode = 'FAST' | 'CHAPTER';

export type CareerStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED' | 'ARCHIVED';

export type CareerStage = 'YOUTH' | 'PRO';

export type SquadRole = 'STARTER' | 'ROTATION' | 'BENCH' | 'RESERVE';

export type CheckpointType =
  | 'CAREER_CREATED'
  | 'SEASON_START'
  | 'STEP_BOUNDARY'
  | 'EVENT_OFFERED'
  | 'EVENT_RESOLVED'
  | 'CHAPTER_DECISION'
  | 'SEASON_SETTLED'
  | 'CONTRACT_CONFIRMED'
  | 'RETIREMENT';

export const ATTRIBUTE_KEYS = [
  'shooting',
  'passing',
  'dribbling',
  'tackling',
  'firstTouch',
  'crossing',
  'goalkeeping', // 기술 7
  'pace',
  'acceleration',
  'agility',
  'jumping',
  'stamina',
  'strength',
  'durability', // 신체 7
  'decisions',
  'concentration',
  'composure',
  'positioning',
  'leadership',
  'consistency', // 정신 6
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

export type EffectKind = 'PERMANENT' | 'CURRENT' | 'CONTEXT' | 'RELATION' | 'DEFERRED';

export type Effect = {
  kind: EffectKind;
  sourceId: string;
  target: string;
  delta: number;
  clamp: { min: number; max: number };
  appliesAt: { kind: 'IMMEDIATE' } | { kind: 'NEXT_SEASON_STEP'; step: number };
  expiresAt: null | { kind: 'STEPS_AFTER'; steps: number } | { kind: 'AT_STEP'; step: number };
  stackingRule: 'ONCE_PER_SOURCE' | 'REPLACE' | 'SUM';
};

// D-1: 포지션과 묶음(phase-1-plan.md). CB·FB → DEF, DM·CM·AM → MID, W·ST → FWD.
export type Position = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST';

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export function positionGroupOf(position: Position): PositionGroup {
  switch (position) {
    case 'GK':
      return 'GK';
    case 'CB':
    case 'FB':
      return 'DEF';
    case 'DM':
    case 'CM':
    case 'AM':
      return 'MID';
    case 'W':
    case 'ST':
      return 'FWD';
  }
}

export type PreferredFoot = 'LEFT' | 'RIGHT' | 'BOTH';

/** DRAFT 단계에서 채워 나가는 6개 필드. CONFIRM_PLAYER는 전부 non-null을 요구한다. */
export type PlayerDraft = {
  name: string | null;
  nationalityCode: string | null;
  preferredFoot: PreferredFoot | null;
  position: Position | null;
  archetypeId: string | null;
  backgroundId: string | null;
};

/** CONFIRM_PLAYER가 룰셋·rng로 확정하는 선수 정체성·잠재력·Base OVR. */
export type PlayerProfile = {
  name: string;
  nationalityCode: string;
  preferredFoot: PreferredFoot;
  position: Position;
  archetypeId: string;
  backgroundId: string;
  truePotential: number;
  scoutedPotentialMin: number;
  scoutedPotentialMax: number;
  baseOvr: number;
};

// D-9: 제안·계약(offerRules 데이터는 T-1-005가 소비, 타입만 이 작업에서 정의).
export type Offer = {
  id: string;
  teamId: string;
  teamName: string;
  leagueTier: 'YOUTH' | 1 | 2 | 3;
  lengthSeasons: number;
  wageMinorPerWeek: number;
  signingBonusMinor: number;
  rolePromise: SquadRole;
  shirtNumber: number;
  tacticalFitEstimate: number;
};

export type Contract = {
  id: string;
  offerId: string;
  teamId: string;
  teamName: string;
  leagueTier: 'YOUTH' | 1 | 2 | 3;
  lengthSeasons: number;
  wageMinorPerWeek: number;
  signingBonusMinor: number;
  rolePromise: SquadRole;
  shirtNumber: number;
  signatureType: 'AUTO';
  signedAtRevision: number;
};

export type Pending =
  | null
  | { kind: 'EVENT'; eventId: string; version: number }
  | { kind: 'OFFERS'; offers: Offer[] };

// D-12: 타임라인. 문장은 넣지 않는다(웹이 팩·룰셋에서 조합).
export type TimelineEntry = {
  revision: number;
  kind: 'CAREER_CONFIRMED' | 'EVENT_RESOLVED' | 'CONTRACT_SIGNED' | 'SEASON_SETTLED';
  refId: string | null;
  age: number;
  step: number;
};

export type CareerState = {
  schemaVersion: 1;
  careerId: string;
  status: CareerStatus;
  stage: CareerStage;
  age: number;
  currentStep: number;
  seasonPhase: SeasonPhase;
  simulationMode: SimulationMode;
  attributes: Record<AttributeKey, number>;
  state: { form: number; fitness: number; morale: number };
  context: { tacticalFit: number; squadStatus: number; positionProficiency: number };
  relationships: { managerTrust: number; captain: number; rival: number; fans: number; agent: number };
  tags: string[];
  appliedSourceIds: string[];
  activeEffects: Effect[];
  deferredEffects: Effect[];
  resolvedEventIds: string[];
  rngState: RngState;
  rulesetVersion: string;
  contentPackVersion: string;
  player: { draft: PlayerDraft; profile: PlayerProfile | null };
  pending: Pending;
  contract: Contract | null;
  timeline: TimelineEntry[];
};

export type DomainSnapshot = {
  revision: number;
  checkpoint: CheckpointType;
  state: CareerState;
  stateHash: string;
  rulesetVersion: string;
  contentPackVersion: string;
};
