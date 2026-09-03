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

// T-2-002 D-34: 감독 역할 제안 세 유형. roll 없이 rankSelection 결과로 결정론적으로 산출한다
// (season.ts computeRoleProposal 호출부 참고). `KEEP`도 명시적 타입으로 남겨 감독 신뢰
// keepConfirmTrustDelta를 적용할 근거를 갖는다.
export type RoleProposal =
  | { type: 'KEEP'; position: Position; squadRole: SquadRole }
  | {
      type: 'POSITION_CHANGE';
      from: Position;
      to: Position;
      squadRoleAfter: SquadRole;
      tacticalFitAfter: number;
      proficiencyAfter: number;
    }
  | { type: 'ROLE_CHANGE'; position: Position; from: SquadRole; to: SquadRole };

// T-2-001 D-24: 핵심 경기 챕터·계약·역할·부상·대표팀·시즌 결산 슬롯. 실제 판단 내용(챕터 판단,
// 계약 협상 등)은 T-2-003~005 몫이라 이 작업은 열고 "자동 통과"로 닫는 플레이스홀더만 둔다.
// T-2-002 D-34: ROLE 슬롯만 `ROLE_PROPOSAL`로 실제 결정이 된다(RESOLVE_ROLE로 닫는다, 자동 통과 아님).
export type Pending =
  | null
  | { kind: 'EVENT'; eventId: string; version: number }
  | { kind: 'OFFERS'; offers: Offer[] }
  | { kind: 'CHAPTER'; step: number; importance?: 'MAJOR' | 'MINOR' }
  | { kind: 'CONTRACT'; step: number }
  | { kind: 'ROLE_PROPOSAL'; step: number; proposal: RoleProposal }
  | { kind: 'INJURY'; step: number }
  | { kind: 'NATIONAL_TEAM'; step: number }
  | { kind: 'SETTLEMENT'; step: number };

// D-12: 타임라인. 문장은 넣지 않는다(웹이 팩·룰셋에서 조합). T-2-002: `ROLE_RESOLVED`의 refId는
// RoleProposal['type'].
export type TimelineEntry = {
  revision: number;
  kind:
    | 'CAREER_CONFIRMED'
    | 'EVENT_RESOLVED'
    | 'CONTRACT_SIGNED'
    | 'SEASON_STARTED'
    | 'STEP_PASSED'
    | 'SEASON_SETTLED'
    | 'ROLE_RESOLVED';
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

// T-2-002 D-26/D-34: 시즌 시작 시 포지션마다 생성하는 주전 경쟁자. `expectedPerformance`·`score`는
// 저장하지 않고 판정마다 `selection.ts`가 다시 계산한다(RULE-SEL-001은 "매 판정마다").
export type Competitor = {
  id: string;
  name: string;
  position: Position;
  archetypeId: string;
  attributes: Record<AttributeKey, number>;
  baseOvr: number;
  form: number;
  fitness: number;
  morale: number;
  tacticalFit: number;
  managerTrust: number;
  squadStatus: number;
  rolePromise: SquadRole;
};

// T-2-002 D-26/D-34: RULE-SEL-001 선발 판정 한 후보. `excluded`는 필드만 두고 값은 T-2-003·Phase 4가
// 채운다(부상·징계·대표팀 차출).
export type SelectionCandidate = {
  id: 'PLAYER' | string;
  name: string;
  baseOvr: number;
  tacticalFit: number;
  managerTrust: number;
  expectedPerformance: number;
  squadStatus: number;
  score: number;
  excluded: null | 'INJURY' | 'SUSPENSION' | 'NATIONAL_TEAM';
};

export type SelectionAppearance = 'START' | 'SUB' | 'OUT';

export type SelectionReasonComponent = 'TACTICAL_FIT' | 'MANAGER_TRUST' | 'EXPECTED_PERFORMANCE' | 'SQUAD_STATUS';

// T-2-002 D-26/D-34: `rankSelection`의 결과. `playerReason`은 선수(id 'PLAYER')와 경계 후보의 가중
// 차이가 가장 큰 구성 요소다(선수가 없거나 제외됐으면 null).
export type SelectionRanking = {
  position: Position;
  slots: number;
  benchSlots: number;
  candidates: Array<SelectionCandidate & { rank: number; appearance: SelectionAppearance }>;
  playerReason: { component: SelectionReasonComponent; delta: number } | null;
};

// T-2-001 D-24: 시즌 구조. `ageReferenceStep`은 항상 1(11 "나이·시즌 경계": 나이는 step 1 기준).
// T-2-002 D-26/D-34: `squad.competitors`는 START_SEASON에서 포지션마다 생성해 시즌 내내 고정한다.
// `selection`은 선수 현재 포지션의 최신 순위(START_SEASON·역할 결정 시 재계산). `styleId`는
// `teamId`가 속한 팀의 `tacticalStyleId` 스냅샷이다.
export type FootballSeason = {
  index: number;
  serviceSeasonId: string;
  simulationMode: SimulationMode;
  calendarId: string;
  currentStep: number;
  phase: SeasonPhase;
  steps: SeasonStep[];
  teamId: string;
  styleId: string;
  squadRole: SquadRole;
  competitions: CompetitionRecord[];
  matches: MatchRecord[];
  ageReferenceStep: 1;
  squad: { competitors: Competitor[] };
  selection: SelectionRanking;
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
