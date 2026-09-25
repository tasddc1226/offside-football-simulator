import { index, primaryKey, sqliteTable, text, uniqueIndex, integer, real } from 'drizzle-orm/sqlite-core';

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
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_profile_id_idx').on(table.profileId),
    index('sessions_expires_at_idx').on(table.expiresAt),
    index('sessions_last_seen_at_idx').on(table.lastSeenAt),
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
    kind: text('kind', {
      enum: ['RECOVERY_ISSUE', 'RECOVERY_REDEEM', 'GOOGLE_START', 'BOARD_COMMENT'],
    }).notNull(),
    subject: text('subject').notNull(),
    windowStart: text('window_start').notNull(),
    count: integer('count').notNull(),
  },
  (table) => [uniqueIndex('auth_attempts_kind_subject_unique').on(table.kind, table.subject)],
);

/**
 * T-9-009. 익명 포함 전체 사용자의 플레이 데이터. 세이브 전체가 아니라 커리어 메타 + 은퇴 요약만
 * 담는다(선수 이름 제외 — 실명일 수 있다). 시즌별 상세는 `careerSeasons`.
 */
export const careers = sqliteTable(
  'careers',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    pos: text('pos', { enum: ['FW', 'MF', 'DF', 'GK'] }).notNull(),
    foot: text('foot', { enum: ['오른발', '왼발', '양발'] }).notNull(),
    type: text('type').notNull(),
    trait: text('trait').notNull(),
    startYear: integer('start_year').notNull(),
    status: text('status', { enum: ['active', 'retired'] }).notNull(),
    appVersion: text('app_version').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    retiredAt: text('retired_at'),
    // 은퇴 요약(NULL until retired).
    retireAge: integer('retire_age'),
    peak: integer('peak'),
    legendScore: integer('legend_score'),
    apps: integer('apps'),
    goals: integer('goals'),
    assists: integer('assists'),
    trophies: integer('trophies'),
    awards: integer('awards'),
    caps: integer('caps'),
    ballon: integer('ballon'),
    lastClub: text('last_club'),
    // T-10-005 공개 명예의 전당. publicName은 유저가 이름 공개를 고른 경우에만 채운다(기본 NULL = 익명).
    // snapshotJson은 은퇴 상세(시즌별 기록·수상·여정) — 선수 이름은 들어 있지 않다.
    publicName: text('public_name'),
    shirtNumber: integer('shirt_number'),
    snapshotJson: text('snapshot_json'),
  },
  (table) => [
    index('careers_profile_id_idx').on(table.profileId),
    index('careers_status_legend_idx').on(table.status, table.legendScore),
  ],
);

/**
 * T-9-009. 시즌 한 줄 요약 + 그 시즌에 버퍼링된 선택 로그(`eventsJson`). D1 free plan은 행 단위로
 * 쓰기를 과금하므로 이벤트별 행을 만들지 않고 시즌당 한 행에 JSON TEXT로 합친다.
 */
export const careerSeasons = sqliteTable(
  'career_seasons',
  {
    careerId: text('career_id')
      .notNull()
      .references(() => careers.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    age: integer('age').notNull(),
    club: text('club').notNull(),
    league: text('league').notNull(),
    apps: integer('apps').notNull(),
    goals: integer('goals').notNull(),
    assists: integer('assists').notNull(),
    rating: real('rating').notNull(),
    // game/types.ts `CareerRecord.rank`가 number|string이라 텍스트로 저장한다.
    rank: text('rank').notNull(),
    ovr: integer('ovr').notNull(),
    honorsJson: text('honors_json').notNull(),
    mil: integer('mil').notNull(),
    eventsJson: text('events_json').notNull(),
    // T-10-006 시즌 상세. 이 컬럼 이전에 쌓인 행·옛 클라이언트 업로드는 NULL(= 기록 없음).
    cs: integer('cs'),
    lgApps: integer('lg_apps'),
    lgGoals: integer('lg_goals'),
    caps: integer('caps'),
    compsJson: text('comps_json'),
    chJson: text('ch_json'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.careerId, table.year] })],
);

/** T-1-004, ADR-008. `PROFILE_DELETED`·`RECOVERY_CODE_ISSUED`·`GOOGLE_LINKED`·`GOOGLE_UNLINKED`(T-1-013). */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    kind: text('kind', {
      enum: ['PROFILE_DELETED', 'RECOVERY_CODE_ISSUED', 'GOOGLE_LINKED', 'GOOGLE_UNLINKED'],
    }).notNull(),
    profileId: text('profile_id').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_log_profile_id_idx').on(table.profileId)],
);

/** T-10-010. 프로필별 클럽 이름·엠블럼 커스텀(JSON 통째 저장, 최신 쓰기 우선). updated_at은 클라이언트가
 * 마지막으로 바꾼 시각이다(서버 수신 시각이 아니다 — 기기 간 비교 기준). */
export const clubCustoms = sqliteTable('club_customs', {
  profileId: text('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  clubsJson: text('clubs_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/** T-10-011. 게시판 글(공지·릴리즈 노트 …). 관리자만 쓴다. 지우면 deleted_at만 채운다(댓글과 함께 숨김). */
export const boardPosts = sqliteTable(
  'board_posts',
  {
    id: text('id').primaryKey(),
    board: text('board').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    version: text('version'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    authorProfileId: text('author_profile_id').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [index('board_posts_board_created_idx').on(table.board, table.createdAt)],
);

/** T-10-011. 글마다 달리는 댓글. 프로필이 있는 누구나 쓰고, 본인·관리자가 지운다(deleted_at). */
export const boardComments = sqliteTable(
  'board_comments',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => boardPosts.id, { onDelete: 'cascade' }),
    profileId: text('profile_id').notNull(),
    nickname: text('nickname').notNull(),
    body: text('body').notNull(),
    admin: integer('admin', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('board_comments_post_created_idx').on(table.postId, table.createdAt),
    index('board_comments_profile_idx').on(table.profileId),
  ],
);
