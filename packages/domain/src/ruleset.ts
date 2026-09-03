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

export type Team = {
  id: string;
  name: string;
  leagueTier: 'YOUTH' | 1 | 2 | 3;
  reputation: number;
  wageBandId: string;
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

// D-33: 기본 캘린더는 RULE-TIME-001 표 그대로다. `cupRounds`는 R1(step 5)·SEMI(9)·FINAL(11).
export type LeagueCalendar = {
  id: string;
  steps: LeagueCalendarStep[];
  transferWindowStep: number;
  cupRounds: Array<{ round: 'R1' | 'SEMI' | 'FINAL'; step: number }>;
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
};
