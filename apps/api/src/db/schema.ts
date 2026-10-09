import { sql } from 'drizzle-orm';
import { COMMENT_REPORT_REASONS, NAME_REPORT_KINDS } from '@offside/contracts/board-limits';
import {
  check,
  index,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  integer,
  real,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

/** T-11-070 게시판별 KST 하루 첫 글. 삭제·수정·재배포로 발송 이력을 다시 만들지 않는다. */
export const pushNewsEvents = sqliteTable(
  'push_news_events',
  {
    id: text('id').primaryKey(),
    board: text('board', { enum: ['notice', 'release'] }).notNull(),
    day: text('day').notNull(),
    postId: text('post_id').notNull(),
    title: text('title').notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [
    uniqueIndex('push_news_events_day_unique').on(t.board, t.day),
    index('push_news_events_expires_idx').on(t.expiresAt),
  ],
);

/** 기기별 outbox. 접수 결과가 불명확하면 재발송하지 않아 중복 알림을 피한다. */
export const pushNewsDeliveries = sqliteTable(
  'push_news_deliveries',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => pushNewsEvents.id, { onDelete: 'cascade' }),
    installationHash: text('installation_hash').notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    state: text('state', {
      enum: [
        'pending',
        'sending',
        'accepted',
        'checking',
        'confirmed',
        'failed',
        'unknown',
        'cancelled',
      ],
    })
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    receiptAttempts: integer('receipt_attempts').notNull().default(0),
    dueAt: text('due_at').notNull(),
    leaseId: text('lease_id'),
    ticketId: text('ticket_id'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('push_news_deliveries_device_unique').on(t.eventId, t.installationHash),
    index('push_news_deliveries_due_idx').on(t.state, t.dueAt),
    index('push_news_deliveries_session_idx').on(t.sessionId),
    index('push_news_deliveries_profile_idx').on(t.profileId),
    index('push_news_deliveries_installation_idx').on(t.installationHash),
  ],
);

/** 프로필별 알림함. OS 전달 상태와 읽음 상태는 별개이며 기기·세션 교체에도 기록을 유지한다. */
export const pushPreferences = sqliteTable('push_preferences', {
  profileId: text('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  notice: integer('notice', { mode: 'boolean' }).notNull().default(true),
  release: integer('release', { mode: 'boolean' }).notNull().default(true),
  team: integer('team', { mode: 'boolean' }).notNull().default(true),
  market: integer('market', { mode: 'boolean' }).notNull().default(true),
  social: integer('social', { mode: 'boolean' }).notNull().default(true),
});

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sourceKey: text('source_key').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    targetJson: text('target_json').notNull(),
    createdAt: text('created_at').notNull(),
    readAt: text('read_at'),
    pushReservedAt: text('push_reserved_at'),
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [
    uniqueIndex('notifications_source_unique').on(t.profileId, t.sourceKey),
    index('notifications_profile_created_idx').on(t.profileId, t.createdAt, t.id),
    index('notifications_profile_read_created_idx').on(t.profileId, t.readAt, t.createdAt, t.id),
    index('notifications_expires_idx').on(t.expiresAt),
    index('notifications_created_idx').on(t.createdAt),
    index('notifications_profile_push_reserved_idx').on(t.profileId, t.pushReservedAt),
  ],
);

/** 개인 이벤트 발송 outbox. 공지 발송 큐를 바꾸지 않고 동일한 동의·세션 경계를 적용한다. */
export const pushDeliveries = sqliteTable(
  'push_deliveries',
  {
    id: text('id').primaryKey(),
    notificationId: text('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    installationHash: text('installation_hash').notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    state: text('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    receiptAttempts: integer('receipt_attempts').notNull().default(0),
    dueAt: text('due_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    leaseId: text('lease_id'),
    ticketId: text('ticket_id'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('push_deliveries_device_unique').on(t.notificationId, t.installationHash),
    index('push_deliveries_due_idx').on(t.state, t.dueAt),
    index('push_deliveries_installation_idx').on(t.installationHash),
    index('push_deliveries_profile_idx').on(t.profileId),
    index('push_deliveries_session_idx').on(t.sessionId),
    index('push_deliveries_expires_idx').on(t.expiresAt),
  ],
);

/** 토큰·기기·세션을 복사하지 않는 발송 결과. 알림함과 함께 90일 보관한다. */
export const pushResults = sqliteTable(
  'push_results',
  {
    id: text('id').primaryKey(),
    notificationId: text('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    state: text('state').notNull(),
    acceptedAt: text('accepted_at'),
    confirmedAt: text('confirmed_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('push_results_notification_idx').on(t.notificationId)],
);

export const pushInteractions = sqliteTable('push_interactions', {
  notificationId: text('notification_id')
    .primaryKey()
    .references(() => notifications.id, { onDelete: 'cascade' }),
  clickedAt: text('clicked_at').notNull(),
  targetOpenedAt: text('target_opened_at'),
});

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
    /** T-10-028 댓글에 쓰는 닉네임(구글 로그인한 프로필만 정한다). 대소문자만 다른 닉네임도 겹치지 못한다. */
    nickname: text('nickname'),
    /** T-11-003 Sign in with Apple 사용자 id(앱). 구글과 따로 연결된다. */
    appleSub: text('apple_sub'),
    appleLinkedAt: text('apple_linked_at'),
    /** T-11-098 친구 코드(초대 링크·코드 입력). 처음 친구 화면을 열 때 만든다. */
    friendCode: text('friend_code'),
  },
  (table) => [
    uniqueIndex('profiles_google_sub_unique').on(table.googleSub),
    uniqueIndex('profiles_friend_code_unique').on(table.friendCode),
    uniqueIndex('profiles_apple_sub_unique').on(table.appleSub),
    uniqueIndex('profiles_nickname_unique').on(sql`lower(${table.nickname})`),
    uniqueIndex('profiles_toss_anon_key_hash_unique').on(table.tossAnonKeyHash),
  ],
);

/** ADR-002 세션. web은 쿠키, toss·app(T-11-003 네이티브 앱)은 Bearer 토큰이지만 세션 테이블은 같다. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: ['web', 'toss', 'app'] }).notNull(),
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
      enum: [
        'RECOVERY_ISSUE',
        'RECOVERY_REDEEM',
        'GOOGLE_START',
        'BOARD_COMMENT',
        'APP_SESSION',
        'APPLE_SIGNIN',
        'PROFILE_CREATE',
        'CAREER_SEASON',
        'CAREER_RETIRE',
        'PUSH_DEVICE',
        'PUSH_PREFERENCES',
        'PUSH_TEST',
        'FRIEND_REQUEST',
        'TRANSLATE',
      ],
    }).notNull(),
    subject: text('subject').notNull(),
    windowStart: text('window_start').notNull(),
    count: integer('count').notNull(),
  },
  (table) => [uniqueIndex('auth_attempts_kind_subject_unique').on(table.kind, table.subject)],
);

/** T-11-059 동의한 앱 기기만 등록한다. 세션 폐기·탈퇴·계정 전환 시 이전 계정으로 보내지 않는다. */
export const pushDevices = sqliteTable(
  'push_devices',
  {
    installationHash: text('installation_hash').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: text('platform', { enum: ['ios', 'android'] }).notNull(),
    appVersion: text('app_version').notNull(),
    engagementEnabled: integer('engagement_enabled', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull(),
    /** 마지막 본인 테스트 접수 번호. 토큰·세션이 바뀌면 지우고 전달 결과 조회에만 쓴다. */
    lastTestTicketId: text('last_test_ticket_id'),
    lastTestSentAt: text('last_test_sent_at'),
  },
  (t) => [
    uniqueIndex('push_devices_token_unique').on(t.token),
    index('push_devices_session_idx').on(t.sessionId),
    index('push_devices_profile_idx').on(t.profileId),
    index('push_devices_updated_idx').on(t.updatedAt),
    index('push_devices_engagement_updated_idx').on(t.engagementEnabled, t.updatedAt),
  ],
);

/**
 * T-11-003 앱 구글 로그인 표. 앱은 쿠키가 없어 시스템 브라우저로 구글 로그인을 거친다 — 앱이 PKCE 챌린지를 내면 서버가
 * 이 표(id = 구글 OAuth state)를 앱 세션에 묶어 만들고 구글 인증 주소를 돌려준다. 콜백은 state로 표를 찾아 로그인할
 * 프로필을 적고 offside://auth로 보낸다. 앱이 표 id와 verifier를 내면 표를 지우고 새 앱 세션 토큰을 준다. 10분 뒤 만료.
 */
export const appAuthTickets = sqliteTable(
  'app_auth_tickets',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    /** 앱의 PKCE 챌린지: base64url(SHA-256(verifier)). */
    challenge: text('challenge').notNull(),
    /** 구글 OAuth PKCE verifier(웹은 oauth 쿠키에 둔다). */
    codeVerifier: text('code_verifier').notNull(),
    expiresAt: text('expires_at').notNull(),
    /** 콜백이 정한 로그인 프로필. NULL이면 아직 콜백 전. 티켓 세션의 프로필과 같으면 연결, 다르면 전환. */
    profileId: text('profile_id'),
  },
  (table) => [
    index('app_auth_tickets_expires_at_idx').on(table.expiresAt),
    index('app_auth_tickets_session_id_idx').on(table.sessionId),
  ],
);

/**
 * T-9-009. 익명 포함 전체 사용자의 플레이 데이터. 세이브 전체가 아니라 커리어 메타 + 은퇴 요약만
 * 담는다(선수 이름 제외 — 실명일 수 있다). 시즌별 상세는 `careerSeasons`.
 */
/** 명예의 전당 공격포인트(골 + 도움). 식 인덱스는 쿼리 식과 똑같아야 쓰이므로 인덱스·쿼리가 이 함수를 함께 쓴다. */
export const goalsPlusAssists = (t: { goals: AnySQLiteColumn; assists: AnySQLiteColumn }) =>
  sql`coalesce(${t.goals}, 0) + coalesce(${t.assists}, 0)`;

export const careers = sqliteTable(
  'careers',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    pos: text('pos', { enum: ['FW', 'MF', 'DF', 'GK'] }).notNull(),
    // T-10-091 세부 포지션(DETAIL_POSITIONS). 시즌 1 전에 만든 선수·옛 클라이언트는 NULL.
    dpos: text('dpos'),
    // T-10-096 국적(nations.ts 코드)·키(cm)·몸무게(kg). 기능 이전 커리어·대한민국 선수(국적)는 NULL.
    nation: text('nation'),
    height: integer('height'),
    weight: integer('weight'),
    foot: text('foot', { enum: ['오른발', '왼발', '양발'] }).notNull(),
    type: text('type').notNull(),
    trait: text('trait').notNull(),
    startYear: integer('start_year').notNull(),
    status: text('status', { enum: ['active', 'retired'] }).notNull(),
    appVersion: text('app_version').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    /** R2 details archive; header and season summaries stay in D1. */
    detailArchiveKey: text('detail_archive_key'),
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
    // T-10-066 마지막 소속 클럽 id(web CLUBS[].id). 구단명이 바뀌어도 엠블럼이 제 클럽을 찾는다. 옛 기록은 NULL.
    lastClubId: text('last_club_id'),
    // T-10-005 공개 명예의 전당. publicName은 유저가 이름 공개를 켠 경우에만 채운다(NULL = 익명). T-10-065부터
    // 시즌 업로드도 채워 진행 중 커리어가 홈 라이브에 이름으로 보인다.
    // snapshotJson은 은퇴 상세(시즌별 기록·수상·여정) — 선수 이름은 들어 있지 않다.
    publicName: text('public_name'),
    shirtNumber: integer('shirt_number'),
    snapshotJson: text('snapshot_json'),
    // Server-owned award evidence (slot + grantedAt), independent of client snapshots.
    wallOfHonorJson: text('wall_of_honor_json'),
    // T-10-026 은퇴 때의 대표 칭호 id(web game/titles.ts). 옛 은퇴 기록은 NULL.
    title: text('title'),
    // T-10-092 최고 시점 능력치(contracts PeakProfile JSON — 대표 능력치 6개 + 세부 포지션 8자리 실력). 구단주 팀이
    // 자리마다 실력을 센다. 이 기능 전에 은퇴한 기록·옛 클라이언트는 NULL.
    peakProfile: text('peak_profile'),
    // 원본이 없는 옛 은퇴 선수의 카드 표시용 추정 능력치. 경기용 peakProfile·roles와 분리한다.
    cardAttrsJson: text('card_attrs_json'),
    // 서비스 시즌 번호(contracts service-seasons). 서버에 처음 올라온(첫 시즌 업로드) 시각에 진행 중인 시즌으로 한 번
    // 정해져 바뀌지 않는다 — 나중에 시즌 기간을 고쳐도 이미 뛴 선수의 시즌이 소급해 바뀌지 않는다. 0 = 프리시즌, NULL = 시즌 사이 휴식기.
    serviceSeason: integer('service_season'),
    // T-10-100 은퇴 가치(만 원, contracts market-value retireValue). 은퇴 PUT의 스냅샷으로 매기고, 이 기능 전 은퇴는
    // 명예의 전당 조회 때 스냅샷으로 소급한다(db/repos/careerValues.ts). 스냅샷이 없으면 0.
    value: integer('value'),
    // 운영자가 이름 신고를 받고 가린 시각. 있으면 시즌·은퇴 업로드가 공개 이름을 다시 채우지 않는다.
    nameHiddenAt: text('name_hidden_at'),
    // 1이면 공개 순위(명예의 전당·서버 기록·결번·홈 소식)에서 뺀다. 은퇴 때 시즌 신호가 자동 플레이로 판정되면 서버가 켠다.
    hidden: integer('hidden').notNull().default(0),
    // T-11-030 잠재력 관찰. pot은 비공개 최초 스카우트 평가, potReal은 은퇴 리포트·기록실에 공개하는 은퇴 시점 값.
    pot: integer('pot'),
    potReal: integer('pot_real'),
  },
  (table) => [
    index('careers_detail_archive_idx').on(table.detailArchiveKey),
    index('careers_profile_id_idx').on(table.profileId),
    index('careers_automation_updated_idx').on(table.updatedAt, table.id),
    // T-11-064 내 선수·구단주 팀 조회: profile_id로 시작해 status 전체 스캔과 정렬을 피한다.
    index('careers_profile_status_season_idx').on(
      table.profileId,
      table.status,
      table.serviceSeason,
      table.peak,
    ),
    index('careers_profile_status_legend_idx').on(table.profileId, table.status, table.legendScore),
    index('careers_status_legend_idx').on(table.status, table.legendScore),
    // Count HOF filters without reading the large snapshot/profile table payloads.
    index('careers_hof_count_idx').on(
      table.status,
      table.hidden,
      table.serviceSeason,
      table.pos,
      table.retireAge,
      table.legendScore,
      table.retiredAt,
      table.goals,
      table.assists,
      table.apps,
      table.trophies,
      table.awards,
      table.ballon,
      table.caps,
      table.peak,
      table.value,
    ),
    // 명예의 전당 순위 유형(GET /v1/hof?sort=): status로 은퇴만 좁히고 기록 내림차순 → 레전드 점수로 동점을 가린다.
    index('careers_hof_goals_idx').on(table.status, table.goals, table.legendScore),
    index('careers_hof_assists_idx').on(table.status, table.assists, table.legendScore),
    index('careers_hof_ga_idx').on(table.status, goalsPlusAssists(table), table.legendScore),
    index('careers_hof_apps_idx').on(table.status, table.apps, table.legendScore),
    index('careers_hof_trophies_idx').on(table.status, table.trophies, table.legendScore),
    index('careers_hof_awards_idx').on(table.status, table.awards, table.legendScore),
    index('careers_hof_ballon_idx').on(table.status, table.ballon, table.legendScore),
    index('careers_hof_caps_idx').on(table.status, table.caps, table.legendScore),
    index('careers_hof_peak_idx').on(table.status, table.peak, table.legendScore),
    index('careers_hof_value_idx').on(table.status, table.value, table.legendScore),
    // T-10-030 홈 라이브 현황: 지금 뛰는 중·오늘 새 선수·오늘 은퇴와 최근 은퇴 소식을 시각 범위로 찾는다.
    index('careers_status_updated_idx').on(table.status, table.updatedAt),
    index('careers_created_idx').on(table.createdAt),
    index('careers_status_retired_idx').on(table.status, table.retiredAt),
    // T-11-121 영구결번 요약의 시즌별 명예의 벽 — 칭호를 받은 몇 행만 든다(나머지 커리어는 인덱스에서 빠진다).
    // 요약이 쓰는 coalesce 식 그대로 건다. drizzle-kit이 식 인덱스 SQL을 깨뜨려 0069는 손으로 고쳤다(스냅샷은 생성된 그대로).
    index('careers_wall_of_honor_idx')
      .on(sql`coalesce(${table.serviceSeason}, 0)`)
      .where(sql`${table.wallOfHonorJson} is not null`),
  ],
);

/**
 * T-11-080 은퇴 선수 카드(자산). 기록(careers)은 키운 사람의 것이라 계정을 지우면 같이 지워지지만, 카드는 방출·
 * 이적으로 주인이 바뀌므로 따로 둔다. 은퇴 뒤 바뀌지 않는 경기용 값만 복사하고, 공개 이름·숨김·키운 사람은
 * careers를 PK로 붙여 읽는다(기록이 지워졌으면 익명·키운 사람 없음). 다른 구단주가 산 카드가 남아야 해서 FK는 없다.
 * 설계: docs/tracking/owner-funds-card-market-plan.md 5절.
 */
export const cards = sqliteTable(
  'cards',
  {
    careerId: text('career_id').primaryKey(),
    // 지금 가진 구단주. 방출하면 NULL.
    ownerId: text('owner_id'),
    // 출신 서비스 시즌(0 = 프리시즌). careers.service_season이 NULL(휴식기)이면 0.
    serviceSeason: integer('service_season').notNull(),
    pos: text('pos', { enum: ['FW', 'MF', 'DF', 'GK'] }).notNull(),
    dpos: text('dpos'),
    nation: text('nation'),
    number: integer('number'),
    peak: integer('peak').notNull(),
    legendScore: integer('legend_score').notNull(),
    // 최고 시점 능력치(PeakProfile JSON). NULL이면 옛 기록.
    peakProfile: text('peak_profile'),
    // 기준가(만 원, contracts market-value cardValue). NULL이면 스냅샷이 없는 옛 기록이라 거래하지 않는다.
    cardValue: integer('card_value'),
    // 은퇴 가치(만 원, careers.value). 방출 지급 기준.
    retireValue: integer('retire_value').notNull(),
    // 팔린 횟수.
    transfers: integer('transfers').notNull().default(0),
    releasedAt: text('released_at'),
    releasedValue: integer('released_value'),
    // T-11-163 은퇴 장려금(만 원). 은퇴해 카드가 생길 때 키운 사람에게 기준가 × 장려금 비율을 준 값. 없으면 NULL.
    bonusValue: integer('bonus_value'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('cards_owner_season_idx').on(table.ownerId, table.serviceSeason, table.peak)],
);

/**
 * T-11-080 이적시장 판매 등록. 팔린 등록이 곧 이적 이력이자 판매·영입 자금 내역이라 원장 테이블을 따로 두지 않는다.
 * 포지션·OVR·기준가는 복사하지 않고 cards를 PK로 붙여 읽는다.
 */
export const marketListings = sqliteTable(
  'market_listings',
  {
    id: text('id').primaryKey(),
    careerId: text('career_id').notNull(),
    sellerId: text('seller_id').notNull(),
    buyerId: text('buyer_id'),
    // 카드 출신 시즌(cards.service_season). 목록 필터용.
    season: integer('season').notNull(),
    price: integer('price').notNull(),
    // 팔렸을 때 뗀 수수료(만 원). 열려 있거나 내린 등록은 0.
    fee: integer('fee').notNull().default(0),
    status: text('status', { enum: ['open', 'sold', 'cancelled'] }).notNull(),
    createdAt: text('created_at').notNull(),
    closedAt: text('closed_at'),
  },
  (table) => [
    // 카드 한 장에 열린 등록은 하나.
    uniqueIndex('market_listings_open_card_unique')
      .on(table.careerId)
      .where(sql`${table.status} = 'open'`),
    index('market_listings_career_idx').on(table.careerId),
    index('market_listings_new_idx').on(table.status, table.season, table.createdAt),
    index('market_listings_price_idx').on(table.status, table.season, table.price, table.createdAt),
    index('market_listings_seller_idx').on(table.sellerId, table.status, table.closedAt),
    index('market_listings_buyer_idx').on(table.buyerId, table.closedAt),
    index('market_listings_sold_idx').on(table.status, table.season, table.closedAt),
    // 선수별 판매 기록(시세 차트의 점). 팔린 행만 담아 등록 · 취소 때는 쓰지 않는다.
    index('market_listings_card_idx')
      .on(table.careerId, table.closedAt)
      .where(sql`${table.status} = 'sold'`),
  ],
);

/** T-11-080 구단 자금(만 원). 처음 자금을 받을 때(방출·판매) 행을 만든다. 잔액이 모자라면 CHECK로 batch 전체가 되돌아간다. */
export const ownerFunds = sqliteTable(
  'owner_funds',
  {
    profileId: text('profile_id')
      .primaryKey()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    balance: integer('balance').notNull().default(0),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [check('owner_funds_balance_check', sql`${table.balance} >= 0`)],
);

/**
 * T-11-080e 이적시장 시세 집계. 같은 시즌 · 포지션군 · OVR대(최고 OVR 5 단위) 선수가 그날(KST) 기준가의 몇 %에
 * 팔렸는지 모은다. 영입 batch가 한 문장으로 갱신하고, 시세 차트는 이 표만 읽는다(거래 기록을 다시 훑지 않음).
 * 비율은 기준가 대비 천분율(1000 = 기준가 그대로), 거래 대금은 만 원.
 */
export const marketDaily = sqliteTable(
  'market_daily',
  {
    season: integer('season').notNull(),
    posGroup: text('pos_group', { enum: ['FW', 'MF', 'DF', 'GK'] }).notNull(),
    ovrBand: integer('ovr_band').notNull(),
    day: text('day').notNull(),
    trades: integer('trades').notNull(),
    volume: integer('volume').notNull(),
    ratioSum: integer('ratio_sum').notNull(),
    ratioMin: integer('ratio_min').notNull(),
    ratioMax: integer('ratio_max').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.season, table.posGroup, table.ovrBand, table.day] }),
    // 시장 전체 지수(일자별 합). 키 열은 갱신 때 바뀌지 않아 거래마다 인덱스를 다시 쓰지 않는다.
    index('market_daily_day_idx').on(table.season, table.day),
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
    // T-10-066 클럽 id. 이 컬럼 이전 행·옛 클라이언트 업로드는 NULL(이름으로 찾는다).
    clubId: text('club_id'),
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
    /** 자동 플레이 탐지(관찰 전용): 기기가 보낸 조작 요약(PlaySignals) + 서버가 본 headless 여부. 옛 기록은 null. */
    signalsJson: text('signals_json'),
    /** T-11-048 시즌 성장 기록(SeasonGrowth JSON: 시즌 시작·종료 능력치·세부 능력치, 구간별 OVR, 잠재력). 관찰 전용. */
    growthJson: text('growth_json'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.careerId, table.year] }),
    // T-10-030 홈 라이브 현황: 최근 올라온 시즌(피드·오늘 시즌 수)을 시각 순으로 찾는다.
    index('career_seasons_created_idx').on(table.createdAt),
    index('career_seasons_signals_career_idx')
      .on(table.careerId, table.createdAt)
      .where(sql`${table.signalsJson} is not null`),
    // T-11-100 매일 성장 기록 보관이 아직 D1에 남은 오래된 성장 기록만 시각 순으로 찾는다(비운 행은 인덱스에서 빠진다).
    index('career_seasons_growth_created_idx')
      .on(table.createdAt)
      .where(sql`${table.growthJson} is not null`),
    index('career_seasons_events_created_idx')
      .on(table.createdAt)
      .where(sql`${table.eventsJson} <> '[]'`),
  ],
);

/** T-1-004, ADR-008. `PROFILE_DELETED`·`RECOVERY_CODE_ISSUED`·`GOOGLE_LINKED`·`GOOGLE_UNLINKED`(T-1-013)·`CAREERS_MERGED`(T-10-013)·`BALANCE_ACTIVATED`·`COMMENTS_PURGED`(T-10-016). */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    kind: text('kind', {
      enum: [
        'PROFILE_DELETED',
        'RECOVERY_CODE_ISSUED',
        'GOOGLE_LINKED',
        'GOOGLE_UNLINKED',
        'APPLE_LINKED',
        'CAREERS_MERGED',
        'BALANCE_ACTIVATED',
        'COMMENTS_PURGED',
        'NAME_REPORT_RESOLVED',
      ],
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
    /** T-10-058 조회수. 기기마다 글 하나에 한 번만 센다(웹이 기억). */
    viewCount: integer('view_count').notNull().default(0),
    /** T-10-058 좋아요 수. board_post_likes를 바꿀 때 같은 batch에서 다시 센다(목록이 COUNT 없이 읽는다). */
    likeCount: integer('like_count').notNull().default(0),
    /** T-11-146 운영자가 쓴 영어·일본어 제목·본문 `{"en":{"title","body"},"ja":{...}}`. 없으면 한국어를 보여 준다. */
    i18nJson: text('i18n_json'),
  },
  (table) => [index('board_posts_board_created_idx').on(table.board, table.createdAt)],
);

/** T-10-058. 글 좋아요 — 프로필당 글 하나에 한 번. */
export const boardPostLikes = sqliteTable(
  'board_post_likes',
  {
    postId: text('post_id')
      .notNull()
      .references(() => boardPosts.id, { onDelete: 'cascade' }),
    profileId: text('profile_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.profileId] }),
    index('board_post_likes_profile_idx').on(table.profileId),
  ],
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
    // T-10-016 운영 도구: 전체 게시판의 최근 댓글.
    index('board_comments_created_idx').on(table.createdAt),
  ],
);

/** 댓글 신고(앱스토어 UGC 정책). 프로필 하나가 댓글 하나에 한 번. 신고한 사람 화면에서는 그 댓글이 숨겨지고,
 *  운영자는 관리 화면에서 신고 수로 본다. 댓글을 지워도(deleted_at) 기록은 남는다. */
export const boardCommentReports = sqliteTable(
  'board_comment_reports',
  {
    commentId: text('comment_id')
      .notNull()
      .references(() => boardComments.id, { onDelete: 'cascade' }),
    profileId: text('profile_id').notNull(),
    reason: text('reason', { enum: COMMENT_REPORT_REASONS }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.profileId] }),
    index('board_comment_reports_profile_idx').on(table.profileId),
  ],
);

/** 공개 이름 신고(앱스토어 UGC 정책) — 명예의 전당 선수 이름(career)과 구단 이름·감독 이름(team). 프로필 하나가
 *  대상 하나에 한 줄. name은 신고할 때 보인 이름이다. 운영자가 처리(가리기·기각)하면 resolved_at을 채우고,
 *  그 뒤 같은 사람이 다시 신고하면 다시 열린다. */
export const nameReports = sqliteTable(
  'name_reports',
  {
    kind: text('kind', { enum: NAME_REPORT_KINDS }).notNull(),
    targetId: text('target_id').notNull(),
    profileId: text('profile_id').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull(),
    resolvedAt: text('resolved_at'),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.targetId, table.profileId] }),
    index('name_reports_resolved_idx').on(table.resolvedAt, table.createdAt),
    index('name_reports_profile_idx').on(table.profileId),
  ],
);

/** 댓글 작성자 차단. 차단한 사람(profile_id)에게는 그 작성자의 댓글을 보내지 않는다. nickname은 차단할 때의
 *  이름(차단 목록에 보여 준다). */
export const boardBlocks = sqliteTable(
  'board_blocks',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    blockedProfileId: text('blocked_profile_id').notNull(),
    nickname: text('nickname').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('board_blocks_pair_unique').on(table.profileId, table.blockedProfileId),
    index('board_blocks_blocked_idx').on(table.blockedProfileId),
  ],
);

/** T-10-016. 서버에서 조정하는 게임 밸런스 설정. version이 곧 버전 번호다. 초안(draft)만 고칠 수 있고,
 * 활성(active)은 늘 하나다 — 다른 버전을 활성화하면 이전 활성은 archived가 된다(되돌리기 = 옛 버전 재활성화).
 * values_json은 기본값과 다른 값만 담는다(@offside/contracts/balance). */
export const balanceVersions = sqliteTable(
  'balance_versions',
  {
    version: integer('version').primaryKey({ autoIncrement: true }),
    status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull(),
    note: text('note').notNull().default(''),
    valuesJson: text('values_json').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    activatedAt: text('activated_at'),
  },
  (table) => [
    index('balance_versions_status_idx').on(table.status),
    // T-11-141 공개 이력(적용 순 정렬).
    index('balance_versions_activated_idx').on(table.activatedAt),
  ],
);

/** T-10-027 서버 최초 기록. 기록 id(src/firsts.ts firstsCatalog)마다 가장 먼저 달성한 커리어 한 줄. 커리어가 지워지면
 * 함께 지워지고, 다음 재계산(app_meta 버전) 때 그다음으로 이른 커리어가 채운다.
 * T-11-029 시즌마다 따로 겨룬다 — season은 커리어의 service_season(NULL이면 0, 0 = 프리시즌), 키는 (season, id). */
export const serverFirsts = sqliteTable(
  'server_firsts',
  {
    season: integer('season').notNull().default(0),
    id: text('id').notNull(),
    careerId: text('career_id')
      .notNull()
      .references(() => careers.id, { onDelete: 'cascade' }),
    achievedAt: text('achieved_at').notNull(),
    year: integer('year'),
  },
  (table) => [
    primaryKey({ columns: [table.season, table.id] }),
    index('server_firsts_career_idx').on(table.careerId),
    index('server_firsts_achieved_idx').on(table.achievedAt),
  ],
);

/** T-10-056 서버 기록(깨질 수 있는 최고 기록) 한 줄씩. 보유 커리어가 지워지면 함께 지워지고, 다음 재계산이
 * 그다음 보유자를 채운다. T-11-029 서버 최초 기록처럼 시즌마다 따로다 — 키는 (season, id). */
export const serverRecords = sqliteTable(
  'server_records',
  {
    season: integer('season').notNull().default(0),
    id: text('id').notNull(),
    careerId: text('career_id')
      .notNull()
      .references(() => careers.id, { onDelete: 'cascade' }),
    value: integer('value').notNull(),
    achievedAt: text('achieved_at').notNull(),
    year: integer('year'),
  },
  (table) => [
    primaryKey({ columns: [table.season, table.id] }),
    index('server_records_career_idx').on(table.careerId),
  ],
);

/**
 * T-10-076 영구결번. 구단(club_id)·등번호마다 한 명 — 먼저 자격을 채운 커리어가 가져가고 취소되지 않는다(보유
 * 커리어가 지워지면 함께 지워져 자리가 빈다). 한 커리어는 한 자리만 가진다. seq는 서버에서 몇 번째 결번인지.
 * T-11-029 시즌마다 따로 센다 — season은 커리어의 service_season(NULL이면 0, 0 = 프리시즌)이라 시즌 1 선수도
 * 프리시즌 선수와 같은 구단·번호를 받고, seq도 시즌 안에서 센다.
 */
export const retiredNumbers = sqliteTable(
  'retired_numbers',
  {
    season: integer('season').notNull().default(0),
    clubId: text('club_id').notNull(),
    number: integer('number').notNull(),
    careerId: text('career_id')
      .notNull()
      .references(() => careers.id, { onDelete: 'cascade' }),
    /** 결번을 받을 때의 구단 이름(표시용). */
    club: text('club').notNull(),
    score: integer('score').notNull(),
    seq: integer('seq').notNull(),
    grantedAt: text('granted_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.season, table.clubId, table.number] }),
    uniqueIndex('retired_numbers_career_idx').on(table.careerId),
  ],
);

/**
 * 서버 내부 상태 한 줄씩. T-10-027 서버 최초 기록 재계산 버전, T-10-055 한국 시각 날짜별 은퇴 수
 * (`retired:YYYY-MM-DD`, 하루 한 줄씩 늘고 지우지 않는다 — retiredCountKey).
 */
/**
 * T-11-146 사용자가 쓴 글의 번역 캐시. 키는 sha256(목표 언어 + 원문) — 같은 댓글·채팅을 여러 사람이 눌러도 Workers AI는
 * 한 번만 부른다. 원문은 두지 않는다(번역문만). 30일 지나면 매일 정리(cron/cleanup.ts)에서 지운다.
 */
export const translations = sqliteTable(
  'translations',
  {
    key: text('key').primaryKey(),
    text: text('text').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('translations_created_idx').on(table.createdAt)],
);

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * T-10-092 구단주 팀. 구글 로그인한 프로필만 만들고, 시즌마다 한 팀이다(season: 서비스 시즌 id, 0 = 프리시즌 —
 * 그 시즌에 처음 올라온 은퇴 선수만 넣는다). slots_json은 포메이션 순서 11자리의
 * 커리어 id(빈 자리는 null — 유스 선수가 채운다). filled·ovr는 저장·경기 때 다시 계산해 두는 값이다(상대 목록이
 * 커리어를 읽지 않고 고른다). 전적은 경기마다 두 팀 행을 한 번씩 고친다(행 쓰기를 적게).
 */
export const ownerTeams = sqliteTable(
  'owner_teams',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    season: integer('season').notNull().default(0),
    name: text('name').notNull(),
    /** 감독 이름(팀마다, 공개). */
    manager: text('manager').notNull().default(''),
    formation: text('formation').notNull(),
    slotsJson: text('slots_json').notNull(),
    layoutJson: text('layout_json'),
    logoJson: text('logo_json'),
    filled: integer('filled').notNull(),
    ovr: integer('ovr').notNull(),
    /** 팀 레이팅(경기 결과로 오르내린다, TEAM_RATING_START에서 시작). */
    rating: integer('rating').notNull().default(1000),
    wins: integer('wins').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    goalsFor: integer('goals_for').notNull().default(0),
    goalsAgainst: integer('goals_against').notNull().default(0),
    /** 지금 연승 · 최다 연승 · 가장 큰 승리 골 차(팀 히스토리 배지). */
    streak: integer('streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    bestMargin: integer('best_margin').notNull().default(0),
    likes: integer('likes').notNull().default(0),
    views: integer('views').notNull().default(0),
    /**
     * T-11-113 끝난 시즌 팀을 친선전용으로 고친 편성(이름·감독·포메이션·선발·배치·로고·filled·ovr JSON). 최종 기록 칸은
     * 그대로 두고 친선전·내 팀 화면만 이 값을 쓴다(friendlyTeamOf).
     */
    friendlyJson: text('friendly_json'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('owner_teams_profile_season_unique').on(table.profileId, table.season),
    // 상대 목록: 같은 시즌에서 내 팀 OVR 위아래로 가까운 팀을 찾는다.
    index('owner_teams_season_ovr_idx').on(table.season, table.ovr),
    // 라이브 랭킹(팀 랭킹).
    index('owner_teams_season_rating_idx').on(table.season, table.rating),
  ],
);

/** T-10-092 팀 좋아요(구단주 한 명이 팀 하나에 한 번). 수는 owner_teams.likes에 함께 센다. */
export const teamLikes = sqliteTable(
  'team_likes',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => ownerTeams.id, { onDelete: 'cascade' }),
    profileId: text('profile_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.profileId] }),
    index('team_likes_profile_idx').on(table.profileId),
  ],
);

/**
 * T-10-092 팀 경기. home은 경기를 건 팀, profile_id는 그 구단주(하루 경기 수 제한을 센다). detail_json은 두 팀의
 * 경기 당시 모습(이름·구단주·포메이션·OVR)과 골 이벤트 — 선수는 커리어 id와 익명 표기로만 담고 공개 이름은 읽을
 * 때 붙인다(나중에 이름 공개를 끄면 경기 기록에서도 사라진다).
 */
export const teamMatches = sqliteTable(
  'team_matches',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    homeTeamId: text('home_team_id')
      .notNull()
      .references(() => ownerTeams.id, { onDelete: 'cascade' }),
    awayTeamId: text('away_team_id')
      .notNull()
      .references(() => ownerTeams.id, { onDelete: 'cascade' }),
    homeGoals: integer('home_goals').notNull(),
    awayGoals: integer('away_goals').notNull(),
    detailJson: text('detail_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('team_matches_profile_created_idx').on(table.profileId, table.createdAt),
    index('team_matches_away_created_idx').on(table.awayTeamId, table.createdAt),
    index('team_matches_home_recent_idx').on(table.homeTeamId, table.createdAt, table.id),
    index('team_matches_away_recent_idx').on(table.awayTeamId, table.createdAt, table.id),
  ],
);

/**
 * T-11-098 친구. 한 쌍을 두 줄(내 쪽·상대 쪽)로 적어 내 친구 목록을 profile_id 하나로 읽는다. state는 그 줄 주인 기준 —
 * 신청하면 보낸 쪽 'sent'·받은 쪽 'received', 수락하면 둘 다 'accepted'. 거절·취소·친구 끊기는 두 줄을 지운다.
 * wins·draws·losses는 그 줄 주인 쪽에서 본 친선전 상대 전적이다(친구를 끊으면 함께 사라진다).
 */
export const friends = sqliteTable(
  'friends',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    friendId: text('friend_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    state: text('state', { enum: ['sent', 'received', 'accepted'] }).notNull(),
    wins: integer('wins').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.friendId] }),
    index('friends_friend_idx').on(table.friendId),
  ],
);

/**
 * T-11-098 친선전. 랭크 경기(team_matches)와 따로 둔다 — 하루 경기 수·전적·레이팅·업적·랭킹 최근 전적이 이 표를 보지 않는다.
 * profile_id는 경기를 건 구단주(홈), opponent_id는 받은 구단주(원정). detail_json 모양은 team_matches와 같다(레이팅 변화 없음).
 */
export const friendMatches = sqliteTable(
  'friend_matches',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    opponentId: text('opponent_id').notNull(),
    homeTeamId: text('home_team_id')
      .notNull()
      .references(() => ownerTeams.id, { onDelete: 'cascade' }),
    awayTeamId: text('away_team_id')
      .notNull()
      .references(() => ownerTeams.id, { onDelete: 'cascade' }),
    homeGoals: integer('home_goals').notNull(),
    awayGoals: integer('away_goals').notNull(),
    detailJson: text('detail_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('friend_matches_profile_created_idx').on(table.profileId, table.createdAt),
    index('friend_matches_opponent_created_idx').on(table.opponentId, table.createdAt),
    // 팀을 지울 때(CASCADE) 친선전을 찾는다.
    index('friend_matches_home_team_idx').on(table.homeTeamId),
    index('friend_matches_away_team_idx').on(table.awayTeamId),
  ],
);

/**
 * T-11-028 구단주 시즌 업적 점수(업적 랭킹). 업적은 은퇴 기록·팀에서 그때그때 계산하고, 랭킹을 세려고 점수만 여기에
 * 적어 둔다 — 업적 화면을 열 때·은퇴·팀 저장·팀 경기 뒤와 매일 cron이 다시 센다. 점수가 0이면 행을 두지 않는다.
 * reached_at은 점수가 바뀐 시각이라 같은 점수면 먼저 닿은 구단주가 앞선다.
 */
export const ownerAchievements = sqliteTable(
  'owner_achievements',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    season: integer('season').notNull(),
    score: integer('score').notNull(),
    done: integer('done').notNull(),
    players: integer('players').notNull(),
    // T-11-103 그 시즌에 닿은 팀 업적(JSON {id: 값}). 선발이 바뀌어도 팀 업적을 남긴다. NULL이면 아직 없다.
    teamKept: text('team_kept'),
    reachedAt: text('reached_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.season] }),
    index('owner_achievements_season_score_idx').on(table.season, table.score, table.reachedAt),
  ],
);

/** T-11-015 채팅 신고. 프로필 하나가 메시지 하나에 한 번. 메시지는 채팅방(Durable Object)에 7일만 남으므로 신고할
 *  때 작성자·닉네임·본문 사본을 함께 적어 둔다(운영자 확인용, 90일 뒤 cron이 지운다). 운영자가 처리하면
 *  resolved_at을 채운다. */
export const chatReports = sqliteTable(
  'chat_reports',
  {
    messageId: text('message_id').notNull(),
    profileId: text('profile_id').notNull(),
    reason: text('reason', { enum: COMMENT_REPORT_REASONS }).notNull(),
    authorProfileId: text('author_profile_id').notNull(),
    nickname: text('nickname').notNull(),
    body: text('body').notNull(),
    createdAt: text('created_at').notNull(),
    /** 운영자가 처리(가리기·기각·정지)한 시각. 처리 전엔 null. */
    resolvedAt: text('resolved_at'),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.profileId] }),
    index('chat_reports_created_idx').on(table.createdAt),
    index('chat_reports_open_idx').on(table.resolvedAt, table.createdAt),
    index('chat_reports_profile_idx').on(table.profileId),
    index('chat_reports_author_idx').on(table.authorProfileId),
  ],
);

/** T-11-015 채팅 정지. 프로필당 한 줄, until까지 입장권(쓰기)을 주지 않는다. 지난 줄은 cron이 지운다. */
export const chatMutes = sqliteTable(
  'chat_mutes',
  {
    profileId: text('profile_id').primaryKey(),
    until: text('until').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('chat_mutes_until_idx').on(table.until)],
);

/**
 * T-11-128 구단주 시즌 결산. 시즌이 끝나면(프리시즌은 첫 시즌 개막) cron이 그 시각(cutoff)까지의 기록으로 한 번 적고 다시
 * 세지 않는다 — 계산식이 바뀌어도 유저가 본 결산은 그대로다(team/seasonClose.ts). 선수 기록은 cutoff 전에 은퇴한 선수만 센다.
 */
export const ownerSeasonRecords = sqliteTable(
  'owner_season_records',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    season: integer('season').notNull(),
    players: integer('players').notNull(),
    retired: integer('retired').notNull(),
    bestCareerId: text('best_career_id'),
    bestScore: integer('best_score'),
    hofRank: integer('hof_rank'),
    retiredNumbers: integer('retired_numbers').notNull(),
    wallOfHonor: integer('wall_of_honor').notNull(),
    firsts: integer('firsts').notNull(),
    // 팀 성적도 마감 때 값을 옮겨 둔다(지난 시즌 팀은 친선전용으로 다시 고칠 수 있다).
    teamId: text('team_id'),
    teamName: text('team_name'),
    teamRating: integer('team_rating'),
    teamRank: integer('team_rank'),
    wins: integer('wins').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    goalsFor: integer('goals_for').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    // 업적 점수는 cutoff 뒤에 바뀐 구단주만 cutoff 기준으로 다시 센다. ach_at은 점수에 닿은 시각(같은 점수면 먼저 닿은 순).
    achScore: integer('ach_score'),
    achDone: integer('ach_done'),
    achAt: text('ach_at'),
    achRank: integer('ach_rank'),
    achChecked: integer('ach_checked').notNull().default(0),
    /** 결산 화면 · 공유 카드용 시즌 기록 묶음(SeasonRecapStats를 JSON으로). 굳히기 전이면 null. */
    statsJson: text('stats_json'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.season] }),
    index('owner_season_records_best_career_idx').on(table.bestCareerId),
  ],
);

/** T-11-128 구단주 휘장. 시즌 결산이 한 번 주고 지우지 않는다 — (구단주, 시즌, 종류)에 하나. */
export const ownerHonors = sqliteTable(
  'owner_honors',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    season: integer('season').notNull(),
    kind: text('kind').notNull(),
    band: integer('band'),
    rank: integer('rank'),
    value: integer('value'),
    grantedAt: text('granted_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.season, table.kind] })],
);

/**
 * T-11-145 오프사이드 컵 대회 일정. 관리자 API(POST /v1/admin/cups)로 연다 — 코드 배포 없이 다음 회차를 만든다. 모양은
 * contracts planCup, rounds_json은 CUP_ROUNDS 순서의 경기 시각(UTC ISO) 배열. edition(제 n회)은 시즌을 넘어 이어진다.
 */
export const cups = sqliteTable(
  'cups',
  {
    id: text('id').primaryKey(),
    season: integer('season').notNull(),
    edition: integer('edition').notNull(),
    opensAt: text('opens_at').notNull(),
    closesAt: text('closes_at').notNull(),
    drawAt: text('draw_at').notNull(),
    roundsJson: text('rounds_json').notNull(),
    capacity: integer('capacity').notNull(),
    minFilled: integer('min_filled').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('cups_edition_unique').on(table.edition)],
);

/**
 * T-11-145 오프사이드 컵 참가. 대회 일정은 cups 테이블이다. 팀 이름·감독·OVR은 신청·추첨 때 적어 둔다(팀이
 * 지워져도 대진표가 남는다). status: active(참가 중) · out(탈락) · champion · withdrawn(접수 중 취소·추첨 때 자격 미달).
 * stage는 끝난 단계(contracts CUP_STAGES), rewarded_at은 그 단계 보상을 준 시각(한 번만 준다).
 */
export const cupEntries = sqliteTable(
  'cup_entries',
  {
    cupId: text('cup_id').notNull(),
    teamId: text('team_id').notNull(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    manager: text('manager').notNull(),
    ovr: integer('ovr').notNull(),
    grp: integer('grp'),
    status: text('status').notNull().default('active'),
    stage: text('stage'),
    rewardedAt: text('rewarded_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.cupId, table.teamId] }),
    uniqueIndex('cup_entries_cup_profile_unique').on(table.cupId, table.profileId),
    index('cup_entries_profile_idx').on(table.profileId),
  ],
);

/**
 * T-11-145 컵 경기. 조별은 grp(1부터)·slot(그 라운드 조 안 순서), 토너먼트는 grp 0·slot(대진 순서). 추첨 때 조별 경기를,
 * 앞 라운드가 끝나면 다음 라운드를 만든다(INSERT OR IGNORE — 같은 자리는 한 번만). played_at이 차면 끝난 경기다.
 * 상대가 없거나(조 2팀) 한 팀이 못 나오면 forfeit. detail_json은 팀 경기와 같은 MatchDetail.
 */
export const cupMatches = sqliteTable(
  'cup_matches',
  {
    id: text('id').primaryKey(),
    cupId: text('cup_id').notNull(),
    round: text('round').notNull(),
    grp: integer('grp').notNull().default(0),
    slot: integer('slot').notNull(),
    homeTeamId: text('home_team_id'),
    awayTeamId: text('away_team_id'),
    at: text('at').notNull(),
    playedAt: text('played_at'),
    homeGoals: integer('home_goals'),
    awayGoals: integer('away_goals'),
    pensHome: integer('pens_home'),
    pensAway: integer('pens_away'),
    winnerTeamId: text('winner_team_id'),
    forfeit: integer('forfeit').notNull().default(0),
    detailJson: text('detail_json'),
  },
  (table) => [
    uniqueIndex('cup_matches_cup_round_slot_unique').on(
      table.cupId,
      table.round,
      table.grp,
      table.slot,
    ),
  ],
);

/** T-11-145 대회 진행 상태(추첨 시드·조 수·취소). 행이 있으면 추첨이 끝났다. */
export const cupState = sqliteTable('cup_state', {
  cupId: text('cup_id').primaryKey(),
  seed: text('seed').notNull(),
  groups: integer('groups').notNull(),
  drawnAt: text('drawn_at').notNull(),
  doneAt: text('done_at'),
});

/** T-11-145 구단주 소모성 아이템(item: 'reroll' = 선수 후보 리롤권). */
export const ownerItems = sqliteTable(
  'owner_items',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    item: text('item').notNull(),
    qty: integer('qty').notNull().default(0),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.item] }),
    check('owner_items_qty_check', sql`${table.qty} >= 0`),
  ],
);

/**
 * T-11-152 구단 자금으로 산 아이템 원장(자금이 없어진 내역). 하루 상한을 세고, 운영에서 자금 대조
 * (방출 + 판매 − 영입 − 아이템 구매)에 쓴다.
 */
export const ownerItemPurchases = sqliteTable(
  'owner_item_purchases',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    item: text('item').notNull(),
    qty: integer('qty').notNull(),
    price: integer('price').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('owner_item_purchases_profile_idx').on(table.profileId, table.item, table.createdAt),
  ],
);
