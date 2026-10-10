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
  PutNicknameBodySchema,
  type PutNicknameBody,
  type ProfileSettings,
  type Profile,
  type PatchProfileSettingsBody,
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

export { HealthDataSchema } from './health.js';

export {
  CareerPosSchema,
  DetailPosSchema,
  PeakProfileSchema,
  CareerFootSchema,
  CareerMetaSchema,
  CareerHonorSchema,
  CareerSeasonPayloadSchema,
  SeasonCompSchema,
  type SeasonComp,
  SeasonGrowthSchema,
  type SeasonGrowth,
  EventLogEntrySchema,
  PlaySignalsSchema,
  PutCareerSeasonBodySchema,
  CareerUpsertResponseSchema,
  RetirementSummarySchema,
  PutRetirementBodySchema,
  RetirementResponseSchema,
  RetiredNumberResultSchema,
  RetiredNumbersResponseSchema,
  RetiredNumbersSummarySchema,
  RetiredClubQuerySchema,
  RetiredBeforeQuerySchema,
  RETIRED_PAGE,
  RetiredNumberCheckResponseSchema,
  type RetiredNumberCheckResponse,
  RetiredNumberMissSchema,
  type RetiredNumberMiss,
  type RetiredNumberResult,
  type RetiredNumbersResponse,
  type RetiredNumbersSummary,
  type WallOfHonorItem,
  CareerIdParamSchema,
  CareerYearParamSchema,
  PublicNameSchema,
  LegendSnapshotSchema,
  PlayStyleSchema,
  PublicHofEntrySchema,
  TitleIdSchema,
  ClubIdSchema,
  ServerFirstCatSchema,
  ServerFirstSchema,
  ServerRecordSchema,
  FirstsResponseSchema,
  type ServerFirstCat,
  type ServerFirst,
  type ServerRecord,
  type FirstsResponse,
  HofListResponseSchema,
  MyCareersResponseSchema,
  HofDetailResponseSchema,
  HofListQuerySchema,
  HofPageQuerySchema,
  HofSearchQuerySchema,
  HofSeasonQuerySchema,
  SeasonPickQuerySchema,
  HofPosQuerySchema,
  HofSortSchema,
  type LegendSnapshot,
  type PlayStyle,
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
  type PlaySignals,
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
  CLUB_CUSTOM_IMG_TOTAL_MAX,
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

export { IsoUtcSchema } from './primitives.js';

export * from './boards.js';
export * from './chat.js';
export * from './balance.js';
export * from './admin.js';
export * from './live.js';
export * from './ticker.js';
export * from './season-gauge-api.js';
export * from './teams.js';
export * from './cup.js';
export * from './cup-api.js';
export * from './friends.js';
export * from './market.js';
export * from './season-recap.js';
export * from './owner-profile.js';
export * from './owner-tier.js';

export * from './app-auth.js';
export * from './app-version.js';
export * from './release-notes.js';
export * from './translate.js';
export * from './push.js';
export * from './notifications.js';
export * from './push-performance.js';

export * from './admin-cup-predictions.js';
