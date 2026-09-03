export const CONTRACTS_VERSION = '0.2.0';

export {
  MetaSchema,
  successEnvelope,
  ErrorEnvelopeSchema,
  envelope,
  type Meta,
  type ErrorEnvelope,
} from './envelope.js';

export {
  ERROR_CODES,
  ErrorCodeSchema,
  HTTP_STATUS_BY_CODE,
  RETRYABLE_BY_CODE,
  type ErrorCode,
} from './errors.js';

export { SemverSchema, VersionTripleSchema, CLIENT_MIN_VERSION_HEADER, type VersionTriple } from './versions.js';

export {
  CHECKPOINT_TYPES,
  CheckpointTypeSchema,
  RngStateSchema,
  SNAPSHOT_STATE_MAX_BYTES,
  CareerSnapshotSchema,
  SnapshotStateEnvelopeSchema,
  type CheckpointType,
  type RngState,
  type CareerSnapshot,
  type SnapshotStateEnvelope,
} from './snapshot.js';

export {
  COMMAND_TYPES,
  CommandTypeSchema,
  CommandRequestSchema,
  CommandLogEntrySchema,
  NextActionSchema,
  CommandResponseSchema,
  CreateCareerPayloadSchema,
  UpdatePlayerDraftPayloadSchema,
  ConfirmPlayerPayloadSchema,
  AdvancePayloadSchema,
  ResolveEventPayloadSchema,
  AcceptOfferPayloadSchema,
  COMMAND_PAYLOAD_SCHEMAS,
  type CommandType,
  type CommandRequest,
  type CommandLogEntry,
  type NextAction,
  type CommandResponse,
  type CommandPayloadByType,
  type Phase1CommandType,
} from './commands.js';

export {
  PositionSchema,
  PositionGroupSchema,
  PreferredFootSchema,
  PlayerGenderSchema,
  PlayerDraftSchema,
  PlayerProfileSchema,
  PlayerPublicSchema,
  toPlayerPublic,
  type PlayerDraft,
  type PlayerPublic,
} from './player.js';

export {
  SquadRoleSchema,
  LeagueTierSchema,
  OfferSchema,
  ContractSchema,
  PendingSchema,
  TimelineEntrySchema,
  EffectSchema,
  CAREER_STATE_ATTRIBUTE_KEYS,
  AttributesSchema,
  CareerStateSchema,
  type CareerState,
} from './career-state.js';

export {
  RECOVERY_CODE_ALPHABET,
  normalizeRecoveryCode,
  formatRecoveryCode,
  RecoveryCodeInputSchema,
  MergeChoiceSchema,
  IssueRecoveryCodeResponseSchema,
  RecoverProfileBodySchema,
  RecoverProfileResponseSchema,
  RecoveryConflictDetailsSchema,
  DeleteProfileStartResponseSchema,
  DeleteProfileConfirmBodySchema,
  MergeRequestBodySchema,
  MergeResponseSchema,
  PendingMergeSchema,
  type MergeChoice,
  type IssueRecoveryCodeResponse,
  type RecoverProfileBody,
  type RecoverProfileResponse,
  type RecoveryConflictDetails,
  type DeleteProfileStartResponse,
  type DeleteProfileConfirmBody,
  type MergeRequestBody,
  type MergeResponse,
  type PendingMerge,
} from './auth.js';

export {
  PutCareerBodySchema,
  PutCareerResponseSchema,
  CareerSummarySchema,
  CareerSummaryListSchema,
  GetCareerResponseSchema,
  RevisionConflictDetailsSchema,
  type PutCareerBody,
  type PutCareerResponse,
  type CareerSummary,
  type CareerSummaryList,
  type GetCareerResponse,
  type RevisionConflictDetails,
} from './careers.js';

export {
  ProfileSettingsSchema,
  ProfileSchema,
  PatchProfileSettingsBodySchema,
  TossSessionBodySchema,
  TossSessionResponseSchema,
  type ProfileSettings,
  type Profile,
  type PatchProfileSettingsBody,
  type TossSessionBody,
  type TossSessionResponse,
} from './profile.js';

export {
  IDEMPOTENCY_KEY_HEADER,
  IF_MATCH_HEADER,
  AUTHORIZATION_HEADER,
  REQUEST_ID_HEADER,
  CONTENT_TYPE_HEADER,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
  REQUEST_BODY_MAX_BYTES,
  SNAPSHOT_STATE_RECOMMENDED_BYTES,
} from './headers.js';

export { HealthDataSchema, HealthResponseSchema, type HealthData, type HealthResponse } from './health.js';

export { IsoUtcSchema, Hex64Schema, Uint32Schema, ClientIdSchema } from './primitives.js';
