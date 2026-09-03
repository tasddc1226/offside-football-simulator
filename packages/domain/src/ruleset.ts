import type { AttributeKey, DecisionSlot, Position, SeasonPhase, SquadRole, StatGroup } from './types.js';

// D-2: 아키타입 카탈로그. roleWeights 합은 1(±1e-9), template은 20키 전부.
export type Archetype = {
  id: string;
  position: Position;
  name: string;
  summary: string;
  roleWeights: Partial<Record<AttributeKey, number>>;
  template: Record<AttributeKey, number>;
  potentialRange: { min: number; max: number };
};

// D-5: 배경 3종. state/context/relationships는 CareerState의 같은 필드 타입 그대로.
export type Background = {
  id: string;
  name: string;
  blurb: string;
  startTeamId: string;
  attributeDeltas: Partial<Record<AttributeKey, number>>;
  state: { form: number; fitness: number; morale: number };
  context: { tacticalFit: number; squadStatus: number; positionProficiency: number };
  relationships: { managerTrust: number; captain: number; rival: number; fans: number; agent: number };
};

// T-2-002 D-34: 팀 확장. `leagueId`는 `League.id`, `tacticalStyleId`는 `TacticalStyle.id`를 가리킨다.
// `squadStrength`는 주전 평균 Base OVR 목표(40~90)로, 경쟁자 Base OVR을 `squadStrength ± ovrSpread`
// 안에 맞추는 기준값이다.
export type Team = {
  id: string;
  name: string;
  leagueTier: 'YOUTH' | 1 | 2 | 3;
  reputation: number;
  wageBandId: string;
  leagueId: string;
  tacticalStyleId: string;
  squadStrength: number;
};

// T-2-002 D-34: 리그 하나. `teamCount`는 이름 있는 팀 + 이름 없는 상대를 합한 총 팀 수(T-2-003이
// 이름 없는 상대를 strength로 파생한다). `rounds`는 항상 2(홈·원정 2회전).
export type League = { id: string; name: string; tier: 'YOUTH' | 1 | 2 | 3; teamCount: number; rounds: 2; strength: number };

// T-2-002 D-34: 컵 대회 하나. `rounds`는 항상 4라운드 고정 순서(R1 → R2 → SEMI → FINAL)다(content
// 스키마가 정확한 값·순서를 강제한다. 여기서 튜플 타입을 쓰지 않는 이유는 JSON에서 그대로 `as Ruleset`
// 캐스팅하는 fixture 로더들이 배열 리터럴을 튜플로 좁혀 추론하지 않기 때문이다).
export type Cup = { id: string; name: string; tiers: Array<'YOUTH' | 1 | 2 | 3>; rounds: Array<'R1' | 'R2' | 'SEMI' | 'FINAL'> };

// T-2-002 D-26/D-34: 팀 전술 스타일. `slots` 8포지션 합은 11, `roleWeights[position]` 합은 1.
// `preferredArchetypeIds[position]`은 그 포지션 아키타입 중 감독이 선호하는 1~2개다.
export type TacticalStyle = {
  id: string;
  name: string;
  summary: string;
  formation: string;
  slots: Record<Position, number>;
  benchSlots: Record<Position, number>;
  roleWeights: Record<Position, Partial<Record<AttributeKey, number>>>;
  preferredArchetypeIds: Record<Position, string[]>;
};

// T-2-002 D-34: RULE-PERF-001·RULE-SEL-001·역할 제안·경쟁자 생성이 쓰는 상수 묶음. `selection.ts`가
// 소비한다.
export type SelectionRules = {
  performanceWeights: { baseOvr: number; tacticalFit: number; form: number; fitness: number; morale: number };
  selectionWeights: { tacticalFit: number; managerTrust: number; expectedPerformance: number; squadStatus: number };
  tacticalFitWeights: { style: number; archetype: number };
  positionFamiliarity: { natural: number; trained: number; makeshift: number };
  proficiencyThresholds: { natural: number; trained: number };
  positionAdjacency: Record<Position, Position[]>;
  proficiencyOnChange: { adjacent: number; other: number };
  squadStatusRule: {
    captainBonus: { NONE: number; VICE: number; CAPTAIN: number };
    ratingNeutral: number;
    ratingScale: number;
    ratingAdjMax: number;
  };
  competitorRule: {
    perPosition: number;
    preferredArchetypeShare: number;
    ovrSpread: number;
    managerTrustBase: number;
    managerTrustSpread: number;
  };
  roleProposal: { acceptTrustDelta: number; declineTrustDelta: number; keepConfirmTrustDelta: number };
};

// T-2-003 D-35: 경기 결과(diff 구간 → 승·무·패 정수 확률, 합 100). 구간은 연속이어야 한다(content
// 스키마가 검사).
export type ResultTableRow = { diffMin: number; diffMax: number; win: number; draw: number; loss: number };

// T-2-003 D-35: 득점 rollInt 2회 표. WIN은 (winnerGoals, min(loserGoalsRaw, winnerGoals-1)),
// LOSS는 대칭(상대가 winnerGoals, 우리가 min(loserGoalsRaw, winnerGoals-1)), DRAW는 roll1(drawGoals)만
// 쓰고 roll2(loserGoalsRaw)는 소비만 하고 버린다(RNG 순서 고정 목적, match.ts 참고).
export type MatchScoreTable = { winnerGoals: number[]; loserGoalsRaw: number[]; drawGoals: number[] };

// T-2-003 D-35: START 출전 시간 후보 하나(roll 1회로 이 표에서 고른다). subOut이 false면 90분,
// true면 minute에 교체 아웃.
export type MinutesStartOption = { subOut: boolean; minute: number };

export type MatchMinutesTable = { start: MinutesStartOption[]; sub: number[] };

// T-2-003 D-35: 관여량 구간(0~100)별 정수 분포 표. roll 1회로 `values`에서 고른다.
export type StatBucket = { min: number; max: number; values: number[] };
export type StatDistributionTable = StatBucket[];

// T-2-003 D-35: 포지션군별 카드 확률(roll100 1회, 백분율 정수). yellow+red는 100 이하.
export type DisciplineTable = Record<StatGroup, { yellow: number; red: number }>;

export type MatchInjuryRules = {
  perMatchPercent: number;
  lowFitnessBelow: number;
  lowFitnessExtraPercent: number;
  outMatches: { min: number; max: number };
};

// T-2-003 8번 규칙: `ratingTenths = clamp(60 + Σ 항목별 가중치 + 결과 보정 − 카드 보정, 40, 100)`.
export type MatchRatingWeights = {
  stats: Record<StatGroup, Partial<Record<string, number>>>;
  resultBonusTenths: { WIN: number; DRAW: number; LOSS: number };
  cardPenaltyTenths: { yellow: number; red: number };
};

// T-2-003 D-35: 경기 계산 상수 묶음(`packages/content` 소유, `schedule.ts`·`match.ts`가 소비).
export type MatchRules = {
  homeBonus: number;
  resultTable: ResultTableRow[];
  scoreTable: MatchScoreTable;
  minutesTable: MatchMinutesTable;
  involvement: { performanceWeight: number; opponentStrengthWeight: number; rollMin: number; rollMax: number };
  statTables: Record<StatGroup, Record<string, StatDistributionTable>>;
  disciplineTable: DisciplineTable;
  yellowSuspensionAt: number;
  redSuspension: { min: number; max: number };
  injury: MatchInjuryRules;
  ratingWeights: MatchRatingWeights;
  /** 경쟁자 `form`만 경기 index 기반으로 결정론적으로 흔든다(roll 없음). */
  competitorFormDrift: { amplitude: number };
  /** `{league}`·`{n}` 토큰을 치환해 이름 없는 상대 이름을 만든다. */
  opponentNameTemplate: string;
  cupStrengthByRound: Record<'R1' | 'R2' | 'SEMI' | 'FINAL', number>;
  cleanSheetMinMinutes: number;
};

// D-9: 제안 분기·규칙. 이 작업에서는 타입만 정의하고 사용하지 않는다(T-1-005가 소비한다).
export type OfferBranch = {
  id: string;
  requireTags: string[];
  forbidTags?: string[];
  fixedTeamId?: string;
  tiers: Array<'YOUTH' | 1 | 2 | 3>;
  fixedCount?: number;
  topTierMinOvr?: number;
};

export type OfferRules = {
  maxOffers: number;
  countBonusTags: string[];
  branches: OfferBranch[];
  rolePromiseByTier: Record<'1' | '2' | '3' | 'YOUTH', SquadRole[]>;
  lengthSeasons: { min: number; max: number };
  shirtNumber: { min: number; max: number };
  tacticalFitEstimate: { min: number; max: number };
};

// D-9: 계약 규칙(wage band 표). 이 작업에서는 타입만 정의하고 사용하지 않는다(T-1-005가 소비한다).
export type ContractRules = {
  ovrBands: Array<{ id: string; maxOvr: number }>;
  wageBands: Record<string, Record<string, number>>;
  signingBonus: Record<string, Record<string, number>>;
  squadStatusByRole: Record<SquadRole, number>;
  newClubManagerTrust: number;
  /** T-2-005 D-39: 출전 약속 이행 판정 기준(minutesShareBp 이상인 가장 높은 역할). */
  promiseMinutesShareBp: Record<SquadRole, number>;
};

// T-2-005 D-39: 성장식이 쓰는 연령대·능력 그룹.
export type GrowthAgeBand = 'U21' | 'PRIME' | 'VETERAN';
export type GrowthAttributeGroup = 'TECHNICAL' | 'PHYSICAL' | 'MENTAL' | 'GOALKEEPING';

// T-2-005 D-39: 결산 성장식 상수(`packages/content` 소유, `growth.ts`가 소비).
export type GrowthRules = {
  budgetCenti: Record<GrowthAgeBand, number>;
  gapCap: number;
  minutesFull: number;
  minutesFloorBp: number;
  experiencePerRatedMatchCenti: number;
  experienceCapCenti: number;
  goodRatingTenths: number;
  goodRatingBonusCenti: number;
  roleWeightScale: number;
  baseShareBp: number;
  focusShareBp: number;
  seasonDeltaMin: number;
  seasonDeltaMax: number;
  /** 오름차순 구간표, 마지막 원소의 maxAge는 항상 99. */
  ageCurves: Record<GrowthAttributeGroup, Array<{ maxAge: number; multBp: number }>>;
  decline: Record<GrowthAttributeGroup, { startAge: number; perYearCenti: number }>;
};

// T-2-005 D-39: 시즌 중 매 step 경기 뒤 폼·체력·사기 갱신 상수(`packages/content` 소유, `condition.ts`가 소비).
export type ConditionRules = {
  formPivotTenths: number;
  formDivisorTenths: number;
  formStepMax: number;
  formDriftPerStep: number;
  fitnessRecoveryPerStep: number;
  fitnessCostMinutes: number;
  injuryFitnessCost: number;
  moraleWin: number;
  moraleLoss: number;
  moraleStart: number;
  moraleNotSelected: number;
  moraleUnusedSub: number;
  moraleStepMax: number;
};

// T-2-001 D-33: 룰셋 slot 정의(step 안의 결정 슬롯 후보). `FootballSeason.steps[].decisionSlots`는
// 시즌 시작 시 이 목록에서 결정 예산(RULE-TIME-004)을 적용해 만든다.
export type LeagueCalendarSlot = Pick<DecisionSlot, 'kind' | 'required' | 'importance'>;

export type LeagueCalendarStep = {
  index: number;
  phase: SeasonPhase;
  windowOpen: boolean;
  slots: LeagueCalendarSlot[];
};

// D-33/D-34: 기본 캘린더는 RULE-TIME-001 표 그대로다. `cupRounds`는 R1(step 5)·R2(7)·SEMI(9)·FINAL(11).
export type LeagueCalendar = {
  id: string;
  steps: LeagueCalendarStep[];
  transferWindowStep: number;
  cupRounds: Array<{ round: 'R1' | 'R2' | 'SEMI' | 'FINAL'; step: number }>;
};

// D-8: 룰셋 데이터는 콘텐츠 패키지가 소유하고, domain은 이 타입으로 입력만 받는다.
export type Ruleset = {
  version: string;
  positions: Position[];
  archetypes: Archetype[];
  backgrounds: Background[];
  nationalities: Array<{ code: string; name: string }>;
  draftRules: { nameMin: number; nameMax: number };
  scoutRange: { minBelow: { min: number; max: number }; maxAbove: { min: number; max: number } };
  teams: Team[];
  offerRules: OfferRules;
  contractRules: ContractRules;
  leagueCalendar: LeagueCalendar;
  /** T-2-001 D-25 SETTLE_SEASON: 시즌 경계에서 폼·체력·사기가 회귀하는 상수(11 "나이·시즌 경계"). */
  seasonBoundaryReset: { form: number; fitness: number; morale: number };
  /** T-2-002 D-34: 리그·컵 카탈로그(T-2-003이 일정 생성에 쓴다. 이 작업은 데이터만 소유). */
  leagues: League[];
  cups: Cup[];
  tacticalStyles: TacticalStyle[];
  /** T-2-002 D-34: 경쟁자 이름 풀. 중복 없이 뽑는다. */
  competitorNames: string[];
  selectionRules: SelectionRules;
  /** T-2-003 D-35: 경기 계산 상수. */
  matchRules: MatchRules;
  /** T-2-005 D-39: 결산 성장식 상수. */
  growthRules: GrowthRules;
  /** T-2-005 D-39: 시즌 중 폼·체력·사기 갱신 상수. */
  conditionRules: ConditionRules;
};
