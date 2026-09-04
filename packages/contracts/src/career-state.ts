import type { AttributeKey, CareerTagId, ChapterTrigger } from '@offside/domain';
import { z } from 'zod';
import { PlayerDraftSchema, PlayerProfileSchema, PositionSchema } from './player.js';
import { RngStateSchema } from './snapshot.js';
import { SemverSchema } from './versions.js';

export const SquadRoleSchema = z.enum(['STARTER', 'ROTATION', 'BENCH', 'RESERVE']);

// domain `SeasonPhase`와 동일.
export const SeasonPhaseSchema = z.enum(['PRESEASON', 'LEAGUE', 'CUP', 'TRANSFER_WINDOW', 'SETTLEMENT']);

// domain `SimulationMode`와 동일.
export const SimulationModeSchema = z.enum(['FAST', 'CHAPTER']);

// D-9: 팀 리그 등급. 유스는 'YOUTH', 그 외는 1~3부 숫자 리터럴이다(domain `LeagueTier`와 같은 값).
export const LeagueTierSchema = z.union([z.literal('YOUTH'), z.literal(1), z.literal(2), z.literal(3)]);

// T-3-001 D-44: domain `OfferKind`·`NegotiationAsk`·`NegotiationState`와 동일.
export const OfferKindSchema = z.enum(['RENEWAL', 'TRANSFER', 'LOAN', 'FREE_AGENT']);
export const NegotiationAskSchema = z.enum(['WAGE', 'ROLE', 'LENGTH']);
export const NegotiationStateSchema = z.enum(['OPEN', 'COUNTERED', 'WITHDRAWN']);

// T-3-001 D-44/D-46: domain `Offer['loan']`과 동일(kind LOAN 제안·계약에서만 non-null).
export const OfferLoanSchema = z.strictObject({
  parentTeamId: z.string().min(1),
  seasons: z.literal(1),
  wageShareBp: z.number().int().min(0).max(10000),
  buyOptionMinor: z.number().int().nonnegative().nullable(),
});

// D-9, T-3-001 D-44 확장: 제안. offerRules 데이터는 T-1-005·T-3-002가 소비하고, 이 스키마는 결과
// 형태만 검증한다.
export const OfferSchema = z.strictObject({
  id: z.string().min(1),
  kind: OfferKindSchema,
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  fromTeamId: z.string().min(1).nullable(),
  leagueTier: LeagueTierSchema,
  lengthSeasons: z.number().int().min(1).max(5),
  wageMinorPerWeek: z.number().int().nonnegative(),
  signingBonusMinor: z.number().int().nonnegative(),
  transferFeeMinor: z.number().int().nonnegative().nullable(),
  rolePromise: SquadRoleSchema,
  appearancePromise: z.strictObject({ minutesShareBp: z.number().int().min(0).max(10000) }),
  positionPlan: PositionSchema,
  shirtNumber: z.number().int().positive(),
  tacticalFitEstimate: z.number().int(),
  competitorSummary: z.strictObject({ rank: z.number().int().positive(), ovrGap: z.number().int() }).nullable(),
  validUntilRevision: z.number().int().positive().nullable(),
  negotiable: z.strictObject({ wage: z.boolean(), role: z.boolean(), length: z.boolean() }),
  negotiationState: NegotiationStateSchema,
  negotiatedAsk: NegotiationAskSchema.nullable(),
  loan: OfferLoanSchema.nullable(),
});

// T-3-001 D-44/D-46: Phase 1은 항상 'PERMANENT'. domain `ContractKind`와 동일.
export const ContractKindSchema = z.enum(['PERMANENT', 'LOAN']);

// D-9, T-3-001 D-44 확장: 계약. `signatureType`은 Phase 1에서 항상 'AUTO'.
export const ContractSchema = z.strictObject({
  id: z.string().min(1),
  offerId: z.string().min(1),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  leagueTier: LeagueTierSchema,
  lengthSeasons: z.number().int().min(1).max(5),
  wageMinorPerWeek: z.number().int().nonnegative(),
  signingBonusMinor: z.number().int().nonnegative(),
  rolePromise: SquadRoleSchema,
  shirtNumber: z.number().int().positive(),
  signatureType: z.literal('AUTO'),
  signedAtRevision: z.number().int().positive(),
  kind: ContractKindSchema,
  appearancePromise: z.strictObject({ minutesShareBp: z.number().int().min(0).max(10000) }),
  positionPlan: PositionSchema,
  suspended: z.boolean(),
  loan: OfferLoanSchema.nullable(),
  promiseBreaches: z.number().int().nonnegative(),
  signedSeasonIndex: z.number().int().positive(),
});

// T-3-001 D-45: domain `ClubStintEndReason`·`ClubStint`와 동일. `toSeasonIndex: null`이면 현재 소속.
export const ClubStintEndReasonSchema = z.enum(['EXPIRED', 'TRANSFERRED', 'LOANED', 'RETURNED', 'RENEWED']);

export const ClubStintSchema = z.strictObject({
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  leagueTier: LeagueTierSchema,
  kind: ContractKindSchema,
  fromSeasonIndex: z.number().int().positive(),
  toSeasonIndex: z.number().int().positive().nullable(),
  endReason: ClubStintEndReasonSchema.nullable(),
  contractId: z.string().min(1),
});

// T-3-001 D-43: domain `MarketSummary`와 동일 — 시장가치는 상태에 저장하지 않는다(ADR-010).
export const MarketSummarySchema = z.strictObject({
  openedAtRevision: z.number().int().positive(),
  seasonIndex: z.number().int().nonnegative(),
  reason: z.enum(['FIRST_CONTRACT', 'EXPIRED', 'INTEREST', 'LOAN_END', 'PRE_NEGOTIATION']),
  safeOfferId: z.string().min(1).nullable(),
});

// T-2-001 RULE-TIME-002: step 안 결정 슬롯 종류. domain `DecisionSlot.kind`와 동일.
export const DecisionSlotKindSchema = z.enum(['EVENT', 'CHAPTER', 'CONTRACT', 'ROLE', 'INJURY', 'NATIONAL_TEAM', 'SETTLEMENT']);
export const SlotImportanceSchema = z.enum(['MAJOR', 'MINOR']);

// T-2-004 D-38: 핵심 경기 챕터 후보가 이 step의 경기에 맞는지 판정하는 조건. domain `ChapterTrigger`와
// 동일(TAG는 Phase 3+ 용으로 스키마만 둔다). commands.ts의 ADVANCE payload `chapterCandidates`가 쓴다.
export const ChapterTriggerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('DEBUT') }),
  z.strictObject({ kind: z.literal('DERBY') }),
  z.strictObject({ kind: z.literal('CUP_FINAL') }),
  z.strictObject({ kind: z.literal('DECIDER'), maxRankGap: z.number().int() }),
  z.strictObject({ kind: z.literal('TAG'), tag: z.string().min(1) }),
]) satisfies z.ZodType<ChapterTrigger>;

// T-2-014 D-42: `ChapterTrigger['kind']` 리터럴만 뽑은 스키마. `ChapterRecord.trigger`·
// `Pending`(CHAPTER).trigger가 판별 유니온 전체가 아니라 kind 하나만 저장하므로 따로 둔다.
export const ChapterTriggerKindSchema = z.enum(['DEBUT', 'DERBY', 'CUP_FINAL', 'DECIDER', 'TAG']) satisfies z.ZodType<
  ChapterTrigger['kind']
>;

// T-2-014 D-42: RESOLVE_CHAPTER.payload.outcomes[]·ChapterRecord.decisions[]가 남기는 결과 종류.
// domain `ChapterOutcomeKind`와 동일 — `CAREER_TAG_EVALUATORS`(TAG-BIG-GAME 등)가 SUCCESS 개수를 센다.
export const ChapterOutcomeKindSchema = z.enum(['SUCCESS', 'NEUTRAL', 'FAIL', 'FIXED']);

// T-2-004 D-38: CHAPTER pending의 판단마다 확정된 순서대로 쌓는 기록. `roll`은 재생 시 검증용이 아니라
// 그 판단이 소비한 rngState.rollInt 결과값 자체(감사·리플레이 확인용)다.
export const ResolvedChapterDecisionSchema = z.strictObject({
  decisionId: z.string().min(1),
  optionId: z.string().min(1),
  outcomeId: z.string().min(1),
  roll: z.number().int().nonnegative(),
  // T-2-014 D-42.
  outcomeKind: ChapterOutcomeKindSchema,
});

// T-2-004 D-38: 챕터 하나가 판단을 모두 확정하면 `season.chapters`에 남는 기록. domain `ChapterRecord`와
// 동일(`decisions`는 `roll`을 남기지 않는다 — Pending.resolved와 다른 점).
export const ChapterRecordSchema = z.strictObject({
  chapterId: z.string().min(1),
  version: z.number().int().min(1),
  step: z.number().int().min(1).max(12),
  matchId: z.string().min(1),
  importance: SlotImportanceSchema,
  // T-2-014 D-42: 어떤 트리거로 열렸는지(`CAREER_TAG_EVALUATORS`의 TAG-DERBY-HERO 등이 참조). domain
  // `ChapterTrigger['kind']`와 동일한 리터럴 5개(위 `ChapterTriggerSchema`의 kind와 같은 목록).
  trigger: ChapterTriggerKindSchema,
  decisions: z.array(
    z.strictObject({
      decisionId: z.string().min(1),
      optionId: z.string().min(1),
      outcomeId: z.string().min(1),
      // T-2-014 D-42.
      outcomeKind: ChapterOutcomeKindSchema,
    }),
  ),
  ratingDeltaTenths: z.number().int(),
});

// T-2-002 D-34: 감독 역할 제안. `POSITION_CHANGE`는 인접 포지션 전환 제안, `ROLE_CHANGE`는
// squadRole만 바뀌는 제안, `KEEP`은 현상 유지 확인.
export const RoleProposalSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('KEEP'), position: PositionSchema, squadRole: SquadRoleSchema }),
  z.strictObject({
    type: z.literal('POSITION_CHANGE'),
    from: PositionSchema,
    to: PositionSchema,
    squadRoleAfter: SquadRoleSchema,
    tacticalFitAfter: z.number().int(),
    proficiencyAfter: z.number().int(),
  }),
  z.strictObject({ type: z.literal('ROLE_CHANGE'), position: PositionSchema, from: SquadRoleSchema, to: SquadRoleSchema }),
]);

// D-10 + T-2-001/T-2-002/T-2-004: `pending`은 판별 유니온. `null`(대기 없음), `EVENT`(RESOLVE_EVENT
// 대기), `OFFERS`(ACCEPT_OFFER 대기), `ROLE_PROPOSAL`(RESOLVE_ROLE 대기, T-2-002가 자동 통과이던
// `ROLE`을 대체), `CHAPTER`(RESOLVE_CHAPTER 대기, T-2-004 D-38이 placeholder `{ step; importance? }`를
// 대체), 나머지 4종은 시즌 안 결정 슬롯 대기(자동 통과 대상은 domain `isAutoPassablePending` 참고 —
// CHAPTER·CONTRACT·INJURY·NATIONAL_TEAM. ROLE_PROPOSAL·SETTLEMENT는 아니다).
export const PendingSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('EVENT'), eventId: z.string().min(1), version: z.number().int().positive() }),
    // T-3-001 D-43/D-44: Phase 1 `generateOffers` 경로가 `market.reason: 'FIRST_CONTRACT'`를 채운다.
    z.strictObject({ kind: z.literal('OFFERS'), offers: z.array(OfferSchema), market: MarketSummarySchema }),
    z.strictObject({
      kind: z.literal('CHAPTER'),
      step: z.number().int().min(1).max(12),
      chapterId: z.string().min(1),
      version: z.number().int().min(1),
      importance: SlotImportanceSchema,
      matchId: z.string().min(1),
      decisionsTotal: z.number().int().min(1).max(3),
      // T-2-014 D-42.
      trigger: ChapterTriggerKindSchema,
      resolved: z.array(ResolvedChapterDecisionSchema),
    }),
    // T-3-001 D-43 (a): step 7 재계약 사전 협상. offers.length === 0이면 자동 통과, 1건 이상이면 정지.
    z.strictObject({
      kind: z.literal('CONTRACT'),
      step: z.number().int().min(1).max(12),
      offers: z.array(OfferSchema),
      market: MarketSummarySchema,
    }),
    z.strictObject({ kind: z.literal('ROLE_PROPOSAL'), step: z.number().int().min(1).max(12), proposal: RoleProposalSchema }),
    // T-3-001 D-52 예약(값은 T-4-002가 채운다, 생성기가 없는 지금은 형태만).
    z.strictObject({
      kind: z.literal('INJURY'),
      step: z.number().int().min(1).max(12),
      episodeId: z.string(),
      eventId: z.string(),
      version: z.number().int().nonnegative(),
    }),
    // T-3-001 D-51 예약(값은 T-4-004가 채운다, 생성기가 없는 지금은 형태만).
    z.strictObject({
      kind: z.literal('NATIONAL_TEAM'),
      step: z.number().int().min(1).max(12),
      eventId: z.string(),
      version: z.number().int().nonnegative(),
    }),
    // T-3-001 D-46: 임대 시즌 결산 뒤 원소속 복귀·완전 이적 선택(생성기는 T-3-003).
    z.strictObject({
      kind: z.literal('LOAN_RETURN'),
      options: z.array(z.enum(['RETURN', 'PERMANENT'])),
      buyOptionMinor: z.number().int().nonnegative().nullable(),
    }),
    z.strictObject({ kind: z.literal('SETTLEMENT'), step: z.number().int().min(1).max(12) }),
  ])
  .nullable();

// D-12 + T-2-001: 타임라인. 문장은 넣지 않는다(웹이 팩·룰셋에서 조합한다). `refId`는 이벤트면
// `EVT-…:choiceId:outcomeId`, 계약이면 contract id. `SEASON_STARTED`/`STEP_PASSED`는 T-2-001.
export const TimelineEntrySchema = z.strictObject({
  revision: z.number().int().positive(),
  kind: z.enum([
    'CAREER_CONFIRMED',
    'EVENT_RESOLVED',
    'CONTRACT_SIGNED',
    'SEASON_STARTED',
    'STEP_PASSED',
    'SEASON_SETTLED',
    'ROLE_RESOLVED',
    // T-2-004 D-38: 챕터 판단 하나가 확정될 때마다 1건(refId `${chapterId}:${decisionId}:${optionId}:${outcomeId}`).
    'CHAPTER_RESOLVED',
    // T-2-014 D-42: 커리어 태그가 하나 부여될 때마다 1건(refId는 tagId).
    'CAREER_TAG_GRANTED',
    // T-3-001 D-53: 트랙 A(계약·이적, T-3-002·T-3-003이 실제로 남긴다).
    'CONTRACT_RENEWED',
    'TRANSFERRED',
    'LOANED',
    'LOAN_RETURNED',
    'OFFER_REJECTED',
    'OFFER_EXPIRED',
    'NEGOTIATED',
    // T-3-001 D-53: 트랙 B(부상·인간관계·평판, T-4-00x가 실제로 남긴다).
    'INJURED',
    'REHAB_CHOSEN',
    'RECOVERED',
    'INJURY_RECURRED',
    'MANAGER_CHANGED',
    'NATIONAL_TEAM_CALLED',
    'NATIONAL_TEAM_DECLINED',
    'CAPTAIN_APPOINTED',
  ]),
  refId: z.string().nullable(),
  age: z.number().int(),
  step: z.number().int(),
});

// T-2-001 DATA-SEA-001: 시즌 안 step 하나의 결정 슬롯.
export const DecisionSlotSchema = z.strictObject({
  kind: DecisionSlotKindSchema,
  required: z.boolean(),
  importance: SlotImportanceSchema.exactOptional(),
  refId: z.string().exactOptional(),
  skippedByBudget: z.boolean().exactOptional(),
});

// T-2-003 D-35: domain `MatchAppearance`와 동일.
export const MatchAppearanceSchema = z.enum(['START', 'SUB', 'OUT']);

export const StepMatchResultSchema = z.strictObject({
  matchId: z.string().min(1),
  outcome: z.enum(['WIN', 'DRAW', 'LOSS']),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  appearance: MatchAppearanceSchema,
  ratingTenths: z.number().int().min(40).max(100).nullable(),
});

export const StepSummarySchema = z.strictObject({
  passedAtRevision: z.number().int().positive(),
  decisionsOpened: z.number().int().nonnegative(),
  matchesPlayed: z.number().int().nonnegative(),
  results: z.array(StepMatchResultSchema),
});

export const SeasonStepSchema = z.strictObject({
  index: z.number().int().min(1).max(12),
  phase: SeasonPhaseSchema,
  windowOpen: z.boolean(),
  decisionSlots: z.array(DecisionSlotSchema),
  summary: StepSummarySchema.nullable(),
});

export const CompetitionRecordSchema = z.strictObject({
  competitionId: z.string().min(1),
  kind: z.enum(['LEAGUE', 'CUP']),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  position: z.number().int().positive().nullable(),
  cupRound: z.string().nullable(),
});

// T-2-003 D-35: domain `OutReason`과 동일.
export const OutReasonSchema = z.enum(['NOT_SELECTED', 'UNUSED_SUB', 'INJURY', 'SUSPENSION']).nullable();

// T-2-003 D-35: domain `PositionStats`(브리프 "포지션별 결과" 표)와 동일한 판별 유니온.
export const PositionStatsSchema = z.discriminatedUnion('group', [
  z.strictObject({
    group: z.literal('FW'),
    goals: z.number().int().nonnegative(),
    assists: z.number().int().nonnegative(),
    xgCenti: z.number().int().nonnegative(),
    shots: z.number().int().nonnegative(),
    offsides: z.number().int().nonnegative(),
  }),
  z.strictObject({
    group: z.literal('MF'),
    assists: z.number().int().nonnegative(),
    chancesCreated: z.number().int().nonnegative(),
    progressivePasses: z.number().int().nonnegative(),
    passesAttempted: z.number().int().nonnegative(),
    passesCompleted: z.number().int().nonnegative(),
    ballRecoveries: z.number().int().nonnegative(),
  }),
  z.strictObject({
    group: z.literal('DF'),
    tackles: z.number().int().nonnegative(),
    interceptions: z.number().int().nonnegative(),
    aerialsWon: z.number().int().nonnegative(),
    goalsConcededInvolved: z.number().int().nonnegative(),
    cleanSheet: z.boolean(),
  }),
  z.strictObject({
    group: z.literal('GK'),
    saves: z.number().int().nonnegative(),
    psxgMinusGoalsCenti: z.number().int(),
    cleanSheet: z.boolean(),
    crossesClaimed: z.number().int().nonnegative(),
    buildUpPasses: z.number().int().nonnegative(),
  }),
]);

// T-2-003 D-35: domain `PositionStatsTotals` — `PositionStats`와 같은 항목이지만 `cleanSheet`가
// 시즌 누적 횟수(number)다.
export const PositionStatsTotalsSchema = z.discriminatedUnion('group', [
  z.strictObject({
    group: z.literal('FW'),
    goals: z.number().int().nonnegative(),
    assists: z.number().int().nonnegative(),
    xgCenti: z.number().int().nonnegative(),
    shots: z.number().int().nonnegative(),
    offsides: z.number().int().nonnegative(),
  }),
  z.strictObject({
    group: z.literal('MF'),
    assists: z.number().int().nonnegative(),
    chancesCreated: z.number().int().nonnegative(),
    progressivePasses: z.number().int().nonnegative(),
    passesAttempted: z.number().int().nonnegative(),
    passesCompleted: z.number().int().nonnegative(),
    ballRecoveries: z.number().int().nonnegative(),
  }),
  z.strictObject({
    group: z.literal('DF'),
    tackles: z.number().int().nonnegative(),
    interceptions: z.number().int().nonnegative(),
    aerialsWon: z.number().int().nonnegative(),
    goalsConcededInvolved: z.number().int().nonnegative(),
    cleanSheet: z.number().int().nonnegative(),
  }),
  z.strictObject({
    group: z.literal('GK'),
    saves: z.number().int().nonnegative(),
    psxgMinusGoalsCenti: z.number().int(),
    cleanSheet: z.number().int().nonnegative(),
    crossesClaimed: z.number().int().nonnegative(),
    buildUpPasses: z.number().int().nonnegative(),
  }),
]);

// T-2-003 D-35: roll 없이 시즌 시작 시 확정하는 일정 한 항목. domain `ScheduleEntry`와 동일.
export const ScheduleEntrySchema = z.strictObject({
  step: z.number().int().min(1).max(12),
  order: z.number().int().nonnegative(),
  competitionId: z.string().min(1),
  kind: z.enum(['LEAGUE', 'CUP']),
  round: z.string().nullable(),
  opponentId: z.string().min(1),
  home: z.boolean(),
  skipped: z.literal('ELIMINATED').exactOptional(),
});

// T-2-001이 타입만 두었던 것을 T-2-003이 확정한다(브리프 데이터 계약 D-35).
export const MatchRecordSchema = z.strictObject({
  id: z.string().min(1),
  step: z.number().int().min(1).max(12),
  order: z.number().int().nonnegative(),
  competitionId: z.string().min(1),
  kind: z.enum(['LEAGUE', 'CUP']),
  round: z.string().nullable(),
  opponent: z.strictObject({ id: z.string().min(1), name: z.string().min(1), strength: z.number().int().min(0).max(100) }),
  home: z.boolean(),
  result: z.strictObject({
    goalsFor: z.number().int().nonnegative(),
    goalsAgainst: z.number().int().nonnegative(),
    outcome: z.enum(['WIN', 'DRAW', 'LOSS']),
  }),
  appearance: MatchAppearanceSchema,
  outReason: OutReasonSchema,
  minutes: z.number().int().min(0).max(90),
  involvement: z.number().int().min(0).max(100),
  stats: PositionStatsSchema,
  ratingTenths: z.number().int().min(40).max(100).nullable(),
  cards: z.strictObject({ yellow: z.union([z.literal(0), z.literal(1), z.literal(2)]), red: z.boolean() }),
  injuredOff: z.boolean(),
  chapterId: z.string().nullable(),
});

// T-2-003 D-35: 시즌 누계(결산 이전 진행 중 값). domain `SeasonPlayerStats`와 동일.
export const SeasonPlayerStatsSchema = z.strictObject({
  group: z.enum(['GK', 'DF', 'MF', 'FW']),
  appearances: z.strictObject({
    total: z.number().int().nonnegative(),
    started: z.number().int().nonnegative(),
    sub: z.number().int().nonnegative(),
    zeroMinute: z.number().int().nonnegative(),
    out: z.number().int().nonnegative(),
  }),
  minutes: z.number().int().nonnegative(),
  ratingSumTenths: z.number().int().nonnegative(),
  ratedMatches: z.number().int().nonnegative(),
  yellow: z.number().int().nonnegative(),
  red: z.number().int().nonnegative(),
  injuries: z.number().int().nonnegative(),
  totals: PositionStatsTotalsSchema,
});

// T-2-003 D-35: 부상·정지만 표현한다(능력치·재활은 Phase 4). domain `Availability`와 동일.
export const AvailabilitySchema = z
  .strictObject({
    kind: z.enum(['INJURY', 'SUSPENSION']),
    matchesRemaining: z.number().int().positive(),
    sinceMatchId: z.string().min(1),
  })
  .nullable();

/**
 * domain `ATTRIBUTE_KEYS`의 복제(위 `CAREER_STATE_ATTRIBUTE_KEYS`와 같은 목록이 필요하지만 이 값은
 * 아래에서 선언되므로 여기서도 한 번 더 상수를 만든다 — 순서 의존 관계를 피하려 인라인 배열을 쓴다).
 */
const SELECTION_ATTRIBUTE_KEYS = [
  'shooting', 'passing', 'dribbling', 'tackling', 'firstTouch', 'crossing', 'goalkeeping',
  'pace', 'acceleration', 'agility', 'jumping', 'stamina', 'strength', 'durability',
  'decisions', 'concentration', 'composure', 'positioning', 'leadership', 'consistency',
] as const satisfies readonly AttributeKey[];
const selectionAttributesShape = Object.fromEntries(
  SELECTION_ATTRIBUTE_KEYS.map((key) => [key, z.number().int()]),
) as { [K in (typeof SELECTION_ATTRIBUTE_KEYS)[number]]: z.ZodNumber };

// T-2-002 D-34: START_SEASON이 만드는 같은 포지션 경쟁자.
export const CompetitorSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  position: PositionSchema,
  archetypeId: z.string().min(1),
  attributes: z.strictObject(selectionAttributesShape),
  baseOvr: z.number().int(),
  form: z.number().int(),
  fitness: z.number().int(),
  morale: z.number().int(),
  tacticalFit: z.number().int(),
  managerTrust: z.number().int(),
  squadStatus: z.number().int(),
  rolePromise: SquadRoleSchema,
});

// T-2-002 RULE-SEL-001: 선발 순위 후보. `excluded`는 이 작업에서 항상 null(부상·징계·대표팀 제외는
// T-2-003·Phase 4).
export const SelectionCandidateSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  baseOvr: z.number().int(),
  tacticalFit: z.number().int(),
  managerTrust: z.number().int(),
  expectedPerformance: z.number().int(),
  squadStatus: z.number().int(),
  score: z.number().int(),
  excluded: z.enum(['INJURY', 'SUSPENSION', 'NATIONAL_TEAM']).nullable(),
});

// domain `SelectionRanking['candidates']`은 `SelectionCandidate & { rank; appearance }`(교차 타입)이다.
// `z.strictObject({ ...SelectionCandidateSchema.shape, rank, appearance })`처럼 펼쳐 합치면 결과
// 타입이 평평한 단일 object로 추론되어 domain의 교차 타입과 `expectTypeOf().toEqualTypeOf()`가
// 구조적으로는 같아도 표현 형태가 달라 불일치로 본다 — `.and()`로 실제 교차 타입을 만들어 맞춘다.
const RankedSelectionCandidateSchema = SelectionCandidateSchema.and(
  z.strictObject({ rank: z.number().int().positive(), appearance: z.enum(['START', 'SUB', 'OUT']) }),
);

export const SelectionRankingSchema = z.strictObject({
  position: PositionSchema,
  slots: z.number().int().nonnegative(),
  benchSlots: z.number().int().nonnegative(),
  candidates: z.array(RankedSelectionCandidateSchema),
  playerReason: z
    .strictObject({
      component: z.enum(['TACTICAL_FIT', 'MANAGER_TRUST', 'EXPECTED_PERFORMANCE', 'SQUAD_STATUS']),
      delta: z.number().int(),
    })
    .nullable(),
});

// T-2-005 D-39: domain `TrainingFocus`와 동일(ROLE = 아키타입 roleWeights 그대로).
export const TrainingFocusSchema = z.enum(['ROLE', 'TECHNICAL', 'PHYSICAL', 'MENTAL']);

// T-2-001 D-24/T-2-002 D-34: 시즌 구조. `ageReferenceStep`은 항상 1(11 "나이·시즌 경계"). `styleId`·
// `squad`·`selection`은 T-2-002가 추가한다.
// domain `Effect`와 동일한 형태(kind·sourceId·target·delta·clamp·appliesAt·expiresAt·stackingRule).
// FootballSeasonSchema.scheduledEffects가 참조하므로 그 앞에 둔다.
export const EffectSchema = z.strictObject({
  // T-4-001 D-49: HEALTH는 activeEffects에 저장되지 않는 즉발 효과(availability.matchesRemaining·
  // health.recurrenceRiskBp 전용, domain effects.ts 참고).
  kind: z.enum(['PERMANENT', 'CURRENT', 'CONTEXT', 'RELATION', 'DEFERRED', 'HEALTH']),
  sourceId: z.string(),
  target: z.string(),
  delta: z.number().int(),
  clamp: z.strictObject({ min: z.number().int(), max: z.number().int() }),
  appliesAt: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('IMMEDIATE') }),
    z.strictObject({ kind: z.literal('NEXT_SEASON_STEP'), step: z.number().int() }),
  ]),
  // T-2-014 D-40 규칙 3: `AT_SEASON_END`(결산 직전 되돌림)·`SEASONS_AFTER`(저장 시 도메인이
  // `AT_SEASON_INDEX`로 치환)가 더해진다.
  expiresAt: z
    .discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('STEPS_AFTER'), steps: z.number().int() }),
      z.strictObject({ kind: z.literal('AT_STEP'), step: z.number().int() }),
      z.strictObject({ kind: z.literal('AT_SEASON_END') }),
      z.strictObject({ kind: z.literal('SEASONS_AFTER'), seasons: z.number().int() }),
      z.strictObject({ kind: z.literal('AT_SEASON_INDEX'), index: z.number().int() }),
    ])
    .nullable(),
  // T-2-014 D-40 규칙 2: `ONCE_PER_SEASON`은 시즌마다 1회(`season:<index>:<sourceId>`로 dedupe).
  stackingRule: z.enum(['ONCE_PER_SOURCE', 'ONCE_PER_SEASON', 'REPLACE', 'SUM']),
  // T-2-014 D-40 규칙 6: 결과 원인 태그(선택).
  reasonTag: z.string().exactOptional(),
  // T-2-014 D-40 규칙 4: REPLACE + expiresAt 조합이 `activeEffects`에 저장될 때 `applyEffects`가
  // 채우는 적용 전 원래 값(만료 시 이 값으로 복원한다).
  restoreTo: z.number().exactOptional(),
});

// T-4-001 D-50: 시즌 감독. domain `SeasonManager`와 동일(START_SEASON이 rng 없이 기본값을 만든다).
export const SeasonManagerSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  preferredArchetypeIds: z.array(z.string()),
  tenureSeasons: z.number().int().positive(),
  trustBase: z.number().int(),
});

export const FootballSeasonSchema = z.strictObject({
  index: z.number().int().positive(),
  serviceSeasonId: z.string().min(1),
  simulationMode: SimulationModeSchema,
  calendarId: z.string().min(1),
  currentStep: z.number().int().min(1).max(12),
  phase: SeasonPhaseSchema,
  steps: z.array(SeasonStepSchema),
  teamId: z.string().min(1),
  styleId: z.string().min(1),
  squadRole: SquadRoleSchema,
  // T-2-005 D-39: START_SEASON이 만든 시즌 시작 시점 squadRole(RESOLVE_ROLE로도 바뀌지 않는다).
  squadRoleAtStart: SquadRoleSchema,
  // T-2-005 D-39: 이 시즌 훈련 초점.
  trainingFocus: TrainingFocusSchema,
  competitions: z.array(CompetitionRecordSchema),
  // T-2-003 D-35: roll 없이 시즌 시작 시 확정하는 리그·컵 일정(step·order 순 정렬).
  schedule: z.array(ScheduleEntrySchema),
  matches: z.array(MatchRecordSchema),
  ageReferenceStep: z.literal(1),
  squad: z.strictObject({ competitors: z.array(CompetitorSchema) }),
  selection: SelectionRankingSchema,
  // T-2-003 D-35: 시즌 누계 통계(포지션군은 선수 현재 primaryPosition 기준으로 고정).
  playerStats: SeasonPlayerStatsSchema,
  availability: AvailabilitySchema,
  // T-2-003 8번 규칙: 직전 평점(×10 정수). Squad Status 재계산의 lastRating 입력.
  lastRatingTenths: z.number().int().min(40).max(100).nullable(),
  // T-2-003 D-35: 경고 정지 기준 판정용 누적 경고 수(정지가 걸리면 0으로 리셋).
  yellowSuspensionCount: z.number().int().nonnegative(),
  // T-2-003 D-35: 경기 전용 RNG 스트림(결정 슬롯이 쓰는 rngState와 분리 — FAST·CHAPTER byte-identical).
  matchRngState: RngStateSchema,
  // T-2-005 D-39, 오케스트레이터 리뷰 2차(R2-1): 이번 시즌에 적용 예정인 DEFERRED 효과 목록.
  scheduledEffects: z.array(EffectSchema),
  // T-2-004 D-38: 이 시즌에 판단이 모두 끝난 핵심 경기 챕터(step·확정 순).
  chapters: z.array(ChapterRecordSchema),
  // T-4-001 D-50: 이 시즌 감독.
  manager: SeasonManagerSchema.nullable(),
  // T-4-001 D-49: 이 시즌에 만든 INJURY pending 수(RULE-TIME-004 상한 2).
  injuryCount: z.number().int().nonnegative(),
});

// T-2-005 D-39: domain `GrowthCause`와 동일.
export const GrowthCauseSchema = z.enum(['TRAINING', 'MINUTES', 'EXPERIENCE', 'AGE_DECLINE', 'POTENTIAL_CAP']);

// domain `RoleProposal['type']`과 동일.
const RoleProposalTypeSchema = z.enum(['KEEP', 'POSITION_CHANGE', 'ROLE_CHANGE']);

// T-2-005 D-39: SETTLE_SEASON이 만드는 시즌 결산 결과. domain `SeasonResult`와 동일.
export const SeasonResultSchema = z.strictObject({
  index: z.number().int().positive(),
  simulationMode: SimulationModeSchema,
  teamId: z.string().min(1),
  competitions: z.array(CompetitionRecordSchema),
  playerStats: SeasonPlayerStatsSchema,
  selectionSummary: z.strictObject({
    squadRoleAtStart: SquadRoleSchema,
    squadRoleAtEnd: SquadRoleSchema,
    started: z.number().int().nonnegative(),
    sub: z.number().int().nonnegative(),
    zeroMinute: z.number().int().nonnegative(),
    out: z.number().int().nonnegative(),
    minutes: z.number().int().nonnegative(),
    possibleMinutes: z.number().int().nonnegative(),
    finalRank: z.number().int().positive(),
  }),
  roleChanges: z.array(
    z.strictObject({
      step: z.number().int().min(1).max(12),
      type: RoleProposalTypeSchema,
      decision: z.enum(['ACCEPT', 'DECLINE']),
    }),
  ),
  promiseFulfilment: z.strictObject({
    promised: SquadRoleSchema,
    delivered: SquadRoleSchema,
    fulfilled: z.boolean(),
    minutesShareBp: z.number().int().nonnegative(),
  }),
  attributeDeltas: z.array(
    z.strictObject({
      key: z.enum(SELECTION_ATTRIBUTE_KEYS),
      delta: z.number().int(),
      causes: z.array(z.strictObject({ cause: GrowthCauseSchema, centi: z.number().int() })),
    }),
  ),
  baseOvr: z.strictObject({ before: z.number().int(), after: z.number().int() }),
  stateDeltas: z.strictObject({
    form: z.strictObject({ before: z.number().int(), after: z.number().int() }),
    fitness: z.strictObject({ before: z.number().int(), after: z.number().int() }),
    morale: z.strictObject({ before: z.number().int(), after: z.number().int() }),
    managerTrust: z.strictObject({ before: z.number().int(), after: z.number().int() }),
  }),
  chapters: z.array(ChapterRecordSchema),
  // T-3-001(PR #45 후속): 결산 뒤 `season`이 null이 되며 사라지던 다이어리 step 요약을 보존한다.
  stepSummaries: z.array(
    z.strictObject({
      step: z.number().int().min(1).max(12),
      phase: SeasonPhaseSchema,
      matchesPlayed: z.number().int().nonnegative(),
      decisionsOpened: z.number().int().nonnegative(),
      passedAtRevision: z.number().int().positive(),
    }),
  ),
  hash: z.string().min(1),
});

export const SeasonSummarySchema = z.strictObject({
  index: z.number().int().positive(),
  simulationMode: SimulationModeSchema,
  teamId: z.string().min(1),
  competitions: z.array(CompetitionRecordSchema),
  settledAtRevision: z.number().int().positive(),
  result: SeasonResultSchema,
});

/**
 * domain `ATTRIBUTE_KEYS`의 복제(ADR-005: contracts → domain은 타입만 import한다, 런타임 값은
 * 복제하고 `satisfies`로 타입 검사를 묶는다). 20개, 순서는 domain과 같다(기술 7·신체 7·정신 6).
 */
export const CAREER_STATE_ATTRIBUTE_KEYS = [
  'shooting',
  'passing',
  'dribbling',
  'tackling',
  'firstTouch',
  'crossing',
  'goalkeeping',
  'pace',
  'acceleration',
  'agility',
  'jumping',
  'stamina',
  'strength',
  'durability',
  'decisions',
  'concentration',
  'composure',
  'positioning',
  'leadership',
  'consistency',
] as const satisfies readonly AttributeKey[];

type AttributesShape = { [K in (typeof CAREER_STATE_ATTRIBUTE_KEYS)[number]]: z.ZodNumber };

/**
 * T-2-014 D-42: domain `CAREER_TAG_IDS`의 복제(ADR-005 패턴, 14 "커리어 태그 카탈로그" 표 순서 그대로).
 */
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
] as const satisfies readonly CareerTagId[];

export const CareerTagIdSchema = z.enum(CAREER_TAG_IDS);

// T-2-014 D-42: 태그 하나가 부여된 기록. domain `CareerTagGrant`와 동일.
export const CareerTagGrantSchema = z.strictObject({
  tagId: CareerTagIdSchema,
  seasonIndex: z.number().int().positive(),
  atRevision: z.number().int().positive(),
  sourceRefId: z.string().min(1),
});

const attributesShape = Object.fromEntries(
  CAREER_STATE_ATTRIBUTE_KEYS.map((key) => [key, z.number().int()]),
) as AttributesShape;

/** 20개 능력 키 전부 필수 정수. */
export const AttributesSchema = z.strictObject(attributesShape);

// T-4-001 D-49: domain `InjurySeverity`·`InjuryBodyPart`·`RehabPlan`과 동일.
export const InjurySeveritySchema = z.enum(['MINOR', 'MODERATE', 'MAJOR']);
export const InjuryBodyPartSchema = z.enum(['KNEE', 'ANKLE', 'HAMSTRING', 'SHOULDER', 'HEAD']);
export const RehabPlanSchema = z.enum(['EARLY', 'STANDARD', 'CONSERVATIVE']);

// T-4-001 D-49: 부상 에피소드 하나. "활성 에피소드" 판정(status ACTIVE|REHAB, 배열 마지막 항목)은
// domain effects.ts `findActiveEpisodeIndex`가 정본이다.
export const InjuryEpisodeSchema = z.strictObject({
  id: z.string().min(1),
  severity: InjurySeveritySchema,
  bodyPart: InjuryBodyPartSchema,
  occurredAt: z.strictObject({
    seasonIndex: z.number().int().positive(),
    step: z.number().int().min(1).max(12),
    matchId: z.string().min(1),
  }),
  diagnosisRange: z.strictObject({
    minMatches: z.number().int().positive(),
    maxMatches: z.number().int().positive(),
  }),
  rehab: RehabPlanSchema.nullable(),
  recurrenceRiskBp: z.number().int().min(0).max(10000),
  status: z.enum(['ACTIVE', 'REHAB', 'RECOVERED', 'RECURRED']),
  permanentDelta: z
    .array(z.strictObject({ key: z.enum(CAREER_STATE_ATTRIBUTE_KEYS), delta: z.number().int() }))
    .nullable(),
});

// T-4-001 D-50: 관계 로그·기억 태그가 다루는 대상 축 5개. domain `RelationTarget`과 동일(순서는
// `relationships` 필드와 같은 순서를 유지한다).
export const RelationTargetSchema = z.enum(['managerTrust', 'captain', 'rival', 'fans', 'agent']);

// T-4-001 D-50: 관계 변화 감사 로그 항목 하나. domain `RelationshipLogEntry`와 동일.
export const RelationshipLogEntrySchema = z.strictObject({
  target: RelationTargetSchema,
  delta: z.number().int(),
  sourceId: z.string().min(1),
  reasonTag: z.string().min(1).nullable(),
  seasonIndex: z.number().int().positive(),
  step: z.number().int().min(1).max(12),
});

// T-4-001 D-49: 인기·미디어 평판(0~10000). domain `CareerState['reputation']`과 동일.
export const ReputationSchema = z.strictObject({
  popularityCenti: z.number().int().min(0).max(10000),
  mediaCenti: z.number().int().min(0).max(10000),
});

/**
 * D-13: Phase 1 `CareerState` 전체(domain `CareerState`와 동일). 04(Snapshot `state` 내부) 검증용
 * 엄격 스키마다 — 아래 `SnapshotStateEnvelopeSchema`(snapshot.ts)는 여러 schemaVersion·미래 필드를
 * 느슨하게 받아야 하는 API 봉투 최상위 검사용이고, 이 스키마는 domain이 만드는 Phase 1 state의
 * 정확한 형태를 강제한다. 서로 다른 용도이므로 하나로 합치지 않는다.
 */
const CareerStateShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  careerId: z.string().min(1),
  status: z.enum(['DRAFT', 'ACTIVE', 'RETIRED', 'ARCHIVED']),
  stage: z.enum(['YOUTH', 'PRO']),
  age: z.number().int(),
  currentStep: z.number().int(),
  seasonPhase: SeasonPhaseSchema,
  simulationMode: SimulationModeSchema,
  attributes: AttributesSchema,
  // T-2-005 D-39: 성장식 이월(정수 centi, 1/100). 결산 시 매번 갱신된다.
  growthCarryCenti: AttributesSchema,
  state: z.strictObject({
    form: z.number().int(),
    fitness: z.number().int(),
    morale: z.number().int(),
  }),
  context: z.strictObject({
    tacticalFit: z.number().int(),
    squadStatus: z.number().int(),
    positionProficiency: z.number().int(),
  }),
  relationships: z.strictObject({
    managerTrust: z.number().int(),
    captain: z.number().int(),
    rival: z.number().int(),
    fans: z.number().int(),
    agent: z.number().int(),
  }),
  tags: z.array(z.string()),
  appliedSourceIds: z.array(z.string()),
  activeEffects: z.array(EffectSchema),
  deferredEffects: z.array(EffectSchema),
  resolvedEventIds: z.array(z.string()),
  // T-2-004 D-38: resolvedEventIds와 같은 역할, 챕터용(`${chapterId}@${seasonIndex}` 형식).
  resolvedChapterIds: z.array(z.string()),
  // T-2-014 D-42.
  careerTags: z.array(CareerTagIdSchema),
  careerTagGrants: z.array(CareerTagGrantSchema),
  rngState: RngStateSchema,
  rulesetVersion: SemverSchema,
  contentPackVersion: SemverSchema,
  player: z.strictObject({
    draft: PlayerDraftSchema,
    profile: PlayerProfileSchema.nullable(),
  }),
  pending: PendingSchema,
  contract: ContractSchema.nullable(),
  // T-3-003 D-46: 임대 중 원소속 계약(`suspended: true`). Phase 1·비임대 상태는 항상 null.
  parentContract: ContractSchema.nullable(),
  // T-3-001 D-45: 소속 이력. `acceptOffer`가 매 계약마다 항목을 추가한다(현재 소속은 toSeasonIndex: null).
  clubHistory: z.array(ClubStintSchema),
  timeline: z.array(TimelineEntrySchema),
  season: FootballSeasonSchema.nullable(),
  seasonHistory: z.array(SeasonSummarySchema),
  // T-4-001 D-49: 부상 에피소드 이력.
  health: z.strictObject({ episodes: z.array(InjuryEpisodeSchema) }),
  // T-4-001 D-50: 관계 변화 감사 로그(최대 길이는 룰셋 relationshipRules.logMax).
  relationshipLog: z.array(RelationshipLogEntrySchema),
  // T-4-001 D-50: 대상별 기억 태그(축당 최대 relationshipRules.memoryTagsMax).
  memoryTags: z.strictObject({
    managerTrust: z.array(z.string()),
    captain: z.array(z.string()),
    rival: z.array(z.string()),
    fans: z.array(z.string()),
    agent: z.array(z.string()),
  }),
  // T-4-001 D-49: 인기·미디어 평판.
  reputation: ReputationSchema,
});

export type CareerStateInvariantIssue = {
  path: Array<string | number>;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * 계약·소속 이력 사이에서만 확인할 수 있는 교차 불변식이다. SnapshotStateEnvelopeSchema는 미래 필드를
 * 보존하기 위해 느슨해야 하므로, 이 검사는 전체 CareerState 파싱과 분리해 API 동기화 경계에서도
 * 동일하게 재사용한다. 값이 아직 해당 필드를 포함하지 않는 구형/부분 Snapshot에는 적용하지 않는다.
 */
export function getCareerStateInvariantIssues(value: unknown): CareerStateInvariantIssue[] {
  if (!isRecord(value)) return [];

  const issues: CareerStateInvariantIssue[] = [];
  const contract = value.contract;
  const parentContract = value.parentContract;
  const clubHistory = value.clubHistory;
  const hasContract = hasOwn(value, 'contract');
  const hasParentContract = hasOwn(value, 'parentContract');
  const hasClubHistory = hasOwn(value, 'clubHistory');

  const openStints = Array.isArray(clubHistory)
    ? clubHistory.filter((stint): stint is Record<string, unknown> => isRecord(stint) && stint.toSeasonIndex === null)
    : [];

  if (Array.isArray(clubHistory) && openStints.length > 1) {
    issues.push({ path: ['clubHistory'], message: 'clubHistory에는 열린 stint가 하나만 있어야 한다.' });
  }

  if (hasContract && isRecord(contract)) {
    if (hasClubHistory && Array.isArray(clubHistory)) {
      if (openStints.length === 0) {
        issues.push({ path: ['clubHistory'], message: '계약이 있으면 열린 stint가 있어야 한다.' });
      } else if (openStints.length === 1) {
        const currentStint = openStints[0]!;
        for (const key of ['contractId', 'teamId', 'kind'] as const) {
          if (hasOwn(contract, key) && hasOwn(currentStint, key) && contract[key] !== currentStint[key]) {
            issues.push({ path: ['clubHistory'], message: '열린 stint가 현재 계약과 일치해야 한다.' });
            break;
          }
        }
      }
    }

    if (contract.kind === 'LOAN') {
      if (!isRecord(contract.loan)) {
        issues.push({ path: ['contract', 'loan'], message: 'LOAN 계약에는 loan 정보가 있어야 한다.' });
      }
      if (!isRecord(parentContract)) {
        issues.push({ path: ['parentContract'], message: 'LOAN 계약에는 parentContract가 있어야 한다.' });
      } else {
        if (parentContract.kind !== 'PERMANENT') {
          issues.push({ path: ['parentContract', 'kind'], message: 'parentContract는 PERMANENT여야 한다.' });
        }
        if (parentContract.suspended !== true) {
          issues.push({ path: ['parentContract', 'suspended'], message: '임대 중 parentContract는 suspended여야 한다.' });
        }
        if (
          isRecord(contract.loan) &&
          hasOwn(contract.loan, 'parentTeamId') &&
          hasOwn(parentContract, 'teamId') &&
          contract.loan.parentTeamId !== parentContract.teamId
        ) {
          issues.push({ path: ['parentContract', 'teamId'], message: 'parentContract가 loan의 원소속과 일치해야 한다.' });
        }
      }
    } else if (hasParentContract && parentContract !== null) {
      issues.push({ path: ['parentContract'], message: '비임대 계약에는 parentContract가 없어야 한다.' });
    }
  } else if (hasParentContract && parentContract !== null) {
    issues.push({ path: ['parentContract'], message: '계약이 없으면 parentContract가 없어야 한다.' });
  }

  if (hasContract && contract === null && hasClubHistory && openStints.length > 0) {
    issues.push({ path: ['clubHistory'], message: '계약이 없으면 열린 stint가 없어야 한다.' });
  }

  return issues;
}

export const CareerStateSchema = CareerStateShapeSchema.superRefine((value, ctx) => {
  for (const issue of getCareerStateInvariantIssues(value)) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});

export type CareerState = z.infer<typeof CareerStateSchema>;
