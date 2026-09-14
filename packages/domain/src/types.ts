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

// T-2-004 D-38: 핵심 경기 챕터 후보가 이 step의 경기에 맞는지 판정하는 조건. TAG는 Phase 3+ 용으로
// 스키마·타입만 두고(`state.tags` 판정), 이번 작업의 3종 팩(DEBUT·DERBY·DECIDER)은 쓰지 않는다.
export type ChapterTrigger =
  | { kind: 'DEBUT' }
  | { kind: 'DERBY' }
  | { kind: 'CUP_FINAL' }
  | { kind: 'DECIDER'; maxRankGap: number }
  | { kind: 'INJURY_RETURN' }
  | { kind: 'NATIONAL_DEBUT' }
  | { kind: 'TAG'; tag: string };

// T-2-014 D-42: RESOLVE_CHAPTER outcome·ChapterRecord.decisions[]가 남기는 결과 종류(content
// `event.ts`의 `OUTCOME_KINDS`와 같은 값).
export type ChapterOutcomeKind = 'SUCCESS' | 'NEUTRAL' | 'FAIL' | 'FIXED';

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

// T-2-014 D-42: 커리어 태그 카탈로그 ID 16종(14 "커리어 태그 카탈로그" 표 순서 그대로). 이 목록은
// types.ts가 소유해 ATTRIBUTE_KEYS와 같은 패턴으로 순환 import 없이 공유한다 — 카탈로그 내용
// (라벨·희귀도·평가 시점·소유 Phase·평가기)은 career-tags.ts가 소유하고 이 목록을 재수출한다.
export const CAREER_TAG_IDS = [
  'TAG-ONE-CLUB',
  'TAG-JOURNEYMAN',
  'TAG-LOAN-LEGEND',
  'TAG-BIG-GAME',
  'TAG-GLASS-GENIUS',
  'TAG-MANAGER-FAVOURITE',
  'TAG-LOCKER-LEADER',
  'TAG-PROMOTION-EXPERT',
  'TAG-DERBY-HERO',
  'TAG-TRAITOR',
  'TAG-LATE-BLOOMER',
  'TAG-IRONMAN',
  'TAG-COMEBACK',
  'TAG-MENTOR',
  'TAG-CONTROVERSIAL',
  'TAG-UNCROWNED',
] as const;

export type CareerTagId = (typeof CAREER_TAG_IDS)[number];

// T-2-014 D-42: 태그 하나가 부여된 기록.
export type CareerTagGrant = { tagId: CareerTagId; seasonIndex: number; atRevision: number; sourceRefId: string };

// T-4-001 D-49: HEALTH는 activeEffects에 저장되지 않는 즉발 효과 kind다(applyEffects 참고).
export type EffectKind = 'PERMANENT' | 'CURRENT' | 'CONTEXT' | 'RELATION' | 'DEFERRED' | 'HEALTH';

// D-40 규칙 2: `ONCE_PER_SOURCE`는 커리어 전체 1회, 신규 `ONCE_PER_SEASON`은 시즌마다 1회
// (`appliedSourceIds`에 `season:<index>:<sourceId>`로 기록 — effects.ts 참고).
export type EffectStackingRule = 'ONCE_PER_SOURCE' | 'ONCE_PER_SEASON' | 'REPLACE' | 'SUM';

// D-40 규칙 3: 기존 `STEPS_AFTER`(저장 시 `AT_STEP`으로 치환)에 신규 `AT_SEASON_END`(결산 직전
// 되돌림)·`SEASONS_AFTER`(저장 시 `AT_SEASON_INDEX`로 치환)가 더해진다. `AT_STEP`은 시즌 경계를
// 넘기면(다음 시즌 같은 step을 기다리지 않고) 결산 직전 강제 만료된다(effects.ts `expireAtSeasonEnd`).
export type EffectExpiresAt =
  | null
  | { kind: 'STEPS_AFTER'; steps: number }
  | { kind: 'AT_STEP'; step: number }
  | { kind: 'AT_SEASON_END' }
  | { kind: 'SEASONS_AFTER'; seasons: number }
  | { kind: 'AT_SEASON_INDEX'; index: number };

export type Effect = {
  kind: EffectKind;
  sourceId: string;
  target: string;
  delta: number;
  clamp: { min: number; max: number };
  appliesAt: { kind: 'IMMEDIATE' } | { kind: 'NEXT_SEASON_STEP'; step: number };
  expiresAt: EffectExpiresAt;
  stackingRule: EffectStackingRule;
  /** D-40 규칙 6: 결과 원인 태그(선택, 04 "결과가 0이면… 원인 문구"). */
  reasonTag?: string;
  /** D-40 규칙 4: `stackingRule === 'REPLACE'`이고 `expiresAt`이 있는 효과가 `activeEffects`에
   * 저장될 때 `applyEffects`가 채우는 적용 전 원래 값(만료 시 이 값으로 복원한다). 콘텐츠가 직접
   * 채우지 않는다(content `EffectSchema`는 이 필드를 모른다). */
  restoreTo?: number;
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

// T-3-001 D-44: 제안 종류. RENEWAL은 현 구단 재계약, FREE_AGENT는 무소속 계약(Phase 1 첫 계약 포함).
export type OfferKind = 'RENEWAL' | 'TRANSFER' | 'LOAN' | 'FREE_AGENT';

// T-3-001 D-44: 협상 1회의 대상 항목.
export type NegotiationAsk = 'WAGE' | 'ROLE' | 'LENGTH';

// T-3-001 D-44: 저장 상태에 남기는 협상 상태(GENERATED·OFFERED·ACCEPTED·REJECTED·EXPIRED는 pending
// 목록 존재 여부·타임라인으로 표현하고 저장 필드로 중복하지 않는다).
export type NegotiationState = 'OPEN' | 'COUNTERED' | 'WITHDRAWN';

// D-9, T-3-001 D-44 확장: 제안(offerRules 데이터는 T-1-005·T-3-002가 소비, 타입만 이 작업에서 정의).
export type Offer = {
  id: string;
  kind: OfferKind; // Phase 1 첫 계약은 'FREE_AGENT'
  teamId: string;
  teamName: string;
  fromTeamId: string | null; // RENEWAL이면 현 구단 id, 그 외 null
  leagueTier: 'YOUTH' | 1 | 2 | 3;
  lengthSeasons: number;
  wageMinorPerWeek: number;
  signingBonusMinor: number;
  transferFeeMinor: number | null; // TRANSFER만(표시용), 그 외 null
  rolePromise: SquadRole;
  appearancePromise: { minutesShareBp: number }; // Phase 1: contractRules.promiseMinutesShareBp[rolePromise]
  positionPlan: Position; // Phase 1: profile.primaryPosition
  shirtNumber: number;
  tacticalFitEstimate: number;
  competitorSummary: { rank: number; ovrGap: number } | null; // T-3-002가 채운다, Phase 1은 null
  validUntilRevision: number | null; // null = 만료 없음(Phase 1 제안·안전 잔류 제안)
  negotiable: { wage: boolean; role: boolean; length: boolean }; // Phase 1: 전부 false
  negotiationState: NegotiationState; // 생성 시 'OPEN'
  negotiatedAsk: NegotiationAsk | null; // NEGOTIATE 뒤 T-3-003이 기록, 생성 시 null
  loan: { parentTeamId: string; seasons: 1; wageShareBp: number; buyOptionMinor: number | null } | null;
};

// T-3-001 D-44/D-46: Phase 1은 항상 'PERMANENT'. 'LOAN'은 임대 계약(T-3-003이 생성).
export type ContractKind = 'PERMANENT' | 'LOAN';

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
  kind: ContractKind; // Phase 1: 'PERMANENT'
  appearancePromise: { minutesShareBp: number };
  positionPlan: Position;
  suspended: boolean; // 임대 중 원소속 계약이면 true(D-46). Phase 1: false
  loan: Offer['loan']; // kind LOAN일 때만 non-null
  promiseBreaches: number; // D-47(T-3-003이 증가), 생성 시 0
  signedSeasonIndex: number; // 서명 시점의 seasonHistory.length + 1(= 다음에 시작할 시즌)
};

// T-3-001 D-45: 소속 이력 한 항목. `toSeasonIndex: null`이면 현재 소속(clubHistory[]는 이 항목을 항상
// 포함한다). 마감·이어붙이기(다음 stint 시작)는 T-3-003 몫이다.
export type ClubStintEndReason = 'EXPIRED' | 'TRANSFERRED' | 'LOANED' | 'RETURNED' | 'RENEWED';

export type ClubStint = {
  teamId: string;
  teamName: string;
  leagueTier: Contract['leagueTier'];
  kind: ContractKind;
  fromSeasonIndex: number; // 이 소속으로 처음 시작하는 시즌 index
  toSeasonIndex: number | null; // 아직 소속이면 null
  endReason: ClubStintEndReason | null;
  contractId: string;
};

// T-3-001 D-43: 결산 뒤(또는 step 7 사전 협상) 열리는 이적시장 하나를 요약한다. 시장가치는 상태에
// 저장하지 않는다(ADR-010) — 이 요약은 "왜 열렸는가"·"안전 잔류 제안이 무엇인가"만 담는다.
export type MarketSummary = {
  openedAtRevision: number;
  seasonIndex: number; // 시장이 열린 시점의 seasonHistory.length(첫 계약은 0)
  reason: 'FIRST_CONTRACT' | 'EXPIRED' | 'INTEREST' | 'LOAN_END' | 'PRE_NEGOTIATION';
  safeOfferId: string | null; // 안전 잔류 제안 id(D-44), 첫 계약은 null
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
// T-2-004 D-38: CHAPTER 분기는 챕터 하나가 열려 판단 1~3개를 확정해 가는 동안의 진행 상태를 갖는다.
// `resolved`는 확정된 판단만 순서대로 쌓는다(재생 시 같은 decisionId를 다시 보내면 거부해 roll을
// 두 번 소비하지 않는다).
export type Pending =
  | null
  | { kind: 'EVENT'; eventId: string; version: number }
  // T-3-001 D-43/D-44: Phase 1 `generateOffers` 경로가 `market.reason: 'FIRST_CONTRACT'`를 채운다.
  | { kind: 'OFFERS'; offers: Offer[]; market: MarketSummary }
  | {
      kind: 'CHAPTER';
      step: number;
      chapterId: string;
      version: number;
      importance: 'MAJOR' | 'MINOR';
      matchId: string;
      decisionsTotal: number;
      // T-2-014 D-42: 이 챕터를 연 trigger의 kind(전체 ChapterTrigger가 아니라 판별 리터럴만 —
      // ChapterRecord.trigger와 TAG-DERBY-HERO 같은 평가기가 이 값으로 필터한다).
      trigger: ChapterTrigger['kind'];
      resolved: Array<{ decisionId: string; optionId: string; outcomeId: string; roll: number; outcomeKind: ChapterOutcomeKind }>;
      /** NATIONAL_DEBUT이면 가상 상대 메타데이터를 남긴다. 실제 클럽 경기/일정은 만들지 않는다. */
      virtualOpponent?: NationalDebutReservation;
    }
  // T-3-001 D-43 (a): step 7 재계약 사전 협상. `offers.length === 0`이면 자동 통과(지금은 생성기가
  // 없어 항상 이 상태), 1건 이상이면 정지한다(T-3-002가 채운다).
  | { kind: 'CONTRACT'; step: number; offers: Offer[]; market: MarketSummary }
  | { kind: 'ROLE_PROPOSAL'; step: number; proposal: RoleProposal }
  // T-3-001 D-52 예약(값은 T-4-002가 채운다, 생성기가 없는 지금은 형태만).
  | { kind: 'INJURY'; step: number; episodeId: string; eventId: string; version: number }
  // T-3-001 D-51 예약(값은 T-4-004가 채운다, 생성기가 없는 지금은 형태만).
  | { kind: 'NATIONAL_TEAM'; step: number; eventId: string; version: number }
  // T-3-001 D-46: 임대 시즌 결산 뒤 원소속 복귀·완전 이적 선택(생성기는 T-3-003).
  | { kind: 'LOAN_RETURN'; options: Array<'RETURN' | 'PERMANENT'>; buyOptionMinor: number | null }
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
    | 'ROLE_RESOLVED'
    | 'CHAPTER_RESOLVED'
    // T-2-014 D-42: `evaluateCareerTags`가 새 태그를 부여할 때마다 1건(refId = tagId).
    | 'CAREER_TAG_GRANTED'
    // T-3-001 D-53 표: 트랙 A(계약·임대·이적) 예약. 이 작업에서 실제로 기록하는 건 없다.
    | 'CONTRACT_RENEWED'
    | 'TRANSFERRED'
    | 'LOANED'
    | 'LOAN_RETURNED'
    | 'OFFER_REJECTED'
    | 'OFFER_EXPIRED'
    | 'NEGOTIATED'
    // T-3-001 D-53 표: 트랙 B(부상·관계·평판) 예약. 이 작업에서 실제로 기록하는 건 없다.
    | 'INJURED'
    | 'REHAB_CHOSEN'
    | 'RECOVERED'
    | 'INJURY_RECURRED'
    | 'MANAGER_CHANGED'
    | 'NATIONAL_TEAM_CALLED'
    | 'NATIONAL_TEAM_DECLINED'
    | 'CAPTAIN_APPOINTED'
    | 'CLUB_MEETING_RESOLVED'
    | 'CLUB_MEETING_GOAL_EVALUATED'
    | 'RETIRED'
    | 'SERVICE_STARTED'
    | 'SERVICE_COMPLETED'
    | 'INTERNATIONAL_TOURNAMENT'
    | 'MENTORED';
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

export type OutReason = null | 'NOT_SELECTED' | 'UNUSED_SUB' | 'INJURY' | 'SUSPENSION' | 'SERVICE';

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
export type Availability = null | { kind: 'INJURY' | 'SUSPENSION' | 'SERVICE'; matchesRemaining: number; sinceMatchId: string };

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
  excluded: null | 'INJURY' | 'SUSPENSION' | 'NATIONAL_TEAM' | 'SERVICE';
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
  /** Phase 5 opt-in ledger; absent in historical command logs (do not synthesize old income). */
  legacyContext?: { policyVersion: '1.0.0'; wageMinorPerWeek: number; signingBonusMinor: number; contractId: string };
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
  /** T-2-004 D-38: 이 시즌에 판단이 모두 끝난 핵심 경기 챕터(step·확정 순). */
  chapters: ChapterRecord[];
  /** T-2-005 D-39, 오케스트레이터 리뷰 2차(R2-1): 이번 시즌에 적용 예정인 DEFERRED 효과 목록
   * (`appliesAt.kind === 'NEXT_SEASON_STEP'`). `startSeason`이 그 시점의 `state.deferredEffects`
   * 전부를 이 필드로 옮겨 채운다(season이 없으면 step 번호를 해석할 대상이 없어 미룰 수 없으므로,
   * season 배정 전에 미룬 효과는 여기가 아니라 `state.deferredEffects`에 쌓여 있다가 옮겨진다).
   * `resolveDeferredEffects`가 매 step 이 목록에서 `appliesAt.step === step`인 항목을 꺼내 적용하고
   * 지운다 — `state.deferredEffects`가 아니라 이 필드를 읽고 쓴다(예전엔 `state.deferredEffects`를
   * `START_SEASON`이 곧바로 비웠기 때문에 실제로는 한 번도 적용되지 않는 버그였다). */
  scheduledEffects: Effect[];
  /** T-4-001 D-50: 이 시즌 감독(형태는 위 `SeasonManager` 참고). */
  manager: SeasonManager | null;
  /** T-4-001 D-49: 이 시즌에 만든 INJURY pending 수(RULE-TIME-004 상한 2). 증가는 T-4-002. */
  injuryCount: number;
};

// T-2-004 D-38: 챕터 하나가 판단을 모두 확정하면 남기는 기록. `ratingDeltaTenths`는 이 챕터가 경기
// 평점에 더한 합(정수 ×10). 판단마다 즉시 clamp(40,100)가 걸려 개별 델타의 원본 합은 복원할 수
// 없으므로(Pending.CHAPTER.resolved는 roll만 남기고 델타를 남기지 않는 고정 계약), 최종 평점에서
// 챕터가 없었을 때의 원래 평점(chapter.ts가 `computeRatingTenths`로 재도출 — match.stats·outcome·
// cards는 챕터로 바뀌지 않는 순수 입력이라 항상 같은 값을 돌려준다)을 뺀 값으로 정의한다.
export type ChapterRecord = {
  chapterId: string;
  version: number;
  step: number;
  matchId: string;
  importance: 'MAJOR' | 'MINOR';
  // T-2-014 D-42: 이 챕터를 연 trigger의 kind(`pending.trigger`에서 그대로 옮긴다).
  trigger: ChapterTrigger['kind'];
  decisions: Array<{ decisionId: string; optionId: string; outcomeId: string; outcomeKind: ChapterOutcomeKind }>;
  ratingDeltaTenths: number;
  /** NATIONAL_DEBUT이면 예약에서 소비한 가상 상대를 기록한다. */
  virtualOpponent?: NationalDebutReservation;
};

// T-2-005 D-39: 결산 성장 원인 태그와 훈련 초점(ROLE = 아키타입 roleWeights 그대로).
export type GrowthCause = 'TRAINING' | 'MINUTES' | 'EXPERIENCE' | 'AGE_DECLINE' | 'POTENTIAL_CAP';
export type TrainingFocus = 'ROLE' | 'TECHNICAL' | 'PHYSICAL' | 'MENTAL';

export type ClubMeetingRequest = 'PLAYING_TIME' | 'LOAN' | 'TRANSFER';
export type ClubMeetingEffect = { managerTrustDelta: number; moraleDelta: number };
export type ClubMeetingGoalResult = {
  request: ClubMeetingRequest;
  response: 'ACCEPTED' | 'REFUSED';
  reason: string;
  role: SquadRole;
  targetMinutesShareBp: number;
  actualMinutesShareBp: number;
  status: 'MET' | 'MISSED';
  effect: ClubMeetingEffect;
};
export type ClubMeetingState = {
  seasonIndex: number;
  request: ClubMeetingRequest;
  response: 'ACCEPTED' | 'REFUSED';
  reason: string;
  teamId: string;
  contractId: string;
  immediateEffect: ClubMeetingEffect;
  plannedRole: SquadRole;
  preferredOfferKind: 'LOAN' | 'TRANSFER' | null;
  preferenceStatus: 'PENDING' | 'OFFERED' | 'NO_CANDIDATE' | 'CANCELLED' | null;
  goal: { seasonIndex: number; role: SquadRole; targetMinutesShareBp: number; status: 'PENDING' };
};

// T-2-005 D-39: SETTLE_SEASON이 만드는 시즌 결산 결과. `seasonHistory`에 그대로 남는다(FootballSeason에는
// 두지 않는다 — season은 다음 START_SEASON에서 교체된다). 02 DATA-SEA-001은 `result?: SeasonResult`로
// 적었지만 이 브리프(D-39)가 "결산은 항상 result를 만든다"로 확정해 필수 필드로 둔다. T-2-004 머지로
// `chapters`는 이제 실제 `ChapterRecord`(placeholder `{id, step}`이 아니다).
export type SeasonResult = {
  legacy?: { policyVersion: '1.0.0'; incomeMinor: number; contractId: string; relationships: CareerState['relationships']; promotion: boolean; ageAtStart: number; injuryMissedMatches?: number };
  index: number;
  simulationMode: SimulationMode;
  teamId: string;
  /** T-4-003: 이 결산 시즌을 실제로 지휘한 감독의 id. */
  managerId: string;
  /** T-4-003: 시즌을 마친 시점의 주장단 상태(결산 승격 전 값). */
  captaincyAtEnd: 'NONE' | 'VICE' | 'CAPTAIN';
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
  clubMeetingGoal?: ClubMeetingGoalResult;
  attributeDeltas: Array<{ key: AttributeKey; delta: number; causes: Array<{ cause: GrowthCause; centi: number }> }>;
  baseOvr: { before: number; after: number };
  stateDeltas: {
    form: { before: number; after: number };
    fitness: { before: number; after: number };
    morale: { before: number; after: number };
    managerTrust: { before: number; after: number };
  };
  chapters: ChapterRecord[];
  // T-3-001(PR #45 후속): 결산 뒤 `season`이 null이 되며 사라지던 다이어리 step 요약을 보존한다.
  // `settleSeason`이 `season.steps[].summary`에서 채운다(이 작업의 유일한 로직 변경). SETTLEMENT
  // step(12)은 결산 자체라 요약이 없다 — 포함되지 않는다(길이 11, PR #48 리뷰로 확정).
  stepSummaries: Array<{ step: number; phase: SeasonPhase; matchesPlayed: number; decisionsOpened: number; passedAtRevision: number }>;
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

// T-4-002 D-49: 부상 심각도·부위·재활 계획. "활성 에피소드" = status가 ACTIVE 또는 REHAB인 것 중
// episodes 배열의 마지막 항목(effects.ts의 HEALTH 적용·조건 DSL `health.*`가 같은 규칙을 쓴다).
// 발생·재발 roll, 재활 적용, 회복 창, 후유증 갱신은 injury.ts 상태기계가 담당한다.
export type InjurySeverity = 'MINOR' | 'MODERATE' | 'MAJOR';
export type InjuryBodyPart = 'KNEE' | 'ANKLE' | 'HAMSTRING' | 'SHOULDER' | 'HEAD';
export type RehabPlan = 'EARLY' | 'STANDARD' | 'CONSERVATIVE';

export type InjuryEpisode = {
  id: string; // 형식 INJ-${seasonIndex}-${step}-${n}
  severity: InjurySeverity;
  bodyPart: InjuryBodyPart;
  occurredAt: { seasonIndex: number; step: number; matchId: string };
  diagnosisRange: { minMatches: number; maxMatches: number };
  rehab: RehabPlan | null;
  recurrenceRiskBp: number;
  /** 회복 뒤 실제 출전에서 소비할 재발 판정 횟수. 발생·재활 시 0, 회복 시 window 값. */
  recurrenceChecksRemaining: number;
  status: 'ACTIVE' | 'REHAB' | 'RECOVERED' | 'RECURRED';
  permanentDelta: Array<{ key: AttributeKey; delta: number }> | null;
  /** 활성/재활 중인 부상의 잔여 결장 경기 수. 회복 시 필드를 제거해 기존 회복 이력의 shape을 보존한다. */
  remainingMatches?: number;
};

// T-4-001 D-50: 관계 로그·기억 태그가 다루는 대상 축 5개(`CareerState.relationships`와 같은 키).
export type RelationTarget = 'managerTrust' | 'captain' | 'rival' | 'fans' | 'agent';

export type RelationshipLogEntry = {
  target: RelationTarget;
  delta: number;
  sourceId: string;
  reasonTag: string | null;
  seasonIndex: number;
  step: number;
};

// T-4-001 D-51: RESOLVE_EVENT가 NATIONAL_TEAM pending을 닫을 때 받는 선택.
export type NationalTeamCallUp = 'ACCEPT' | 'DECLINE' | 'CONDITIONAL';

/** T-4-004: nationality module은 기본 모듈 id와 예외 목록만 보존한다. 특례 의미는 이 티켓에서 모델링하지 않는다. */
export type NationalityRuleState = {
  moduleId: 'DEFAULT';
  exceptions: [];
} | import('./legacy/nationality.js').NationalityState;

export type CareerTournament = {
  sourceId: string; seasonIndex: number; age: number;
  tournament: 'ASIAN_GAMES' | 'OLYMPICS'; medal: 'GOLD' | 'SILVER' | 'BRONZE' | null;
  matches: Array<{ index: number; roll: number; won: boolean; minutes: number }>;
};

export type NationalTeamCallUpRecord = {
  seasonIndex: number;
  step: number;
  eventId: string;
  version: number;
  decision: NationalTeamCallUp;
  reason: 'INJURY' | null;
};

/** 실제 국가/협회 대신 룰셋의 결정론적 가상 상대 label만 저장한다. */
export type NationalDebutReservation = {
  opponentId: string;
  opponentName: string;
};

export type NationalTeamState = {
  callUps: NationalTeamCallUpRecord[];
  debuted: boolean;
  pendingDebut: NationalDebutReservation | null;
};

// T-4-001 D-50: 시즌 감독. `START_SEASON`이 rng 없이 기본값을 만든다(manager.ts `buildDefaultManager`).
// 교체 판정·새 감독 생성·`managerTrust` 재평가는 T-4-003.
export type SeasonManager = {
  id: string;
  name: string;
  preferredArchetypeIds: string[];
  tenureSeasons: number;
  trustBase: number;
};

export type CareerState = {
  /** Optional to preserve pre-Phase-5 snapshots and their command-log hashes. */
  legacyEvents?: { policyVersion: '1.0.0'; tournaments: CareerTournament[]; mentoredSeasonIndices: number[] };
  retirement?: { policyVersion: '1.0.0'; marketOffers: number | null; lastChanceConsumed: boolean; lastChanceSeasonIndex: number | null };
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
  /** T-2-004 D-38: `resolvedEventIds`와 같은 역할, 챕터용. `${chapterId}@${seasonIndex}` 형식이라
   * 시즌마다 같은 chapterId가 다시 후보로 남는다(더비처럼 매 시즌 열릴 수 있는 챕터를 위해). 정렬은
   * `sortUniqueTags`와 같은 코드포인트 오름차순을 유지한다. */
  resolvedChapterIds: string[];
  // T-2-014 D-42: 부여된 커리어 태그 ID(정렬·중복 없음). `tags`(콘텐츠 기억 태그, 자유 문자열)와는
  // 별개다 — 이쪽은 CAREER_TAG_IDS 카탈로그에 속한 값만 들어간다.
  careerTags: CareerTagId[];
  /** T-2-014 D-42: 태그가 부여된 순서대로 쌓는 감사 기록(`grantCareerTag`가 추가한다). */
  careerTagGrants: CareerTagGrant[];
  rngState: RngState;
  rulesetVersion: string;
  contentPackVersion: string;
  player: { draft: PlayerDraft; profile: PlayerProfile | null };
  pending: Pending;
  contract: Contract | null;
  /** 1.6.0+ optional preseason club meeting; absent in legacy snapshots. */
  clubMeeting?: ClubMeetingState;
  /** Step 7 renewal held until the current season is settled (legacy snapshots may omit it). */
  nextContract?: Contract | null;
  // T-3-003 D-46: 임대 중 원소속 계약(`suspended: true`). Phase 1·비임대 상태는 항상 null.
  // `state.contract`는 항상 "지금 뛰는 계약"(임대면 kind LOAN)이고, 원소속 계약은 이 필드로 보관한다.
  parentContract: Contract | null;
  // T-3-001 D-45: 소속 이력. 현재 소속 항목(`toSeasonIndex: null`)을 항상 포함한다. Phase 1
  // `acceptOffer`가 첫 항목을 push한다 — 마감·이어붙이기는 T-3-003 몫.
  clubHistory: ClubStint[];
  timeline: TimelineEntry[];
  season: FootballSeason | null;
  seasonHistory: SeasonSummary[];
  /** T-4-003: 다음 시즌 시작 시 소비할 감독 예약. */
  nextManager: SeasonManager | null;
  /** T-4-003: 주장단 상태와 해당 상태로 마친 시즌 수. */
  captaincy: 'NONE' | 'VICE' | 'CAPTAIN';
  captaincySeasons: number;
  /** T-4-003: 윤리·미디어 FAIL outcome 누계. */
  controversyFailures: number;
  /** T-4-004: strict additive 기본값은 정확히 { moduleId: 'DEFAULT', exceptions: [] }. */
  nationalityRuleState: NationalityRuleState;
  /** T-4-004: 대표팀 차출 이력과 최초 수락 뒤 데뷔 예약. */
  nationalTeam: NationalTeamState;
  // T-4-002 D-49: 부상 에피소드 이력. 기본 `{ episodes: [] }`.
  health: { episodes: InjuryEpisode[] };
  // T-4-001 D-50: 관계 변화 감사 로그. 기본 `[]`, 최대 길이는 룰셋 `relationshipRules.logMax`. 실제로
  // 항목을 채우는 로직은 T-4-003.
  relationshipLog: RelationshipLogEntry[];
  // T-4-001 D-50: 대상별 기억 태그(축당 최대 `relationshipRules.memoryTagsMax`). 기본 5축 전부 `[]`.
  memoryTags: Record<RelationTarget, string[]>;
  // T-4-001 D-49: 인기·미디어 평판(0~10000). `CREATE_CAREER`가 룰셋 `reputationRules.initialPopularityCenti`·
  // `initialMediaCenti`로 채운다(기본 5000/5000).
  reputation: { popularityCenti: number; mediaCenti: number };
};

export type DomainSnapshot = {
  revision: number;
  checkpoint: CheckpointType;
  state: CareerState;
  stateHash: string;
  rulesetVersion: string;
  contentPackVersion: string;
};
