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

// T-2-003 D-35: 브리프 데이터 계약(`PositionStats.group`)이 쓰는 포지션군 약어. 화면용 `PositionGroup`
// ('DEF'|'MID'|'FWD')과 다른 별개 리터럴 집합이다(경기 통계 전용, 섞지 않는다).
export type StatGroup = 'GK' | 'DF' | 'MF' | 'FW';

export function statGroupOf(position: Position): StatGroup {
  switch (position) {
    case 'GK':
      return 'GK';
    case 'CB':
    case 'FB':
      return 'DF';
    case 'DM':
    case 'CM':
    case 'AM':
      return 'MF';
    case 'W':
    case 'ST':
      return 'FW';
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

// T-2-003 D-35: 경기 단위 선발·교체 출전·결장(RULE-SEL-001 결과). `SquadRole`(시즌 지위)과 섞지
// 않는다(02 "구분 유지").
export type MatchAppearance = 'START' | 'SUB' | 'OUT';

export type OutReason = null | 'NOT_SELECTED' | 'UNUSED_SUB' | 'INJURY' | 'SUSPENSION';

// T-2-003 D-35 데이터 계약: 포지션군별 필수 통계(03 "포지션별 결과"). 전환율(FW)은 goals/shots
// 파생값이라 저장하지 않는다.
export type PositionStats =
  | { group: 'FW'; goals: number; assists: number; xgCenti: number; shots: number; offsides: number }
  | {
      group: 'MF';
      assists: number;
      chancesCreated: number;
      progressivePasses: number;
      passesAttempted: number;
      passesCompleted: number;
      ballRecoveries: number;
    }
  | { group: 'DF'; tackles: number; interceptions: number; aerialsWon: number; goalsConcededInvolved: number; cleanSheet: boolean }
  | { group: 'GK'; saves: number; psxgMinusGoalsCenti: number; cleanSheet: boolean; crossesClaimed: number; buildUpPasses: number };

// PositionStats.group의 리터럴은 StatGroup과 같은 값이다(선언은 각 분기 리터럴로 유지 — 판별
// 유니온의 narrowing이 `group: StatGroup`보다 `group: 'FW'` 같은 리터럴에서 더 잘 동작한다).

/**
 * `SeasonPlayerStats.totals`의 실제 타입(브리프 "totals: PositionStats, boolean은 count"). `PositionStats`와
 * 같은 항목이지만 `cleanSheet: boolean` 자리가 시즌 누적 횟수(number)로 바뀐다.
 */
export type PositionStatsTotals =
  | { group: 'FW'; goals: number; assists: number; xgCenti: number; shots: number; offsides: number }
  | {
      group: 'MF';
      assists: number;
      chancesCreated: number;
      progressivePasses: number;
      passesAttempted: number;
      passesCompleted: number;
      ballRecoveries: number;
    }
  | { group: 'DF'; tackles: number; interceptions: number; aerialsWon: number; goalsConcededInvolved: number; cleanSheet: number }
  | { group: 'GK'; saves: number; psxgMinusGoalsCenti: number; cleanSheet: number; crossesClaimed: number; buildUpPasses: number };

export type StepMatchResult = {
  matchId: string;
  outcome: 'WIN' | 'DRAW' | 'LOSS';
  goalsFor: number;
  goalsAgainst: number;
  appearance: MatchAppearance;
  ratingTenths: number | null;
};

export type StepSummary = {
  passedAtRevision: number;
  decisionsOpened: number;
  matchesPlayed: number;
  results: StepMatchResult[];
};

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

// T-2-003 D-35: 시즌 시작 시 확정하는 일정 한 항목(roll 없음). `opponentId`는 룰셋 `teams`의 실제
// id이거나 이름 없는 상대(`${leagueId}-opp-${n}`) 또는 컵 라운드 상대(`${cupId}-${round}`)다.
// `skipped`는 컵 탈락 뒤 남은 라운드를 표시한다(경기를 돌리지 않는다).
export type ScheduleEntry = {
  step: number;
  order: number;
  competitionId: string;
  kind: 'LEAGUE' | 'CUP';
  round: string | null;
  opponentId: string;
  home: boolean;
  skipped?: 'ELIMINATED';
};

// T-2-001이 타입만 두었던 것을 T-2-003이 확정한다(브리프 데이터 계약 D-35).
export type MatchRecord = {
  id: string;
  step: number;
  order: number;
  competitionId: string;
  kind: 'LEAGUE' | 'CUP';
  round: string | null;
  opponent: { id: string; name: string; strength: number };
  home: boolean;
  result: { goalsFor: number; goalsAgainst: number; outcome: 'WIN' | 'DRAW' | 'LOSS' };
  appearance: MatchAppearance;
  outReason: OutReason;
  minutes: number;
  involvement: number;
  stats: PositionStats;
  ratingTenths: number | null;
  cards: { yellow: 0 | 1 | 2; red: boolean };
  injuredOff: boolean;
  chapterId: string | null;
};

// T-2-003 D-35: 시즌 누계(결산 이전 진행 중 값). `totals`의 boolean 필드는 누적 횟수(count)다.
export type SeasonPlayerStats = {
  group: StatGroup;
  appearances: { total: number; started: number; sub: number; zeroMinute: number; out: number };
  minutes: number;
  ratingSumTenths: number;
  ratedMatches: number;
  yellow: number;
  red: number;
  injuries: number;
  totals: PositionStatsTotals;
};

// T-2-003 D-35: 부상·정지만 표현한다(능력치·재활은 Phase 4). `excluded`(SelectionCandidate)와 같은
// 문자열('INJURY' | 'SUSPENSION')을 쓴다.
export type Availability = null | { kind: 'INJURY' | 'SUSPENSION'; matchesRemaining: number; sinceMatchId: string };

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
  /** T-2-005 D-39: `startSeason`이 만든 시즌 시작 시점 squadRole(이후 RESOLVE_ROLE로도 바뀌지 않는다).
   * `SeasonResult.selectionSummary.squadRoleAtStart`가 쓴다 — D-39가 요구하는 필드지만 별도 저장소가
   * 없어 이 자리에 추가했다(PR 본문 "범위 밖 발견 사항" 참고). */
  squadRoleAtStart: SquadRole;
  /** T-2-005 D-39: 이 시즌 훈련 초점(ROLE = 아키타입 roleWeights 그대로). */
  trainingFocus: TrainingFocus;
  competitions: CompetitionRecord[];
  /** T-2-003 D-35: roll 없이 시즌 시작 시 확정하는 리그·컵 일정(step·order 순 정렬). */
  schedule: ScheduleEntry[];
  matches: MatchRecord[];
  ageReferenceStep: 1;
  squad: { competitors: Competitor[] };
  selection: SelectionRanking;
  /** T-2-003 D-35: 시즌 누계 통계(포지션군은 선수 현재 primaryPosition 기준으로 고정). */
  playerStats: SeasonPlayerStats;
  availability: Availability;
  /** T-2-003 8번 규칙: 직전 평점(×10 정수). Squad Status 재계산의 lastRating 입력. */
  lastRatingTenths: number | null;
  /** T-2-003 D-35: 경고 정지 기준(`yellowSuspensionAt`) 판정용 누적 경고 수. 정지가 걸리면 0으로
   * 리셋된다(`playerStats.yellow`는 시즌 통계 누계라 리셋되지 않는다 — 이 필드와는 다른 값이다). */
  yellowSuspensionCount: number;
  /** T-2-003 D-35: 경기 전용 RNG 스트림(브리프 "FAST와 CHAPTER의 matches가 byte-identical"). 결정
   * 슬롯(EVENT 가중치 등)이 소비하는 `CareerState.rngState`와 분리해, 경기 결과가 모드별 결정 타이밍에
   * 영향받지 않게 한다. START_SEASON에서 mode를 쓰기 전 시점의 `state.rngState`로 시드한다. */
  matchRngState: RngState;
  /** T-2-005 D-39, 오케스트레이터 리뷰 2차(R2-1): 이번 시즌에 적용 예정인 DEFERRED 효과 목록
   * (`appliesAt.kind === 'NEXT_SEASON_STEP'`). `startSeason`이 그 시점의 `state.deferredEffects`
   * 전부를 이 필드로 옮겨 채운다(season이 없으면 step 번호를 해석할 대상이 없어 미룰 수 없으므로,
   * season 배정 전에 미룬 효과는 여기가 아니라 `state.deferredEffects`에 쌓여 있다가 옮겨진다).
   * `resolveDeferredEffects`가 매 step 이 목록에서 `appliesAt.step === step`인 항목을 꺼내 적용하고
   * 지운다 — `state.deferredEffects`가 아니라 이 필드를 읽고 쓴다(예전엔 `state.deferredEffects`를
   * `START_SEASON`이 곧바로 비웠기 때문에 실제로는 한 번도 적용되지 않는 버그였다). */
  scheduledEffects: Effect[];
};

// T-2-005 D-39: 결산 성장 원인 태그와 훈련 초점(ROLE = 아키타입 roleWeights 그대로).
export type GrowthCause = 'TRAINING' | 'MINUTES' | 'EXPERIENCE' | 'AGE_DECLINE' | 'POTENTIAL_CAP';
export type TrainingFocus = 'ROLE' | 'TECHNICAL' | 'PHYSICAL' | 'MENTAL';

/**
 * T-2-005: T-2-004(핵심 경기 챕터)가 아직 main에 없어 실제 형태를 모른다 — `SeasonResult.chapters`
 * 타입만 필요한 자리에 두는 플레이스홀더다. T-2-004가 머지되면 그쪽 정의가 정본이고, 이 타입은
 * 병합 시 그 정의로 맞춘다(브리프: "두 작업 모두 types.ts를 건드리므로 충돌은 예상된 것이다").
 */
export type ChapterRecord = { id: string; step: number };

// T-2-005 D-39: SETTLE_SEASON이 만드는 시즌 결산 결과. `seasonHistory`에 그대로 남는다(FootballSeason에는
// 두지 않는다 — season은 다음 START_SEASON에서 교체된다). 02 DATA-SEA-001은 `result?: SeasonResult`로
// 적었지만 이 브리프(D-39)가 "결산은 항상 result를 만든다"로 확정해 필수 필드로 둔다.
export type SeasonResult = {
  index: number;
  simulationMode: SimulationMode;
  teamId: string;
  competitions: CompetitionRecord[];
  playerStats: SeasonPlayerStats;
  selectionSummary: {
    squadRoleAtStart: SquadRole;
    squadRoleAtEnd: SquadRole;
    started: number;
    sub: number;
    zeroMinute: number;
    out: number;
    minutes: number;
    possibleMinutes: number;
    finalRank: number;
  };
  roleChanges: Array<{ step: number; type: RoleProposal['type']; decision: 'ACCEPT' | 'DECLINE' }>;
  promiseFulfilment: { promised: SquadRole; delivered: SquadRole; fulfilled: boolean; minutesShareBp: number };
  attributeDeltas: Array<{ key: AttributeKey; delta: number; causes: Array<{ cause: GrowthCause; centi: number }> }>;
  baseOvr: { before: number; after: number };
  stateDeltas: {
    form: { before: number; after: number };
    fitness: { before: number; after: number };
    morale: { before: number; after: number };
    managerTrust: { before: number; after: number };
  };
  chapters: ChapterRecord[];
  hash: string;
};

export type SeasonSummary = {
  index: number;
  simulationMode: SimulationMode;
  teamId: string;
  competitions: CompetitionRecord[];
  settledAtRevision: number;
  result: SeasonResult;
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
  /** T-2-005 D-39: 성장식 이월(정수 centi, 1/100). 결산 시 매번 갱신된다. */
  growthCarryCenti: Record<AttributeKey, number>;
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
