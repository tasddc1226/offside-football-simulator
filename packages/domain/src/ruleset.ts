import type { AttributeKey, DecisionSlot, Position, SeasonPhase, SquadRole } from './types.js';

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
};
