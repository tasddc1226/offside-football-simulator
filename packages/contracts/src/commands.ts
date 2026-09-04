import { z } from 'zod';
import {
  ChapterOutcomeKindSchema,
  ChapterTriggerSchema,
  EffectSchema,
  NegotiationAskSchema,
  SlotImportanceSchema,
  TrainingFocusSchema,
} from './career-state.js';
import { successEnvelope } from './envelope.js';
import { PlayerDraftSchema } from './player.js';
import { ClientIdSchema, Hex64Schema, IsoUtcSchema } from './primitives.js';
import { CareerSnapshotSchema } from './snapshot.js';
import { SemverSchema } from './versions.js';

/**
 * 07 "로컬 명령 계약"의 13개 명령(T-2-002가 RESOLVE_ROLE 추가). domain Command의 이름과 같게
 * 유지한다(T-0-014가 domain의 ADVANCE_STEP을 ADVANCE로 정렬).
 */
export const COMMAND_TYPES = [
  'CREATE_CAREER',
  'UPDATE_PLAYER_DRAFT',
  'CONFIRM_PLAYER',
  'RESOLVE_EVENT',
  'START_SEASON',
  'ADVANCE',
  'SETTLE_SEASON',
  // T-2-002 D-34 CMD-SIM-004: step 1 ROLE_PROPOSAL pending을 닫는다.
  'RESOLVE_ROLE',
  // T-2-004 D-38 CMD-SIM-005: CHAPTER pending의 판단 하나를 닫는다.
  'RESOLVE_CHAPTER',
  'NEGOTIATE',
  'ACCEPT_OFFER',
  'REJECT_OFFER',
  'LOAN_RETURN',
  'RETIRE',
] as const;

export const CommandTypeSchema = z.enum(COMMAND_TYPES);
export type CommandType = z.infer<typeof CommandTypeSchema>;

/** T-1-006에서 payload 스키마를 갖는 Phase 1 명령 6종(domain `Command` 유니온과 D-9 `ACCEPT_OFFER`). */
export type Phase1CommandType =
  | 'CREATE_CAREER'
  | 'UPDATE_PLAYER_DRAFT'
  | 'CONFIRM_PLAYER'
  | 'ADVANCE'
  | 'RESOLVE_EVENT'
  | 'ACCEPT_OFFER';

// D-7: CREATE_CAREER payload.
export const CreateCareerPayloadSchema = z.strictObject({
  careerId: ClientIdSchema,
  seed: z.string().min(1),
  simulationMode: z.enum(['FAST', 'CHAPTER']),
  rulesetVersion: SemverSchema,
  contentPackVersion: SemverSchema,
});

// D-7: UPDATE_PLAYER_DRAFT payload. 준 필드만 검증 후 병합하므로 draft는 partial이다.
export const UpdatePlayerDraftPayloadSchema = z.strictObject({
  draft: PlayerDraftSchema.partial(),
});

// D-7: CONFIRM_PLAYER payload. 필드 없음(domain Command payload는 `Record<string, never>`).
export const ConfirmPlayerPayloadSchema = z.strictObject({});

const EligibleEventSchema = z.strictObject({
  eventId: z.string().min(1),
  version: z.number().int().min(1),
  weight: z.number().int().min(1),
});

// T-2-004 D-38: ADVANCE payload의 chapterCandidates 원소 하나. domain `ChapterCandidateInput`과 동일.
const ChapterCandidateSchema = z.strictObject({
  chapterId: z.string().min(1),
  version: z.number().int().min(1),
  importance: SlotImportanceSchema,
  trigger: ChapterTriggerSchema,
  weight: z.number().int().min(1),
  decisionsTotal: z.number().int().min(1).max(3),
});

// D-10 + T-2-004 D-38: ADVANCE payload. eligibleEvents는 클라이언트가 eventId 오름차순으로 정렬해
// 보낸다. chapterCandidates는 신규(웹이 팩 chapters[]에서 요약해 보낸다) — 비면(또는 생략하면) 챕터는
// 열리지 않는다(기존 골든 호환).
export const AdvancePayloadSchema = z
  .strictObject({
    eligibleEvents: z.array(EligibleEventSchema),
    chapterCandidates: z.array(ChapterCandidateSchema).exactOptional(),
  })
  .superRefine((payload, ctx) => {
    const events = payload.eligibleEvents;
    for (let i = 1; i < events.length; i++) {
      // eventId는 'EVT-…' 같은 ASCII 케밥 케이스라 서로게이트 쌍이 없다. 그 범위에서 문자열 `<` 비교는
      // domain `compareCodePoints`가 정의하는 코드포인트 순 비교와 같은 결과를 낸다. domain
      // `isEligibleEventsSorted`처럼 엄격 증가가 아니라 비내림차순(동률 허용)을 요구한다.
      if (events[i - 1]!.eventId > events[i]!.eventId) {
        ctx.addIssue({
          code: 'custom',
          message: 'eligibleEvents는 eventId 오름차순이어야 한다.',
          path: ['eligibleEvents', i, 'eventId'],
        });
        return;
      }
    }
  });

const ResolveEventOutcomeSchema = z.strictObject({
  id: z.string().min(1),
  weight: z.number().int().min(1),
  effects: z.array(EffectSchema),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
});

// D-10: RESOLVE_EVENT payload.
export const ResolveEventPayloadSchema = z.strictObject({
  eventId: z.string().min(1),
  definitionVersion: z.number().int().min(1),
  choiceId: z.string().min(1),
  outcomes: z.array(ResolveEventOutcomeSchema).min(1),
});

// T-2-004 D-38 CMD-SIM-005: RESOLVE_CHAPTER payload의 outcome 하나. ResolveEventOutcomeSchema와
// 같은 형태에 챕터 전용 ratingDeltaTenths가 더해진다(경기 평점에 더할 값, clamp(40,100)은 domain 몫).
// T-2-014 D-42: `kind`가 필수다 — `ChapterRecord.decisions[].outcomeKind`(CAREER_TAG_EVALUATORS가
// SUCCESS 개수를 센다)로 그대로 저장된다.
const ResolveChapterOutcomeSchema = z.strictObject({
  id: z.string().min(1),
  kind: ChapterOutcomeKindSchema,
  weight: z.number().int().min(1),
  effects: z.array(EffectSchema),
  ratingDeltaTenths: z.number().int(),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
});

// T-2-004 D-38 CMD-SIM-005: RESOLVE_CHAPTER payload. 판단 하나(decisionId)를 optionId로 확정한다.
export const ResolveChapterPayloadSchema = z.strictObject({
  chapterId: z.string().min(1),
  definitionVersion: z.number().int().min(1),
  decisionId: z.string().min(1),
  optionId: z.string().min(1),
  outcomes: z.array(ResolveChapterOutcomeSchema).min(1),
});

// D-9: ACCEPT_OFFER payload. T-1-005가 main에 머지되어 domain `Command`에도 같은 형태로 있다.
export const AcceptOfferPayloadSchema = z.strictObject({
  offerId: z.string().min(1),
});

// T-2-001 D-25: START_SEASON payload. 브리프는 `{ simulationMode }`만 적었지만, domain
// `FootballSeason.serviceSeasonId`(브리프 데이터 계약)가 engine-client `Career` 래퍼에만 있고
// domain `CareerState` 어디에도 없어(engine-client는 이 작업 범위 밖), CREATE_CAREER처럼
// payload로 받도록 domain Command를 확장했다(PR 본문 "범위 밖 발견 사항" 참고). 이 스키마는
// domain Command payload 형태를 그대로 따른다.
// T-2-005 D-39: trainingFocus는 없으면 'ROLE'(기존 골든 호환).
export const StartSeasonPayloadSchema = z.strictObject({
  simulationMode: z.enum(['FAST', 'CHAPTER']),
  serviceSeasonId: z.string().min(1),
  trainingFocus: TrainingFocusSchema.exactOptional(),
});

// T-2-001 D-25: SETTLE_SEASON payload. 필드 없음(domain Command payload는 `Record<string, never>`).
export const SettleSeasonPayloadSchema = z.strictObject({});

// T-2-002 D-34 CMD-SIM-004: RESOLVE_ROLE payload.
export const ResolveRolePayloadSchema = z.strictObject({
  decision: z.enum(['ACCEPT', 'DECLINE']),
});

/** Phase 2+ 명령(아직 domain에 없음)은 형태를 모르므로 임의 payload를 통과시킨다. */
const UnknownPayloadSchema = z.record(z.string(), z.unknown());

// T-3-001 D-44: NEGOTIATE payload. 처리기는 T-3-003 전까지 VALIDATION_FAILED만 돌려주지만, 계약
// 형태는 이 작업이 확정한다.
export const NegotiatePayloadSchema = z.strictObject({
  offerId: z.string().min(1),
  ask: NegotiationAskSchema,
});

// T-3-001 D-44: REJECT_OFFER payload. `offerId: null`은 "전부 거절 → 잔류"를 뜻한다.
export const RejectOfferPayloadSchema = z.strictObject({
  offerId: z.string().min(1).nullable(),
});

// T-3-001 D-46: LOAN_RETURN payload.
export const LoanReturnPayloadSchema = z.strictObject({
  decision: z.enum(['RETURN', 'PERMANENT']),
});

/**
 * 명령 타입 → payload 스키마 맵. `CommandRequestSchema`의 판별 유니온 멤버와
 * `CommandLogEntrySchema`의 `commandType`·payload 정합 검사가 이 맵을 공유한다.
 */
export const COMMAND_PAYLOAD_SCHEMAS = {
  CREATE_CAREER: CreateCareerPayloadSchema,
  UPDATE_PLAYER_DRAFT: UpdatePlayerDraftPayloadSchema,
  CONFIRM_PLAYER: ConfirmPlayerPayloadSchema,
  RESOLVE_EVENT: ResolveEventPayloadSchema,
  START_SEASON: StartSeasonPayloadSchema,
  ADVANCE: AdvancePayloadSchema,
  SETTLE_SEASON: SettleSeasonPayloadSchema,
  RESOLVE_ROLE: ResolveRolePayloadSchema,
  RESOLVE_CHAPTER: ResolveChapterPayloadSchema,
  NEGOTIATE: NegotiatePayloadSchema,
  ACCEPT_OFFER: AcceptOfferPayloadSchema,
  REJECT_OFFER: RejectOfferPayloadSchema,
  LOAN_RETURN: LoanReturnPayloadSchema,
  RETIRE: UnknownPayloadSchema,
} as const satisfies Record<CommandType, z.ZodTypeAny>;

export type CommandPayloadByType = {
  [K in CommandType]: z.infer<(typeof COMMAND_PAYLOAD_SCHEMAS)[K]>;
};

function commandRequestMember<Type extends CommandType>(type: Type, payload: (typeof COMMAND_PAYLOAD_SCHEMAS)[Type]) {
  return z.strictObject({
    commandId: ClientIdSchema,
    expectedRevision: z.number().int().nonnegative(),
    type: z.literal(type),
    payload,
  });
}

export const CommandRequestSchema = z.discriminatedUnion('type', [
  commandRequestMember('CREATE_CAREER', COMMAND_PAYLOAD_SCHEMAS.CREATE_CAREER),
  commandRequestMember('UPDATE_PLAYER_DRAFT', COMMAND_PAYLOAD_SCHEMAS.UPDATE_PLAYER_DRAFT),
  commandRequestMember('CONFIRM_PLAYER', COMMAND_PAYLOAD_SCHEMAS.CONFIRM_PLAYER),
  commandRequestMember('RESOLVE_EVENT', COMMAND_PAYLOAD_SCHEMAS.RESOLVE_EVENT),
  commandRequestMember('START_SEASON', COMMAND_PAYLOAD_SCHEMAS.START_SEASON),
  commandRequestMember('ADVANCE', COMMAND_PAYLOAD_SCHEMAS.ADVANCE),
  commandRequestMember('SETTLE_SEASON', COMMAND_PAYLOAD_SCHEMAS.SETTLE_SEASON),
  commandRequestMember('RESOLVE_ROLE', COMMAND_PAYLOAD_SCHEMAS.RESOLVE_ROLE),
  commandRequestMember('RESOLVE_CHAPTER', COMMAND_PAYLOAD_SCHEMAS.RESOLVE_CHAPTER),
  commandRequestMember('NEGOTIATE', COMMAND_PAYLOAD_SCHEMAS.NEGOTIATE),
  commandRequestMember('ACCEPT_OFFER', COMMAND_PAYLOAD_SCHEMAS.ACCEPT_OFFER),
  commandRequestMember('REJECT_OFFER', COMMAND_PAYLOAD_SCHEMAS.REJECT_OFFER),
  commandRequestMember('LOAN_RETURN', COMMAND_PAYLOAD_SCHEMAS.LOAN_RETURN),
  commandRequestMember('RETIRE', COMMAND_PAYLOAD_SCHEMAS.RETIRE),
]);

export type CommandRequest = z.infer<typeof CommandRequestSchema>;

/**
 * 02 `CommandLogEntry`의 필드만 갖는 미검증(refinement 없는) 형태. `.omit()`은 refinement가 붙은
 * 스키마에는 쓸 수 없으므로(zod4), `careers.ts`의 `PutCareerCommandSchema`처럼 필드를 덜어낸
 * 변형이 필요한 소비처는 이 스키마에서 `.omit()`한 뒤 `checkCommandTypePayload`를 다시 붙인다.
 */
export const CommandLogEntryShapeSchema = z.strictObject({
  careerId: ClientIdSchema,
  revision: z.number().int().positive(),
  commandId: ClientIdSchema,
  commandType: CommandTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  resultHash: Hex64Schema,
  createdAt: IsoUtcSchema,
});

/** `commandType`에 맞는 payload 스키마로 다시 검사해 불일치를 거부한다. */
export function checkCommandTypePayload(
  entry: { commandType: CommandType; payload: Record<string, unknown> },
  ctx: z.RefinementCtx,
): void {
  const payloadSchema = COMMAND_PAYLOAD_SCHEMAS[entry.commandType];
  const result = payloadSchema.safeParse(entry.payload);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ ...issue, path: ['payload', ...issue.path] });
    }
  }
}

/**
 * 02 `CommandLogEntry`. `commandId`·`careerId`는 클라이언트가 발급한 ID이며 UUID 형식을 강제하지
 * 않는다. `payload`는 record로 느슨하게 받되, `commandType`에 맞는 payload 스키마로 다시 검사해
 * 불일치를 거부한다(로그는 이미 확정된 명령의 기록이라 discriminatedUnion 대신 이 방식을 쓴다).
 */
export const CommandLogEntrySchema = CommandLogEntryShapeSchema.superRefine(checkCommandTypePayload);

export type CommandLogEntry = z.infer<typeof CommandLogEntrySchema>;

export const NextActionSchema = z.enum(['DECISION', 'ADVANCE', 'SETTLEMENT']);
export type NextAction = z.infer<typeof NextActionSchema>;

export const CommandResponseSchema = successEnvelope(
  z.strictObject({
    snapshot: CareerSnapshotSchema,
    nextAction: NextActionSchema,
    roll: z.number().int().optional(),
    outcomeId: z.string().optional(),
  }),
);

export type CommandResponse = z.infer<typeof CommandResponseSchema>;
