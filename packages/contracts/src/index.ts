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

export {
  RECOVERY_CODE_ALPHABET,
  normalizeRecoveryCode,
  formatRecoveryCode,
  RecoveryCodeInputSchema,
  IssueRecoveryCodeResponseSchema,
  RecoverProfileBodySchema,
  RecoverProfileResponseSchema,
  DeleteProfileStartResponseSchema,
  DeleteProfileConfirmBodySchema,
  type IssueRecoveryCodeResponse,
  type RecoverProfileBody,
  type RecoverProfileResponse,
  type DeleteProfileStartResponse,
  type DeleteProfileConfirmBody,
} from './auth.js';

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
} from './headers.js';

export { HealthDataSchema, HealthResponseSchema, type HealthData, type HealthResponse } from './health.js';

export {
  CareerPosSchema,
  CareerFootSchema,
  CareerMetaSchema,
  CareerHonorSchema,
  CareerSeasonPayloadSchema,
  SeasonCompSchema,
  type SeasonComp,
  EventLogEntrySchema,
  PutCareerSeasonBodySchema,
  CareerUpsertResponseSchema,
  RetirementSummarySchema,
  PutRetirementBodySchema,
  RetirementResponseSchema,
  CareerIdParamSchema,
  CareerYearParamSchema,
  PublicNameSchema,
  LegendSnapshotSchema,
  PublicHofEntrySchema,
  TitleIdSchema,
  ServerFirstCatSchema,
  ServerFirstSchema,
  FirstsResponseSchema,
  type ServerFirstCat,
  type ServerFirst,
  type FirstsResponse,
  HofListResponseSchema,
  MyCareersResponseSchema,
  HofDetailResponseSchema,
  HofListQuerySchema,
  HofPageQuerySchema,
  HofSortSchema,
  type LegendSnapshot,
  type PublicHofEntry,
  type HofListResponse,
  type HofSort,
  type MyCareersResponse,
  type HofDetailResponse,
  type CareerPos,
  type CareerFoot,
  type CareerMeta,
  type CareerSeasonPayload,
  type EventLogEntry,
  type PutCareerSeasonBody,
  type CareerUpsertResponse,
  type RetirementSummary,
  type PutRetirementBody,
  type RetirementResponse,
} from './careers.js';

export {
  CLUB_CUSTOM_MAX_CLUBS,
  CLUB_CUSTOM_NAME_MAX,
  CLUB_CUSTOM_LOGO_TEXT_MAX,
  CLUB_CUSTOM_IMG_MAX,
  ClubLogoSchema,
  ClubCustomSchema,
  ClubCustomMapSchema,
  PutClubCustomBodySchema,
  ClubCustomResponseSchema,
  type ClubLogo,
  type ClubCustom,
  type ClubCustomMap,
  type PutClubCustomBody,
  type ClubCustomResponse,
} from './clubs.js';

export { IsoUtcSchema, Hex64Schema, Uint32Schema, ClientIdSchema } from './primitives.js';

export * from './boards.js';
export * from './balance.js';
export * from './admin.js';
