import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

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
    index('sessions_last_seen_at_idx').on(table.lastSeenAt),
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
    index('careers_created_service_season_id_status_idx').on(
      table.createdServiceSeasonId,
      table.status,
    ),
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
  (table) => [
    uniqueIndex('snapshots_career_id_revision_unique').on(table.careerId, table.revision),
  ],
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
    // T-2-012: ANALYTICS_EVENTS(분당 60회/clientId, D-55)가 추가한 kind. text 컬럼이라 마이그레이션은
    // 필요 없다(SQLite는 이 enum을 CHECK 제약으로 만들지 않는다 — TS 타입에서만 강제).
    kind: text('kind', {
      enum: ['RECOVERY_ISSUE', 'RECOVERY_REDEEM', 'GOOGLE_START', 'ANALYTICS_EVENTS', 'CAREER_PUBLICATION', 'FRIENDLY_START'],
    }).notNull(),
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
      enum: [
        'PROFILE_MERGED',
        'PROFILE_DELETED',
        'RECOVERY_CODE_ISSUED',
        'GOOGLE_LINKED',
        'GOOGLE_UNLINKED',
      ],
    }).notNull(),
    profileId: text('profile_id').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_log_profile_id_idx').on(table.profileId)],
);

/** 02 DATA-SVC-001. T-2-012 D-54: `isTest`가 붙었다. */
export const serviceSeasons = sqliteTable(
  'service_seasons',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status', { enum: ['PRESEASON', 'ACTIVE', 'LOCKED', 'ARCHIVED'] }).notNull(),
    startsAt: text('starts_at').notNull(),
    /** null means the operating season is open-ended until an explicit transition is scheduled. */
    endsAt: text('ends_at'),
    rulesetVersion: text('ruleset_version').notNull(),
    contentPackVersion: text('content_pack_version').notNull(),
    challengeSetId: text('challenge_set_id').notNull(),
    /** T-2-012 D-54: Phase 6 도전·앨범 집계는 isTest = 0만 읽는다(지금은 필드·주석·테스트만). */
    isTest: integer('is_test').notNull().default(0),
  },
  (table) => [index('service_seasons_status_idx').on(table.status)],
);

/** T-2-012 D-55. `propsJson`은 `AnalyticsEventInput['props']`를 그대로 담는다(화이트리스트 검증은 라우트가 한다). */
export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull(),
    profileId: text('profile_id'),
    name: text('name').notNull(),
    propsJson: text('props_json').notNull(),
    clientTs: integer('client_ts').notNull(),
    receivedAt: text('received_at').notNull(),
  },
  (table) => [index('analytics_events_client_id_idx').on(table.clientId)],
);
/**
 * 사용자 결정(2026-09-14): 홈 공지사항을 코드 상수(`HOME_NOTICES`)가 아니라 서버가 관리한다.
 * `id`는 사람이 읽는 slug(기존 상수 id를 그대로 옮긴다). `body`는 문단 배열이었던 기존 구조를
 * 줄바꿈 텍스트가 아니라 JSON 문자열 배열로 저장한다 — 문단 자체에 개행이 섞여도 경계가
 * 모호해지지 않고, 라우트가 `JSON.parse`로 그대로 복원해 contracts의 `Notice.body: string[]`와
 * 1:1로 맞는다(줄바꿈 split은 원문 개행과 문단 구분을 구별할 수 없다). `publishedAt`이 정렬 키다.
 */
export const notices = sqliteTable(
  'notices',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    publishedAt: text('published_at').notNull(),
    isPublished: integer('is_published').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('notices_is_published_published_at_idx').on(table.isPublished, table.publishedAt),
  ],
);

/** Private immutable retirement evidence; deleting the owning career cascades to its archive. */
export const careerArchives = sqliteTable('career_archives', {
  careerId: text('career_id')
    .primaryKey()
    .references(() => careers.id, { onDelete: 'cascade' }),
  retirementRevision: integer('retirement_revision').notNull(),
  archiveHash: text('archive_hash').notNull(),
  archiveJson: text('archive_json').notNull(),
  legacyVersion: text('legacy_version').notNull(),
  legacyJson: text('legacy_json').notNull(),
  createdAt: text('created_at').notNull(),
});

/** Explicitly published whitelist. Ownership follows careers through profile merges. */
export const careerPublications = sqliteTable('career_publications', {
  id: text('id').primaryKey(),
  careerId: text('career_id').notNull().unique().references(() => careers.id, { onDelete: 'cascade' }),
  articleJson: text('article_json').notNull(),
  createdAt: text('created_at').notNull(),
});

/** Atomic challenge replay guard; follows child career deletion, not source publication. */
export const careerChallengeAdmissions = sqliteTable('career_challenge_admissions', {
  keyHash: text('key_hash').primaryKey(),
  careerId: text('career_id').notNull().references(() => careers.id, { onDelete: 'cascade' }),
  requestHash: text('request_hash').notNull(),
  responseJson: text('response_json').notNull(),
});

/** Account-owned lineups; career simulation state is never mutated by team editing. */
export const lockerTeams = sqliteTable(
  'locker_teams',
  {
    id: text('id').primaryKey(),
    ownerProfileId: text('owner_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    formation: text('formation').notNull(),
    lineupJson: text('lineup_json').notNull(),
    revision: integer('revision').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('locker_teams_owner_idx').on(table.ownerProfileId)],
);

/** Private immutable friendly receipts survive team/career deletion, but never profile deletion. */
export const friendlyMatches = sqliteTable('friendly_matches', {
  id: text('id').primaryKey(),
  ownerProfileId: text('owner_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  requestKeyHash: text('request_key_hash').notNull().unique(),
  requestHash: text('request_hash').notNull(),
  receiptJson: text('receipt_json').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('friendly_matches_owner_idx').on(table.ownerProfileId, table.createdAt)]);
