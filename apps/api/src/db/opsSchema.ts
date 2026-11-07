// T-11-662 운영 기록 DB(OPS_DB) 스키마. 게임 DB(schema.ts)와 따로 마이그레이션한다(migrations-ops, drizzle-ops.config.ts).
// 요청 횟수 제한 · 서버 상태 집계 · 클라이언트 오류 · 운영 지표처럼 게임 표와 조인하지 않고 한 batch로 묶이지 않는 기록만 둔다.
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

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
        'PROFILE_AVATAR',
        'CAREER_SEASON',
        'CAREER_RETIRE',
        'CAREER_LOOK',
        'CAREER_NAMES',
        'PUSH_DEVICE',
        'PUSH_PREFERENCES',
        'PUSH_TEST',
        'FRIEND_REQUEST',
        'TRANSLATE',
        'ACQUISITION',
        'CAREER_ACTIVITY',
        'WEB_PAY',
      ],
    }).notNull(),
    subject: text('subject').notNull(),
    windowStart: text('window_start').notNull(),
    count: integer('count').notNull(),
  },
  (table) => [uniqueIndex('auth_attempts_kind_subject_unique').on(table.kind, table.subject)],
);

/** T-11-321 서버 상태 화면. 5분 칸(`bucket` = 칸 시작 UTC ISO)마다 워커가 받은 요청 수·응답 시간 합·느린 요청·서버
 * 오류를 더한다. isolate마다 메모리에 모았다가 1분에 한 번 더하므로 요청마다 쓰지 않는다(status/metrics.ts). 35일 보관. */
export const apiStatusBuckets = sqliteTable('api_status_buckets', {
  bucket: text('bucket').primaryKey(),
  requests: integer('requests').notNull().default(0),
  totalMs: integer('total_ms').notNull().default(0),
  /** 1초 이상 걸린 요청. */
  slow: integer('slow').notNull().default(0),
  /** 5xx로 끝난 요청. */
  errors: integer('errors').notNull().default(0),
});

/**
 * T-11-331 앱·웹 오류. (KST 날짜 × 지문)마다 한 행이고 같은 오류는 count만 늘린다(status/clientErrors.ts).
 * 지문은 플랫폼 · 종류 · 숫자를 지운 문구 · 첫 코드 위치로 만든다. 세션 · 프로필은 남기지 않는다.
 */
export const clientErrors = sqliteTable(
  'client_errors',
  {
    day: text('day').notNull(),
    fingerprint: text('fingerprint').notNull(),
    platform: text('platform').notNull(),
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    frame: text('frame').notNull(),
    place: text('place').notNull(),
    stack: text('stack').notNull(),
    firstVersion: text('first_version').notNull(),
    lastVersion: text('last_version').notNull(),
    count: integer('count').notNull().default(0),
    firstAt: text('first_at').notNull(),
    lastAt: text('last_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.fingerprint] }),
    index('client_errors_last_at_idx').on(t.lastAt),
  ],
);

/**
 * T-11-572 운영 지표 대시보드(admin.offside-lab.com). 하루 한 번 모은 값(KST 날짜 · 지표 · 나눔)을 긴 표로 둔다.
 * 운영 D1 값은 일일 cron `kpi` 단계가, 외부(GA4 · 광고 · 스토어) 값은 에이전트 Worker가 `/v1/internal/kpi`로 넣는다.
 * 대시보드는 이 표만 읽는다(화면을 열 때 운영 표에 집계 쿼리를 날리지 않는다). 설계: docs/tracking/admin-kpi-dashboard-design.md
 */
export const kpiDaily = sqliteTable(
  'kpi_daily',
  {
    day: text('day').notNull(),
    metric: text('metric').notNull(),
    dim: text('dim').notNull().default('all'),
    value: real('value').notNull(),
    source: text('source').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.metric, table.dim] })],
);
