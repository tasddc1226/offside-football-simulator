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

// RULE-PLY-001: 캐릭터 프로필 정보다. 시뮬레이션 입력이 아니다(능력·성장·이벤트·계약·시장가치에
// 영향을 주지 않는다). 사용자의 실제 성별을 뜻하지 않는다.
export type PlayerGender = 'FEMALE' | 'MALE' | 'UNSPECIFIED';

/** DRAFT 단계에서 채워 나가는 7개 필드. CONFIRM_PLAYER는 전부 non-null을 요구한다. */
export type PlayerDraft = {
  name: string | null;
  gender: PlayerGender | null;
  nationalityCode: string | null;
  preferredFoot: PreferredFoot | null;
  position: Position | null;
  archetypeId: string | null;
  backgroundId: string | null;
};

/**
 * CONFIRM_PLAYER가 룰셋·rng로 확정하는 선수 정체성·잠재력·Base OVR. RULE-PLY-001: `preferredPosition`은
 * 생성 시 고른 최초 선호 포지션으로 Career 동안 보존되고, `primaryPosition`은 현재 주포지션이며 생성
 * 시 `preferredPosition`과 같은 값에서 시작해 포지션 전환으로만 바뀐다.
 */
export type PlayerProfile = {
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

// T-2-001 D-24: 핵심 경기 챕터·계약·역할·부상·대표팀·시즌 결산 슬롯. 실제 판단 내용(챕터 판단,
// 계약 협상 등)은 T-2-002~005 몫이라 이 작업은 열고 "자동 통과"로 닫는 플레이스홀더만 둔다.
export type Pending =
  | null
  | { kind: 'EVENT'; eventId: string; version: number }
  | { kind: 'OFFERS'; offers: Offer[] }
  | { kind: 'CHAPTER'; step: number; importance?: 'MAJOR' | 'MINOR' }
  | { kind: 'CONTRACT'; step: number }
  | { kind: 'ROLE'; step: number }
  | { kind: 'INJURY'; step: number }
  | { kind: 'NATIONAL_TEAM'; step: number }
  | { kind: 'SETTLEMENT'; step: number };

// D-12: 타임라인. 문장은 넣지 않는다(웹이 팩·룰셋에서 조합).
export type TimelineEntry = {
  revision: number;
  kind: 'CAREER_CONFIRMED' | 'EVENT_RESOLVED' | 'CONTRACT_SIGNED' | 'SEASON_STARTED' | 'STEP_PASSED' | 'SEASON_SETTLED';
  refId: string | null;
  age: number;
  step: number;
};

// T-2-001 DATA-SEA-001(브리프 데이터 계약): 시즌 안 step 하나의 결정 슬롯. `skippedByBudget`은
// RULE-TIME-004 결정 예산 절단이 이 슬롯을 영구히 잘라냈다는 표시다(다음 시즌 후보는 Phase 2 후반 몫).
export type DecisionSlot = {
  kind: 'EVENT' | 'CHAPTER' | 'CONTRACT' | 'ROLE' | 'INJURY' | 'NATIONAL_TEAM' | 'SETTLEMENT';
  required: boolean;
  importance?: 'MAJOR' | 'MINOR';
  refId?: string;
  skippedByBudget?: boolean;
};

export type StepSummary = { passedAtRevision: number; decisionsOpened: number; matchesPlayed: number };

export type SeasonStep = {
  index: number;
  phase: SeasonPhase;
  windowOpen: boolean;
  decisionSlots: DecisionSlot[];
  summary: StepSummary | null;
};

export type CompetitionRecord = {
  competitionId: string;
  kind: 'LEAGUE' | 'CUP';
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  position: number | null;
  cupRound: string | null;
};

/** 이 작업은 타입만 정의한다(값은 T-2-003). `season.matches`는 이 작업에서 항상 []다. */
export type MatchRecord = {
  id: string;
  step: number;
  competitionId: string;
  opponentTeamId: string;
  home: boolean;
  result: { goalsFor: number; goalsAgainst: number } | null;
};

// T-2-001 D-24: 시즌 구조. `ageReferenceStep`은 항상 1(11 "나이·시즌 경계": 나이는 step 1 기준).
export type FootballSeason = {
  index: number;
  serviceSeasonId: string;
  simulationMode: SimulationMode;
  calendarId: string;
  currentStep: number;
  phase: SeasonPhase;
  steps: SeasonStep[];
  teamId: string;
  squadRole: SquadRole;
  competitions: CompetitionRecord[];
  matches: MatchRecord[];
  ageReferenceStep: 1;
};

export type SeasonSummary = {
  index: number;
  simulationMode: SimulationMode;
  teamId: string;
  competitions: CompetitionRecord[];
  settledAtRevision: number;
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
  season: FootballSeason | null;
  seasonHistory: SeasonSummary[];
};

export type DomainSnapshot = {
  revision: number;
  checkpoint: CheckpointType;
  state: CareerState;
  stateHash: string;
  rulesetVersion: string;
  contentPackVersion: string;
};
