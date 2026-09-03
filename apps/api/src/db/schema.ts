import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** 02 DATA-PRO-001. 시각은 ISO 8601 UTC TEXT다(설계 결정 7). */
export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    recoveryCodeHash: text('recovery_code_hash'),
    recoveryCodeIssuedAt: text('recovery_code_issued_at'),
    googleSub: text('google_sub'),
    email: text('email'),
    linkedAt: text('linked_at'),
    tossAnonKeyHash: text('toss_anon_key_hash'),
    tossLinkedAt: text('toss_linked_at'),
    settingsJson: text('settings_json').notNull(),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    /** T-1-004 API-PRO-005. NULL이 아니면 삭제된 프로필이다(09 문서: 사용자 요청 삭제는 즉시). */
    deletedAt: text('deleted_at'),
  },
  (table) => [
    uniqueIndex('profiles_google_sub_unique').on(table.googleSub),
    uniqueIndex('profiles_toss_anon_key_hash_unique').on(table.tossAnonKeyHash),
  ],
);

/** ADR-002 세션. web은 쿠키, toss는 Bearer 토큰이지만 세션 테이블은 같다. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: ['web', 'toss'] }).notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    lastSeenAt: text('last_seen_at').notNull(),
    /** T-1-013 D-21. Google 콜백이 병합 선택을 기다릴 때만 채워진다(10분 TTL). */
    pendingMergeProfileId: text('pending_merge_profile_id'),
    pendingMergeExpiresAt: text('pending_merge_expires_at'),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_profile_id_idx').on(table.profileId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * 서버의 Career 행은 요약이다(설계 결정 1). `currentDate`·`currentTeamId`·`rngState` 같은 진행 값은
 * Snapshot `state` 안에 있으므로 여기 두지 않는다.
 */
export const careers = sqliteTable(
  'careers',
  {
    id: text('id').primaryKey(),
    ownerProfileId: text('owner_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['DRAFT', 'ACTIVE', 'RETIRED', 'ARCHIVED'] }).notNull(),
    revision: integer('revision').notNull(),
    createdServiceSeasonId: text('created_service_season_id')
      .notNull()
      .references(() => serviceSeasons.id),
    rulesetVersion: text('ruleset_version').notNull(),
    contentPackVersion: text('content_pack_version').notNull(),
    verificationStatus: text('verification_status', { enum: ['PENDING', 'VERIFIED', 'FAILED'] })
      .notNull()
      .default('PENDING'),
    lastSyncedAt: text('last_synced_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    archivedAt: text('archived_at'),
  },
  (table) => [
    index('careers_owner_profile_id_updated_at_idx').on(table.ownerProfileId, table.updatedAt),
    index('careers_created_service_season_id_status_idx').on(table.createdServiceSeasonId, table.status),
  ],
);

/** 05 Snapshot 계약. `id`는 `${careerId}:${revision}`. */
export const snapshots = sqliteTable(
  'snapshots',
  {
    id: text('id').primaryKey(),
    careerId: text('career_id')
      .notNull()
      .references(() => careers.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    checkpoint: text('checkpoint').notNull(),
    state: text('state').notNull(),
    stateHash: text('state_hash').notNull(),
    rulesetVersion: text('ruleset_version').notNull(),
    contentPackVersion: text('content_pack_version').notNull(),
    rngStateJson: text('rng_state_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('snapshots_career_id_revision_unique').on(table.careerId, table.revision)],
);

/** 02 `CommandLogEntry`. PK가 같은 revision 재삽입을 막아 원자성을 준다(설계 결정 2). */
export const commandLog = sqliteTable(
  'command_log',
  {
    careerId: text('career_id')
      .notNull()
      .references(() => careers.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    commandId: text('command_id').notNull(),
    commandType: text('command_type').notNull(),
    payloadJson: text('payload_json').notNull(),
    resultHash: text('result_hash').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.careerId, table.revision] }),
    index('command_log_career_id_command_id_idx').on(table.careerId, table.commandId),
  ],
);

/** 서버 idempotency는 HTTP Idempotency-Key 단위다(설계 결정 3). */
export const idempotency = sqliteTable(
  'idempotency',
  {
    ownerProfileId: text('owner_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: text('response_body').notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerProfileId, table.key] }),
    index('idempotency_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * T-1-004 D-14·D-15. 고정 윈도우 rate limit 카운터. `(kind, subject)`당 한 행만 유지하며 윈도우가
 * 지나면 재사용한다(설계: `window_start`가 지금부터 윈도우 길이 이전이면 리셋).
 */
export const authAttempts = sqliteTable(
  'auth_attempts',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['RECOVERY_ISSUE', 'RECOVERY_REDEEM', 'GOOGLE_START'] }).notNull(),
    subject: text('subject').notNull(),
    windowStart: text('window_start').notNull(),
    count: integer('count').notNull(),
  },
  (table) => [uniqueIndex('auth_attempts_kind_subject_unique').on(table.kind, table.subject)],
);

/** T-1-004, ADR-008. `PROFILE_MERGED`·`PROFILE_DELETED`·`RECOVERY_CODE_ISSUED`·`GOOGLE_LINKED`·`GOOGLE_UNLINKED`(T-1-013). */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    kind: text('kind', {
      enum: ['PROFILE_MERGED', 'PROFILE_DELETED', 'RECOVERY_CODE_ISSUED', 'GOOGLE_LINKED', 'GOOGLE_UNLINKED'],
    }).notNull(),
    profileId: text('profile_id').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_log_profile_id_idx').on(table.profileId)],
);

/** 02 DATA-SVC-001. */
export const serviceSeasons = sqliteTable(
  'service_seasons',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status', { enum: ['PRESEASON', 'ACTIVE', 'LOCKED', 'ARCHIVED'] }).notNull(),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    rulesetVersion: text('ruleset_version').notNull(),
    contentPackVersion: text('content_pack_version').notNull(),
    challengeSetId: text('challenge_set_id').notNull(),
  },
  (table) => [index('service_seasons_status_idx').on(table.status)],
);
