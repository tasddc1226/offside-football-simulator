import type { AttributeKey } from '@offside/domain';
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

// D-9: 제안. offerRules 데이터는 T-1-005가 소비하고, 이 스키마는 결과 형태만 검증한다.
export const OfferSchema = z.strictObject({
  id: z.string().min(1),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  leagueTier: LeagueTierSchema,
  lengthSeasons: z.number().int().positive(),
  wageMinorPerWeek: z.number().int().nonnegative(),
  signingBonusMinor: z.number().int().nonnegative(),
  rolePromise: SquadRoleSchema,
  shirtNumber: z.number().int().positive(),
  tacticalFitEstimate: z.number().int(),
});

// D-9: 계약. `signatureType`은 Phase 1에서 항상 'AUTO'.
export const ContractSchema = z.strictObject({
  id: z.string().min(1),
  offerId: z.string().min(1),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  leagueTier: LeagueTierSchema,
  lengthSeasons: z.number().int().positive(),
  wageMinorPerWeek: z.number().int().nonnegative(),
  signingBonusMinor: z.number().int().nonnegative(),
  rolePromise: SquadRoleSchema,
  shirtNumber: z.number().int().positive(),
  signatureType: z.literal('AUTO'),
  signedAtRevision: z.number().int().positive(),
});

// T-2-001 RULE-TIME-002: step 안 결정 슬롯 종류. domain `DecisionSlot.kind`와 동일.
export const DecisionSlotKindSchema = z.enum(['EVENT', 'CHAPTER', 'CONTRACT', 'ROLE', 'INJURY', 'NATIONAL_TEAM', 'SETTLEMENT']);
export const SlotImportanceSchema = z.enum(['MAJOR', 'MINOR']);

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

// D-10 + T-2-001/T-2-002: `pending`은 판별 유니온. `null`(대기 없음), `EVENT`(RESOLVE_EVENT 대기),
// `OFFERS`(ACCEPT_OFFER 대기), `ROLE_PROPOSAL`(RESOLVE_ROLE 대기, T-2-002가 자동 통과이던 `ROLE`을
// 대체), 나머지 5종은 시즌 안 결정 슬롯 대기(자동 통과 대상은 domain `isAutoPassablePending` 참고 —
// CHAPTER·CONTRACT·INJURY·NATIONAL_TEAM. ROLE_PROPOSAL·SETTLEMENT는 아니다).
export const PendingSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('EVENT'), eventId: z.string().min(1), version: z.number().int().positive() }),
    z.strictObject({ kind: z.literal('OFFERS'), offers: z.array(OfferSchema) }),
    z.strictObject({ kind: z.literal('CHAPTER'), step: z.number().int().min(1).max(12), importance: SlotImportanceSchema.exactOptional() }),
    z.strictObject({ kind: z.literal('CONTRACT'), step: z.number().int().min(1).max(12) }),
    z.strictObject({ kind: z.literal('ROLE_PROPOSAL'), step: z.number().int().min(1).max(12), proposal: RoleProposalSchema }),
    z.strictObject({ kind: z.literal('INJURY'), step: z.number().int().min(1).max(12) }),
    z.strictObject({ kind: z.literal('NATIONAL_TEAM'), step: z.number().int().min(1).max(12) }),
    z.strictObject({ kind: z.literal('SETTLEMENT'), step: z.number().int().min(1).max(12) }),
  ])
  .nullable();

// D-12 + T-2-001: 타임라인. 문장은 넣지 않는다(웹이 팩·룰셋에서 조합한다). `refId`는 이벤트면
// `EVT-…:choiceId:outcomeId`, 계약이면 contract id. `SEASON_STARTED`/`STEP_PASSED`는 T-2-001.
export const TimelineEntrySchema = z.strictObject({
  revision: z.number().int().positive(),
  kind: z.enum(['CAREER_CONFIRMED', 'EVENT_RESOLVED', 'CONTRACT_SIGNED', 'SEASON_STARTED', 'STEP_PASSED', 'SEASON_SETTLED', 'ROLE_RESOLVED']),
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
  kind: z.enum(['PERMANENT', 'CURRENT', 'CONTEXT', 'RELATION', 'DEFERRED']),
  sourceId: z.string(),
  target: z.string(),
  delta: z.number().int(),
  clamp: z.strictObject({ min: z.number().int(), max: z.number().int() }),
  appliesAt: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('IMMEDIATE') }),
    z.strictObject({ kind: z.literal('NEXT_SEASON_STEP'), step: z.number().int() }),
  ]),
  expiresAt: z
    .discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('STEPS_AFTER'), steps: z.number().int() }),
      z.strictObject({ kind: z.literal('AT_STEP'), step: z.number().int() }),
    ])
    .nullable(),
  stackingRule: z.enum(['ONCE_PER_SOURCE', 'REPLACE', 'SUM']),
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
});

// T-2-005 D-39: T-2-004(핵심 경기 챕터)가 아직 main에 없어 실제 형태를 모른다 — domain과 같은
// 플레이스홀더(`{ id, step }`)다. T-2-004가 머지되면 그쪽 정의로 맞춘다.
export const ChapterRecordSchema = z.strictObject({ id: z.string().min(1), step: z.number().int().min(1).max(12) });

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

const attributesShape = Object.fromEntries(
  CAREER_STATE_ATTRIBUTE_KEYS.map((key) => [key, z.number().int()]),
) as AttributesShape;

/** 20개 능력 키 전부 필수 정수. */
export const AttributesSchema = z.strictObject(attributesShape);

/**
 * D-13: Phase 1 `CareerState` 전체(domain `CareerState`와 동일). 04(Snapshot `state` 내부) 검증용
 * 엄격 스키마다 — 아래 `SnapshotStateEnvelopeSchema`(snapshot.ts)는 여러 schemaVersion·미래 필드를
 * 느슨하게 받아야 하는 API 봉투 최상위 검사용이고, 이 스키마는 domain이 만드는 Phase 1 state의
 * 정확한 형태를 강제한다. 서로 다른 용도이므로 하나로 합치지 않는다.
 */
export const CareerStateSchema = z.strictObject({
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
  rngState: RngStateSchema,
  rulesetVersion: SemverSchema,
  contentPackVersion: SemverSchema,
  player: z.strictObject({
    draft: PlayerDraftSchema,
    profile: PlayerProfileSchema.nullable(),
  }),
  pending: PendingSchema,
  contract: ContractSchema.nullable(),
  timeline: z.array(TimelineEntrySchema),
  season: FootballSeasonSchema.nullable(),
  seasonHistory: z.array(SeasonSummarySchema),
});

export type CareerState = z.infer<typeof CareerStateSchema>;
