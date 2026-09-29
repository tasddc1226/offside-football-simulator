import { sql } from 'drizzle-orm';
import {
  index,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  integer,
  real,
  type AnySQLiteColumn,
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
    /** T-10-028 댓글에 쓰는 닉네임(구글 로그인한 프로필만 정한다). 대소문자만 다른 닉네임도 겹치지 못한다. */
    nickname: text('nickname'),
  },
  (table) => [
    uniqueIndex('profiles_google_sub_unique').on(table.googleSub),
    uniqueIndex('profiles_nickname_unique').on(sql`lower(${table.nickname})`),
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
    // T-10-066 마지막 소속 클럽 id(web CLUBS[].id). 구단명이 바뀌어도 엠블럼이 제 클럽을 찾는다. 옛 기록은 NULL.
    lastClubId: text('last_club_id'),
    // T-10-005 공개 명예의 전당. publicName은 유저가 이름 공개를 켠 경우에만 채운다(NULL = 익명). T-10-065부터
    // 시즌 업로드도 채워 진행 중 커리어가 홈 라이브에 이름으로 보인다.
    // snapshotJson은 은퇴 상세(시즌별 기록·수상·여정) — 선수 이름은 들어 있지 않다.
    publicName: text('public_name'),
    shirtNumber: integer('shirt_number'),
    snapshotJson: text('snapshot_json'),
    // T-10-026 은퇴 때의 대표 칭호 id(web game/titles.ts). 옛 은퇴 기록은 NULL.
    title: text('title'),
    // T-10-092 최고 시점 능력치(contracts PeakProfile JSON — 대표 능력치 6개 + 세부 포지션 8자리 실력). 구단주 팀이
    // 자리마다 실력을 센다. 이 기능 전에 은퇴한 기록·옛 클라이언트는 NULL.
    peakProfile: text('peak_profile'),
  },
  (table) => [
    index('careers_profile_id_idx').on(table.profileId),
    index('careers_status_legend_idx').on(table.status, table.legendScore),
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
    // T-10-030 홈 라이브 현황: 지금 뛰는 중·오늘 새 선수·오늘 은퇴와 최근 은퇴 소식을 시각 범위로 찾는다.
    index('careers_status_updated_idx').on(table.status, table.updatedAt),
    index('careers_created_idx').on(table.createdAt),
    index('careers_status_retired_idx').on(table.status, table.retiredAt),
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
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.careerId, table.year] }),
    // T-10-030 홈 라이브 현황: 최근 올라온 시즌(피드·오늘 시즌 수)을 시각 순으로 찾는다.
    index('career_seasons_created_idx').on(table.createdAt),
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
        'CAREERS_MERGED',
        'BALANCE_ACTIVATED',
        'COMMENTS_PURGED',
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
  (table) => [index('balance_versions_status_idx').on(table.status)],
);

/** T-10-027 서버 최초 기록. 기록 id(src/firsts.ts firstsCatalog)마다 가장 먼저 달성한 커리어 한 줄. 커리어가 지워지면
 * 함께 지워지고, 다음 재계산(app_meta 버전) 때 그다음으로 이른 커리어가 채운다. */
export const serverFirsts = sqliteTable(
  'server_firsts',
  {
    id: text('id').primaryKey(),
    careerId: text('career_id')
      .notNull()
      .references(() => careers.id, { onDelete: 'cascade' }),
    achievedAt: text('achieved_at').notNull(),
    year: integer('year'),
  },
  (table) => [index('server_firsts_achieved_idx').on(table.achievedAt)],
);

/** T-10-056 서버 기록(깨질 수 있는 최고 기록) 한 줄씩. 보유 커리어가 지워지면 함께 지워지고, 다음 재계산이
 * 그다음 보유자를 채운다. */
export const serverRecords = sqliteTable('server_records', {
  id: text('id').primaryKey(),
  careerId: text('career_id')
    .notNull()
    .references(() => careers.id, { onDelete: 'cascade' }),
  value: integer('value').notNull(),
  achievedAt: text('achieved_at').notNull(),
  year: integer('year'),
});

/**
 * T-10-076 영구결번. 구단(club_id)·등번호마다 한 명 — 먼저 자격을 채운 커리어가 가져가고 취소되지 않는다(보유
 * 커리어가 지워지면 함께 지워져 자리가 빈다). 한 커리어는 한 자리만 가진다. seq는 서버에서 몇 번째 결번인지.
 */
export const retiredNumbers = sqliteTable(
  'retired_numbers',
  {
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
    primaryKey({ columns: [table.clubId, table.number] }),
    uniqueIndex('retired_numbers_career_idx').on(table.careerId),
  ],
);

/**
 * 서버 내부 상태 한 줄씩. T-10-027 서버 최초 기록 재계산 버전, T-10-055 한국 시각 날짜별 은퇴 수
 * (`retired:YYYY-MM-DD`, 하루 한 줄씩 늘고 지우지 않는다 — retiredCountKey).
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * T-10-092 구단주 팀. 구글 로그인한 프로필만 만든다(팀 수는 TEAM_SLOTS). slots_json은 포메이션 순서 11자리의
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
    name: text('name').notNull(),
    formation: text('formation').notNull(),
    slotsJson: text('slots_json').notNull(),
    filled: integer('filled').notNull(),
    ovr: integer('ovr').notNull(),
    wins: integer('wins').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('owner_teams_profile_idx').on(table.profileId),
    // 상대 목록: 내 팀 OVR 위아래로 가까운 팀을 찾는다.
    index('owner_teams_ovr_idx').on(table.ovr),
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
  ],
);
