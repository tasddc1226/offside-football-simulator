import type {
  AttributeKey,
  CareerTagId,
  ChapterTrigger,
  NationalDebutReservation,
  NationalityRuleState,
  NationalTeamCallUpRecord,
  NationalTeamState,
} from '@offside/domain';
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
  z.strictObject({ kind: z.literal('INJURY_RETURN') }),
  z.strictObject({ kind: z.literal('NATIONAL_DEBUT') }),
  z.strictObject({ kind: z.literal('TAG'), tag: z.string().min(1) }),
]) satisfies z.ZodType<ChapterTrigger>;

// T-2-014 D-42: `ChapterTrigger['kind']` 리터럴만 뽑은 스키마. `ChapterRecord.trigger`·
// `Pending`(CHAPTER).trigger가 판별 유니온 전체가 아니라 kind 하나만 저장하므로 따로 둔다.
export const ChapterTriggerKindSchema = z.enum(['DEBUT', 'DERBY', 'CUP_FINAL', 'DECIDER', 'INJURY_RETURN', 'NATIONAL_DEBUT', 'TAG']) satisfies z.ZodType<
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
  // `ChapterTrigger['kind']`와 동일한 리터럴 7개(위 `ChapterTriggerSchema`의 kind와 같은 목록).
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
  virtualOpponent: z
    .strictObject({ opponentId: z.string().min(1), opponentName: z.string().min(1) })
    .exactOptional(),
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
      // T-4-004: NATIONAL_DEBUT consumes this deterministic virtual opponent; no club fixture is created.
      virtualOpponent: z
        .strictObject({ opponentId: z.string().min(1), opponentName: z.string().min(1) })
        .exactOptional(),
    }),
    // T-3-001 D-43 (a): step 7 재계약 사전 협상. offers.length === 0이면 자동 통과, 1건 이상이면 정지.
    z.strictObject({
      kind: z.literal('CONTRACT'),
      step: z.number().int().min(1).max(12),
      offers: z.array(OfferSchema),
      market: MarketSummarySchema,
    }),
    z.strictObject({ kind: z.literal('ROLE_PROPOSAL'), step: z.number().int().min(1).max(12), proposal: RoleProposalSchema }),
    // T-4-002 D-49: 중증 부상은 이 pending으로 RESOLVE_EVENT를 요구한다.
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
    'RETIRED',
    'SERVICE_STARTED', 'SERVICE_COMPLETED', 'INTERNATIONAL_TOURNAMENT', 'MENTORED',
    'CAPTAIN_APPOINTED',
    'CLUB_MEETING_RESOLVED',
    'CLUB_MEETING_GOAL_EVALUATED',
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
export const OutReasonSchema = z.enum(['NOT_SELECTED', 'UNUSED_SUB', 'INJURY', 'SUSPENSION', 'SERVICE']).nullable();

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
  fixtureId: z.string().min(1).exactOptional(),
  leagueRound: z.number().int().positive().exactOptional(),
  skipped: z.literal('ELIMINATED').exactOptional(),
});

export const LeagueTeamSnapshotSchema = z.strictObject({
  teamId: z.string().min(1),
  name: z.string().min(1),
  strength: z.number().int().min(0).max(100),
});

export const LeagueFixtureResultSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);

export const LeagueSeasonLedgerSchema = z.strictObject({
  policyVersion: z.literal('1.0.0'),
  leagueId: z.string().min(1),
  leagueName: z.string().min(1),
  seasonIndex: z.number().int().positive(),
  teamId: z.string().min(1),
  seed: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().nonnegative()]),
  teams: z.array(LeagueTeamSnapshotSchema).min(2).max(16).superRefine((teams, ctx) => {
    const seen = new Set<string>();
    for (let index = 0; index < teams.length; index += 1) {
      const teamId = teams[index]!.teamId;
      if (seen.has(teamId)) ctx.addIssue({ code: 'custom', path: [index, 'teamId'], message: 'teamId가 중복이다.' });
      seen.add(teamId);
    }
  }),
  results: z.array(LeagueFixtureResultSchema),
  completedRounds: z.array(z.number().int().positive()).superRefine((rounds, ctx) => {
    const seen = new Set<number>();
    for (let index = 0; index < rounds.length; index += 1) {
      const round = rounds[index]!;
      if (seen.has(round)) ctx.addIssue({ code: 'custom', path: [index], message: '완료 round가 중복이다.' });
      seen.add(round);
    }
  }),
}).superRefine((ledger, ctx) => {
  const teamIds = new Set(ledger.teams.map((team) => team.teamId));
  if (!teamIds.has(ledger.teamId)) {
    ctx.addIssue({ code: 'custom', path: ['teamId'], message: '소속 팀이 roster에 없다.' });
  }
  const fixtureIndexes = new Set<number>();
  const teamCount = ledger.teams.length;
  const fixtureCount = teamCount * (teamCount - 1);
  const fixturesPerRound = Math.floor(teamCount / 2);
  const totalRounds = teamCount % 2 === 0 ? 2 * (teamCount - 1) : 2 * teamCount;
  for (let index = 0; index < ledger.results.length; index += 1) {
    const result = ledger.results[index]!;
    if (result[0] >= fixtureCount) {
      ctx.addIssue({ code: 'custom', path: ['results', index, 0], message: 'fixture index가 canonical 일정 범위를 벗어났다.' });
    }
    if (fixtureIndexes.has(result[0])) {
      ctx.addIssue({ code: 'custom', path: ['results', index, 0], message: 'fixture index가 중복이다.' });
    }
    fixtureIndexes.add(result[0]);
  }
  const completed = new Set(ledger.completedRounds);
  for (let index = 0; index < ledger.completedRounds.length; index += 1) {
    if (ledger.completedRounds[index]! > totalRounds) {
      ctx.addIssue({ code: 'custom', path: ['completedRounds', index], message: '완료 round가 canonical 일정 범위를 벗어났다.' });
    }
  }
  for (let round = 1; round <= totalRounds; round += 1) {
    const actual = [...fixtureIndexes].filter(
      (fixtureIndex) => Math.floor(fixtureIndex / fixturesPerRound) + 1 === round,
    ).length;
    if (actual !== 0 && actual !== fixturesPerRound) {
      ctx.addIssue({ code: 'custom', path: ['results'], message: `round ${round} 결과가 부분 집합이다.` });
    }
    if (completed.has(round) !== (actual === fixturesPerRound)) {
      ctx.addIssue({ code: 'custom', path: ['completedRounds'], message: `round ${round} 완료 표식과 결과가 다르다.` });
    }
  }
});

export const StandingRowSchema = z.strictObject({
  rank: z.number().int().positive(),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  goalDifference: z.number().int(),
  points: z.number().int().nonnegative(),
});

export const FinalLeagueTableRowSchema = z.tuple([
  z.number().int().positive(),
  z.string().min(1),
  z.string().min(1),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int(),
  z.number().int().nonnegative(),
]);

function compareFinalTableTeamIds(a: string, b: string): number {
  const ai = a[Symbol.iterator]();
  const bi = b[Symbol.iterator]();
  for (;;) {
    const an = ai.next();
    const bn = bi.next();
    if (an.done && bn.done) return 0;
    if (an.done) return -1;
    if (bn.done) return 1;
    const ac = an.value.codePointAt(0) as number;
    const bc = bn.value.codePointAt(0) as number;
    if (ac !== bc) return ac < bc ? -1 : 1;
  }
}

export const FinalLeagueTableSchema = z.strictObject({
  policyVersion: z.literal('1.0.0'),
  leagueId: z.string().min(1),
  leagueName: z.string().min(1),
  seasonIndex: z.number().int().positive(),
  teamId: z.string().min(1),
  completedRounds: z.number().int().nonnegative(),
  rows: z.array(FinalLeagueTableRowSchema).min(2).max(16),
}).superRefine((table, ctx) => {
  const teamIds = new Set<string>();
  const expectedPlayed = 2 * (table.rows.length - 1);
  const expectedRounds = table.rows.length % 2 === 0
    ? 2 * (table.rows.length - 1)
    : 2 * table.rows.length;
  let totalWon = 0;
  let totalDrawn = 0;
  let totalLost = 0;
  let totalGoalsFor = 0;
  let totalGoalsAgainst = 0;

  table.rows.forEach((row, index) => {
    const [rank, teamId, , played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points] = row;
    if (rank !== index + 1) {
      ctx.addIssue({ code: 'custom', path: ['rows', index, 0], message: '순위는 1부터 연속이며 행 순서와 같아야 한다.' });
    }
    if (teamIds.has(teamId)) {
      ctx.addIssue({ code: 'custom', path: ['rows', index, 1], message: '팀은 최종 순위표에 한 번만 나타나야 한다.' });
    }
    teamIds.add(teamId);
    if (played !== won + drawn + lost) {
      ctx.addIssue({ code: 'custom', path: ['rows', index, 3], message: '경기 수는 승·무·패 합과 같아야 한다.' });
    }
    if (played !== expectedPlayed) {
      ctx.addIssue({ code: 'custom', path: ['rows', index, 3], message: '모든 팀은 홈·원정으로 다른 팀과 두 번 경기해야 한다.' });
    }
    if (goalDifference !== goalsFor - goalsAgainst) {
      ctx.addIssue({ code: 'custom', path: ['rows', index, 9], message: '득실차는 득점에서 실점을 뺀 값이어야 한다.' });
    }
    if (points !== won * 3 + drawn) {
      ctx.addIssue({ code: 'custom', path: ['rows', index, 10], message: '승점은 3×승+무와 같아야 한다.' });
    }
    totalWon += won;
    totalDrawn += drawn;
    totalLost += lost;
    totalGoalsFor += goalsFor;
    totalGoalsAgainst += goalsAgainst;
    const next = table.rows[index + 1];
    if (next !== undefined) {
      const order = next[10] - points || next[9] - goalDifference || next[7] - goalsFor || compareFinalTableTeamIds(teamId, next[1]);
      if (order > 0) {
        ctx.addIssue({ code: 'custom', path: ['rows', index], message: '순위표가 승점·득실차·득점·팀 ID 순서와 일치해야 한다.' });
      }
    }
  });

  if (table.completedRounds !== expectedRounds) {
    ctx.addIssue({ code: 'custom', path: ['completedRounds'], message: '완료 라운드 수가 홈·원정 전체 일정과 일치해야 한다.' });
  }
  if (!teamIds.has(table.teamId)) {
    ctx.addIssue({ code: 'custom', path: ['teamId'], message: '소속 팀은 최종 순위표에 포함되어야 한다.' });
  }
  if (totalWon !== totalLost) {
    ctx.addIssue({ code: 'custom', path: ['rows'], message: '리그 전체 승리와 패배 합은 같아야 한다.' });
  }
  if (totalGoalsFor !== totalGoalsAgainst) {
    ctx.addIssue({ code: 'custom', path: ['rows'], message: '리그 전체 득점과 실점 합은 같아야 한다.' });
  }
  if (totalDrawn % 2 !== 0) {
    ctx.addIssue({ code: 'custom', path: ['rows'], message: '리그 전체 무승부 합은 짝수여야 한다.' });
  }
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
    kind: z.enum(['INJURY', 'SUSPENSION', 'SERVICE']),
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
  excluded: z.enum(['INJURY', 'SUSPENSION', 'NATIONAL_TEAM', 'SERVICE']).nullable(),
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
  legacyContext: z.strictObject({
    policyVersion: z.literal('1.0.0'), wageMinorPerWeek: z.number().int().nonnegative(), signingBonusMinor: z.number().int().nonnegative(), contractId: z.string().min(1),
  }).exactOptional(),
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
  leagueLedger: LeagueSeasonLedgerSchema.exactOptional(),
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
export const ClubMeetingRequestSchema = z.enum(['PLAYING_TIME', 'LOAN', 'TRANSFER']);
const ClubMeetingEffectSchema = z.strictObject({ managerTrustDelta: z.number().int(), moraleDelta: z.number().int() });
const ClubMeetingGoalResultSchema = z.strictObject({
  request: ClubMeetingRequestSchema, response: z.enum(['ACCEPTED', 'REFUSED']), reason: z.string().min(1),
  role: SquadRoleSchema, targetMinutesShareBp: z.number().int().min(0).max(10000), actualMinutesShareBp: z.number().int().min(0).max(10000),
  status: z.enum(['MET', 'MISSED']), effect: ClubMeetingEffectSchema,
});
const ClubMeetingStateSchema = z.strictObject({
  seasonIndex: z.number().int().positive(), request: ClubMeetingRequestSchema, response: z.enum(['ACCEPTED', 'REFUSED']), reason: z.string().min(1),
  teamId: z.string().min(1), contractId: z.string().min(1), immediateEffect: ClubMeetingEffectSchema, plannedRole: SquadRoleSchema,
  preferredOfferKind: z.enum(['LOAN', 'TRANSFER']).nullable(), preferenceStatus: z.enum(['PENDING', 'OFFERED', 'NO_CANDIDATE', 'CANCELLED']).nullable(),
  goal: z.strictObject({ seasonIndex: z.number().int().positive(), role: SquadRoleSchema, targetMinutesShareBp: z.number().int().min(0).max(10000), status: z.literal('PENDING') }),
});

// T-2-005 D-39: SETTLE_SEASON이 만드는 시즌 결산 결과. domain `SeasonResult`와 동일.
export const SeasonResultSchema = z.strictObject({
  legacy: z.strictObject({
    policyVersion: z.literal('1.0.0'), incomeMinor: z.number().int().nonnegative(), contractId: z.string().min(1),
    relationships: z.strictObject({ managerTrust: z.number().int().min(0).max(100), captain: z.number().int().min(0).max(100), rival: z.number().int().min(0).max(100), fans: z.number().int().min(0).max(100), agent: z.number().int().min(0).max(100) }),
    promotion: z.boolean(), ageAtStart: z.number().int().min(0).max(120), injuryMissedMatches: z.number().int().nonnegative().exactOptional(),
  }).exactOptional(),
  index: z.number().int().positive(),
  simulationMode: SimulationModeSchema,
  teamId: z.string().min(1),
  // T-4-003: 실제 지휘 감독과 시즌 종료 시 주장단 상태.
  managerId: z.string().min(1),
  captaincyAtEnd: z.enum(['NONE', 'VICE', 'CAPTAIN']),
  competitions: z.array(CompetitionRecordSchema),
  finalLeagueTable: FinalLeagueTableSchema.exactOptional(),
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
  clubMeetingGoal: ClubMeetingGoalResultSchema.exactOptional(),
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

// T-4-002 D-49: domain `InjurySeverity`·`InjuryBodyPart`·`RehabPlan`과 동일.
export const InjurySeveritySchema = z.enum(['MINOR', 'MODERATE', 'MAJOR']);
export const InjuryBodyPartSchema = z.enum(['KNEE', 'ANKLE', 'HAMSTRING', 'SHOULDER', 'HEAD']);
export const RehabPlanSchema = z.enum(['EARLY', 'STANDARD', 'CONSERVATIVE']);

// T-4-002 D-49: 부상 에피소드 하나. "활성 에피소드" 판정(status ACTIVE|REHAB, 배열 마지막 항목)은
// domain effects.ts `findActiveEpisodeIndex`가 정본이다.
export const InjuryEpisodeSchema = z
  .strictObject({
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
    recurrenceChecksRemaining: z.number().int().nonnegative(),
    status: z.enum(['ACTIVE', 'REHAB', 'RECOVERED', 'RECURRED']),
    permanentDelta: z
      .array(z.strictObject({ key: z.enum(CAREER_STATE_ATTRIBUTE_KEYS), delta: z.number().int() }))
      .nullable(),
    // 시즌 결산으로 FootballSeason.availability가 폐기되어도 활성 부상의 정확한 잔여 결장을 보존한다.
    remainingMatches: z.number().int().nonnegative().exactOptional(),
  })
  .superRefine((episode, ctx) => {
    if ((episode.status === 'ACTIVE' || episode.status === 'REHAB') && episode.remainingMatches === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['remainingMatches'],
        message: 'ACTIVE/REHAB 부상에는 remainingMatches가 필요하다.',
      });
    }
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
  // 확정 전 유스 이벤트도 관계 로그를 남길 수 있어 `state.season === null`이면
  // `state.seasonHistory.length`인 0을 기록한다(T-4-003). 실제 시즌 로그는 1부터 시작한다.
  seasonIndex: z.number().int().nonnegative(),
  // 프리시즌 구단 면담은 시즌 시작 전 경계에서 관계 효과를 적용하므로 step 0을 기록한다.
  // 시즌 중 관계 로그(1..12)와 같은 감사 로그에 보존하되 그 밖의 범위는 허용하지 않는다.
  step: z.number().int().min(0).max(12),
});

// T-4-001 D-49: 인기·미디어 평판(0~10000). domain `CareerState['reputation']`과 동일.
export const ReputationSchema = z.strictObject({
  popularityCenti: z.number().int().min(0).max(10000),
  mediaCenti: z.number().int().min(0).max(10000),
});

// T-4-004: nationalityRuleState는 기본 모듈과 예외 목록만 저장한다. 병역·귀화·이중국적 필드는 없다.
export const NationalityRuleStateSchema = z.union([z.strictObject({
  moduleId: z.literal('DEFAULT'),
  exceptions: z.tuple([]),
}), z.strictObject({
  moduleId: z.enum(['DEFAULT', 'KOREA']), exceptions: z.array(z.string().min(1)).readonly(),
  serviceStatus: z.enum(['NOT_APPLICABLE', 'PENDING', 'SERVING', 'COMPLETED', 'SPECIAL_SERVICE']),
  route: z.enum(['MILITARY_CLUB', 'CAREER_BREAK', 'SPORTS_SERVICE']).nullable(),
  startSeasonIndex: z.number().int().nonnegative().nullable(), completedSeasonIndex: z.number().int().nonnegative().nullable(),
}).readonly()]) satisfies z.ZodType<NationalityRuleState>;

export const NationalTeamCallUpRecordSchema = z.strictObject({
  seasonIndex: z.number().int().positive(),
  step: z.number().int().min(1).max(12),
  eventId: z.string().min(1),
  version: z.number().int().positive(),
  decision: z.enum(['ACCEPT', 'DECLINE', 'CONDITIONAL']),
  reason: z.literal('INJURY').nullable(),
}) satisfies z.ZodType<NationalTeamCallUpRecord>;

export const NationalDebutReservationSchema = z.strictObject({
  opponentId: z.string().min(1),
  opponentName: z.string().min(1),
}) satisfies z.ZodType<NationalDebutReservation>;

export const NationalTeamStateSchema = z.strictObject({
  callUps: z.array(NationalTeamCallUpRecordSchema),
  debuted: z.boolean(),
  pendingDebut: NationalDebutReservationSchema.nullable(),
}) satisfies z.ZodType<NationalTeamState>;

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
  clubMeeting: ClubMeetingStateSchema.exactOptional(),
  // T-4-012 F7: optional for backwards-compatible snapshots; applies after settlement.
  nextContract: ContractSchema.nullable().optional(),
  // T-3-003 D-46: 임대 중 원소속 계약(`suspended: true`). Phase 1·비임대 상태는 항상 null.
  parentContract: ContractSchema.nullable(),
  // T-3-001 D-45: 소속 이력. `acceptOffer`가 매 계약마다 항목을 추가한다(현재 소속은 toSeasonIndex: null).
  clubHistory: z.array(ClubStintSchema),
  timeline: z.array(TimelineEntrySchema),
  season: FootballSeasonSchema.nullable(),
  seasonHistory: z.array(SeasonSummarySchema),
  // T-4-003: 다음 시즌 감독 예약·주장단·윤리/미디어 FAIL 누계.
  nextManager: SeasonManagerSchema.nullable(),
  captaincy: z.enum(['NONE', 'VICE', 'CAPTAIN']),
  captaincySeasons: z.number().int().nonnegative(),
  controversyFailures: z.number().int().nonnegative(),
  // T-4-004: strict additive national-team state.
  nationalityRuleState: NationalityRuleStateSchema,
  retirement: z.strictObject({ policyVersion: z.literal('1.0.0'), marketOffers: z.number().int().nonnegative().nullable(), lastChanceConsumed: z.boolean(), lastChanceSeasonIndex: z.number().int().positive().nullable() }).exactOptional(),
  legacyEvents: z.strictObject({
    policyVersion: z.literal('1.0.0'), mentoredSeasonIndices: z.array(z.number().int().positive()),
    tournaments: z.array(z.strictObject({
      sourceId: z.string().min(1), seasonIndex: z.number().int().positive(), age: z.number().int().min(18).max(23),
      tournament: z.enum(['ASIAN_GAMES', 'OLYMPICS']), medal: z.enum(['GOLD', 'SILVER', 'BRONZE']).nullable(),
      matches: z.array(z.strictObject({ index: z.number().int().min(1).max(6), roll: z.number().int().min(1).max(100), won: z.boolean(), minutes: z.number().int().min(0).max(90) })).length(6),
    })),
  }).exactOptional(),
  nationalTeam: NationalTeamStateSchema,
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
  const season = value.season;

  // 신규 ledger 지원은 버전별 명시 계약이다. Envelope/API load 경계는 룰셋 전체를 로드하지 않으므로
  // 여기서는 필수 존재와 자기 binding만 확인하고, roster/league/schedule은 domain 실행 경계가 검증한다.
  if (value.rulesetVersion === '1.7.0' && isRecord(season)) {
    const ledger = season.leagueLedger;
    if (!isRecord(ledger)) {
      issues.push({ path: ['season', 'leagueLedger'], message: '지원 룰셋 활성 시즌에는 leagueLedger가 있어야 한다.' });
    } else if (ledger.seasonIndex !== season.index || ledger.teamId !== season.teamId) {
      issues.push({ path: ['season', 'leagueLedger'], message: 'leagueLedger가 활성 시즌 index/team과 일치해야 한다.' });
    }
  }
  if (value.rulesetVersion === '1.7.0' && Array.isArray(value.seasonHistory)) {
    value.seasonHistory.forEach((summary, index) => {
      const result = isRecord(summary) ? summary.result : undefined;
      const finalTable = isRecord(result) ? result.finalLeagueTable : undefined;
      const resultIndex = isRecord(result) ? result.index : undefined;
      const resultTeamId = isRecord(result) ? result.teamId : undefined;
      const parsedFinalTable = FinalLeagueTableSchema.safeParse(finalTable);
      if (!parsedFinalTable.success) {
        issues.push({
          path: ['seasonHistory', index, 'result', 'finalLeagueTable'],
          message: '지원 룰셋 결산에는 compact finalLeagueTable이 있어야 한다.',
        });
      } else if (parsedFinalTable.data.seasonIndex !== resultIndex || parsedFinalTable.data.teamId !== resultTeamId) {
        issues.push({
          path: ['seasonHistory', index, 'result', 'finalLeagueTable'],
          message: 'finalLeagueTable이 결산 result의 season index/team과 일치해야 한다.',
        });
      }
    });
  }

  const openStints = Array.isArray(clubHistory)
    ? clubHistory.filter((stint): stint is Record<string, unknown> => isRecord(stint) && stint.toSeasonIndex === null)
    : [];

  if (Array.isArray(clubHistory) && openStints.length > 1) {
    issues.push({ path: ['clubHistory'], message: 'clubHistory에는 열린 stint가 하나만 있어야 한다.' });
  }
  if (Array.isArray(clubHistory)) {
    for (const [index, stint] of clubHistory.entries()) {
      if (!isRecord(stint)) continue;
      const from = stint.fromSeasonIndex;
      const to = stint.toSeasonIndex;
      if (typeof from === 'number' && typeof to === 'number' && to < from) {
        issues.push({ path: ['clubHistory', index, 'toSeasonIndex'], message: 'stint 종료 시즌은 시작 시즌보다 작을 수 없다.' });
      }
    }
  }

  if (hasContract && isRecord(contract)) {
    if (hasClubHistory && Array.isArray(clubHistory)) {
      const expiredMarketPending =
        isRecord(value.pending) && value.pending.kind === 'OFFERS' && isRecord(value.pending.market) && value.pending.market.reason === 'EXPIRED';
      if (openStints.length === 0 && !expiredMarketPending) {
        issues.push({ path: ['clubHistory'], message: '계약이 있으면 열린 stint가 있어야 한다.' });
      } else if (openStints.length === 1) {
        const currentStint = openStints[0]!;
        const contractIdMismatch =
          hasOwn(contract, 'id') && hasOwn(currentStint, 'contractId') && contract.id !== currentStint.contractId;
        const teamIdMismatch =
          hasOwn(contract, 'teamId') && hasOwn(currentStint, 'teamId') && contract.teamId !== currentStint.teamId;
        const kindMismatch = hasOwn(contract, 'kind') && hasOwn(currentStint, 'kind') && contract.kind !== currentStint.kind;
        if (contractIdMismatch || teamIdMismatch || kindMismatch) {
          issues.push({ path: ['clubHistory'], message: '열린 stint가 현재 계약과 일치해야 한다.' });
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

  if (hasOwn(value, 'nextContract') && value.nextContract !== null && value.nextContract !== undefined && !isRecord(value.nextContract)) {
    issues.push({ path: ['nextContract'], message: 'nextContract는 계약 객체 또는 null이어야 한다.' });
  }

  return issues;
}

export const CareerStateSchema = CareerStateShapeSchema.superRefine((value, ctx) => {
  for (const issue of getCareerStateInvariantIssues(value)) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});

export type CareerState = z.infer<typeof CareerStateSchema>;
