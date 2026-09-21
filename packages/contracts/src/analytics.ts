import { z } from 'zod';
import { ChapterOutcomeKindSchema, SimulationModeSchema } from './career-state.js';
import { CommandTypeSchema } from './commands.js';
import { ErrorCodeSchema } from './errors.js';
import { ClientIdSchema } from './primitives.js';

/** T-2-012 D-55 "이벤트 표". PII(선수 이름·성별·서사 전문 등)는 키 자체가 없다. */
export const ANALYTICS_EVENT_NAMES = [
  'screen_viewed',
  'choice_previewed',
  'choice_selected',
  'chapter_decision_resolved',
  'role_proposal_resolved',
  'command_submitted',
  'command_resolved',
  'command_failed',
  'funnel_reached',
  'step_passed',
  'season_settled',
  'career_abandoned_hint',
] as const;

export const AnalyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;

const ScreenIdSchema = z.string().regex(/^SCR-\d{3}$/, 'SCR-000 형식이어야 한다.');
/** `screen_viewed.careerPhase`: 커리어 없음('NONE')·선수 생성 중(`PLAYER_CREATION_CAREER_PHASE`='YOUTH')·
 * 아니면 `state.seasonPhase`(도메인 `SeasonPhase`) 그대로다(apps/web의 기존 30여 호출부 기준). */
const CareerPhaseSchema = z.enum(['NONE', 'YOUTH', 'PRESEASON', 'LEAGUE', 'CUP', 'TRANSFER_WINDOW', 'SETTLEMENT',
]);
/** `career_abandoned_hint.seasonPhase`: 도메인 `SeasonPhase` 그대로(커리어에는 항상 값이 있다, NONE 없음). */
const SeasonPhaseSchema = z.enum(['PRESEASON', 'LEAGUE', 'CUP', 'TRANSFER_WINDOW', 'SETTLEMENT']);
const RiskLabelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
const RoleProposalTypeSchema = z.enum(['KEEP', 'POSITION_CHANGE', 'ROLE_CHANGE']);
const RoleDecisionSchema = z.enum(['ACCEPT', 'DECLINE']);
const OutcomeClassSchema = z.enum(['DECISION', 'ADVANCE', 'SETTLEMENT']);
const LatencyBucketSchema = z.enum(['<100ms', '<500ms', '<2s', '>=2s']);
const FunnelStageSchema = z.enum(['ONBOARDING_STARTED', 'PLAYER_CONFIRMED', 'CONTRACT_SIGNED', 'SEASON_STARTED',
  'FIRST_MATCH_DECISION',
  'FIRST_MATCH_COMPLETED',
  'SEASON_SETTLED',
]);
const ElapsedSecBucketSchema = z.enum(['<60', '<180', '<360', '<720', '<1800', '>=1800']);
/** T-4-024: 실사용자 플레이 시간 측정용 초 단위 경과(bucket과 별개). 상한 2시간(7200초). */
const ElapsedSecSchema = z.number().int().nonnegative().max(7200);
const CareerIndexSchema = z.number().int().positive();
const StepSchema = z.number().int().nonnegative();
const SeasonIndexSchema = z.number().int().nonnegative();

/** 이름별 props 스키마. 화이트리스트 자체이기도 하다 — 여기 없는 이름은 서버가 통째로 버린다. */
export const ANALYTICS_EVENT_PROPS_SCHEMAS = {
  screen_viewed: z.strictObject({ screenId: ScreenIdSchema, careerPhase: CareerPhaseSchema }),
  choice_previewed: z.strictObject({ eventId: z.string().min(1).max(64), choiceId: z.string().min(1).max(64),
  }),
  choice_selected: z.strictObject({
    eventId: z.string().min(1).max(64),
    choiceId: z.string().min(1).max(64),
    riskLabel: RiskLabelSchema,
  }),
  chapter_decision_resolved: z.strictObject({
    chapterId: z.string().min(1).max(64),
    decisionId: z.string().min(1).max(64),
    optionId: z.string().min(1).max(64),
    outcomeKind: ChapterOutcomeKindSchema,
  }),
  role_proposal_resolved: z.strictObject({ type: RoleProposalTypeSchema, decision: RoleDecisionSchema,
  }),
  command_submitted: z.strictObject({ commandType: CommandTypeSchema }),
  command_resolved: z.strictObject({
    commandType: CommandTypeSchema,
    outcomeClass: OutcomeClassSchema,
    latencyBucket: LatencyBucketSchema,
  }),
  command_failed: z.strictObject({ commandType: CommandTypeSchema, errorCode: ErrorCodeSchema }),
  funnel_reached: z.strictObject({
    stage: FunnelStageSchema,
    careerIndex: CareerIndexSchema,
    elapsedSecBucket: ElapsedSecBucketSchema,
  }),
  step_passed: z.strictObject({
    seasonIndex: SeasonIndexSchema,
    step: StepSchema,
    simulationMode: SimulationModeSchema,
    // T-4-024: baseline(시즌 시작 기준)을 못 찾으면 클라이언트가 필드를 생략한다.
    elapsedSec: ElapsedSecSchema.optional(),
  }),
  season_settled: z.strictObject({
    seasonIndex: SeasonIndexSchema,
    simulationMode: SimulationModeSchema,
    decisionsOpened: z.number().int().nonnegative(),
    matchesPlayed: z.number().int().nonnegative(),
    elapsedSecBucket: ElapsedSecBucketSchema,
    // T-4-024: 배포 직후 구버전 클라이언트(elapsedSec 없이 season_settled를 보내는 번들)의 이벤트를
    // strictObject가 통째로 버리지 않도록 optional로 둔다 — 현재 클라이언트는 항상 채워 보낸다.
    elapsedSec: ElapsedSecSchema.optional(),
  }),
  career_abandoned_hint: z.strictObject({
    seasonIndex: SeasonIndexSchema,
    step: StepSchema,
    seasonPhase: SeasonPhaseSchema,
  }),
} as const satisfies Record<AnalyticsEventName, z.ZodTypeAny>;

/** 본문 형태만 본다 — props는 이름별 스키마로 라우트가 따로 검증해 건별로 버린다. */
export const AnalyticsEventInputSchema = z.strictObject({
  name: z.string().min(1).max(64),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  clientTs: z.number().int().nonnegative(),
});

export type AnalyticsEventInput = z.infer<typeof AnalyticsEventInputSchema>;

export const ANALYTICS_EVENTS_MAX_COUNT = 50;

/** API-ANA-001 본문. */
export const AnalyticsEventsBodySchema = z.strictObject({
  clientId: ClientIdSchema,
  events: z.array(AnalyticsEventInputSchema).min(1).max(ANALYTICS_EVENTS_MAX_COUNT),
});

export type AnalyticsEventsBody = z.infer<typeof AnalyticsEventsBodySchema>;
