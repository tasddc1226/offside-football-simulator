import type { AttributeKey } from '@offside/domain';
import { z } from 'zod';
import { PlayerDraftSchema, PlayerProfileSchema } from './player.js';
import { RngStateSchema } from './snapshot.js';
import { SemverSchema } from './versions.js';

export const SquadRoleSchema = z.enum(['STARTER', 'ROTATION', 'BENCH', 'RESERVE']);

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

// D-10: `pending`은 판별 유니온. `null`(대기 없음), `EVENT`(RESOLVE_EVENT 대기), `OFFERS`(ACCEPT_OFFER 대기).
export const PendingSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('EVENT'), eventId: z.string().min(1), version: z.number().int().positive() }),
    z.strictObject({ kind: z.literal('OFFERS'), offers: z.array(OfferSchema) }),
  ])
  .nullable();

// D-12: 타임라인. 문장은 넣지 않는다(웹이 팩·룰셋에서 조합한다). `refId`는 이벤트면
// `EVT-…:choiceId:outcomeId`, 계약이면 contract id.
export const TimelineEntrySchema = z.strictObject({
  revision: z.number().int().positive(),
  kind: z.enum(['CAREER_CONFIRMED', 'EVENT_RESOLVED', 'CONTRACT_SIGNED', 'SEASON_SETTLED']),
  refId: z.string().nullable(),
  age: z.number().int(),
  step: z.number().int(),
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
  seasonPhase: z.enum(['PRESEASON', 'LEAGUE', 'CUP', 'TRANSFER_WINDOW', 'SETTLEMENT']),
  simulationMode: z.enum(['FAST', 'CHAPTER']),
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
});

export type CareerState = z.infer<typeof CareerStateSchema>;
