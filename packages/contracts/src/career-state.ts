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

export const StepSummarySchema = z.strictObject({
  passedAtRevision: z.number().int().positive(),
  decisionsOpened: z.number().int().nonnegative(),
  matchesPlayed: z.number().int().nonnegative(),
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

// T-2-001 범위 밖: `matches`는 이 작업에서 항상 []다(값 채우기는 T-2-002/003).
export const MatchRecordSchema = z.strictObject({
  id: z.string().min(1),
  step: z.number().int().min(1).max(12),
  competitionId: z.string().min(1),
  opponentTeamId: z.string().min(1),
  home: z.boolean(),
  result: z.strictObject({ goalsFor: z.number().int().nonnegative(), goalsAgainst: z.number().int().nonnegative() }).nullable(),
});

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

// T-2-001 D-24/T-2-002 D-34: 시즌 구조. `ageReferenceStep`은 항상 1(11 "나이·시즌 경계"). `styleId`·
// `squad`·`selection`은 T-2-002가 추가한다.
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
  competitions: z.array(CompetitionRecordSchema),
  matches: z.array(MatchRecordSchema),
  ageReferenceStep: z.literal(1),
  squad: z.strictObject({ competitors: z.array(CompetitorSchema) }),
  selection: SelectionRankingSchema,
});

export const SeasonSummarySchema = z.strictObject({
  index: z.number().int().positive(),
  simulationMode: SimulationModeSchema,
  teamId: z.string().min(1),
  competitions: z.array(CompetitionRecordSchema),
  settledAtRevision: z.number().int().positive(),
});

// domain `Effect`와 동일한 형태(kind·sourceId·target·delta·clamp·appliesAt·expiresAt·stackingRule).
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
