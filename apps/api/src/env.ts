import type { Context } from 'hono';
import { createDb, type Db } from './db/client.js';
import type { SessionChannel } from './db/repos/sessions.js';
import type { ChatRoom } from './chat/room.js';
import type { LiveHub } from './live/hub.js';

export type Bindings = {
  CLUB_STRENGTH_ENABLED?: string;
  /** Reviewed provider league/team-id mappings. No secrets in this JSON. */
  CLUB_STRENGTH_SOURCES?: string;
  CLUB_STRENGTH_OWNER_EMAIL?: string;
  FOOTBALL_DATA_TOKEN?: string;
  API_FOOTBALL_KEY?: string;
  /** Emergency pause for automatic moderation; manual restore remains available. */
  AUTOMATION_HIDE_DISABLED?: string;
  /** 공지·릴리즈 노트 하루 첫 게시 자동 푸시. 운영에만 켠다. */
  NEWS_PUSH_ENABLED?: string;
  /** 현재 앱 세션의 등록 기기만 테스트. 기본 off. 자동 발송과 별개다. */
  PUSH_TEST_ENABLED?: string;
  /** 개인 이벤트 푸시와 미접속 안내는 검증 후 별도로 활성화한다. */
  PERSONAL_PUSH_ENABLED?: string;
  /** Optional single verified admin recipient; defaults only when ADMIN_EMAILS has one entry. */
  ADMIN_COMMUNITY_PUSH_EMAIL?: string;
  /** Enable only after the app understands community notifications. */
  ADMIN_COMMUNITY_PUSH_ENABLED?: string;
  REENGAGEMENT_PUSH_ENABLED?: string;
  /** Expo enhanced push security용 secret. 클라이언트에는 넣지 않는다. */
  EXPO_PUSH_ACCESS_TOKEN?: string;
  /** Emergency stop for dormant career archival (restores remain enabled). */
  CAREER_RETENTION_DISABLED?: string;
  /** Emergency stops for telemetry offload and public HOF read sessions. */
  SEASON_EVENTS_ARCHIVE_DISABLED?: string;
  D1_READ_SESSIONS_DISABLED?: string;
  DB: D1Database;
  /** local|staging|production. */
  ENVIRONMENT: string;
  /** 쉼표 구분 origin 목록. */
  ALLOWED_ORIGINS: string;
  /** D-21. U-003 전에는 비어 있을 수 있다 — 그러면 /auth/google/start가 503을 낸다. */
  GOOGLE_CLIENT_ID?: string;
  /** secret. wrangler vars에 두지 않는다. */
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI: string;
  WEB_APP_URL: string;
  /** 로컬 전용. `'1'`이면 ENVIRONMENT === 'local'과 함께 가짜 OIDC를 쓴다. */
  GOOGLE_FAKE?: string;
  /** T-11-003 로컬 전용. `'1'`이면 ENVIRONMENT === 'local'과 함께 'fake:<sub>' Apple 신원 토큰을 받는다. */
  APPLE_FAKE?: string;
  /** T-11-003 Apple 신원 토큰의 aud(앱 번들 id). 없으면 com.offsidelab.app. */
  APPLE_BUNDLE_ID?: string;
  /** T-11-167 secret. 계정 삭제 때 Sign in with Apple 토큰을 해지한다(가이드라인 5.1.1(v)). 셋 중 하나라도 없으면 해지를 건너뛴다. */
  APPLE_TEAM_ID?: string;
  APPLE_SIGNIN_KEY_ID?: string;
  /** Sign in with Apple 키(.p8) PEM 원문. */
  APPLE_SIGNIN_PRIVATE_KEY?: string;
  /**
   * T-11-174 secret. Google Play 구매 확인용 서비스 계정 JSON 키 원문(Play Console에서 이 앱의 재무 데이터 보기 · 주문 관리
   * 권한). 없으면 Android 인앱 상품을 보이지 않는다.
   */
  GOOGLE_PLAY_SA_JSON?: string;
  /** T-11-174 secret. 쉼표 구분 프로필 id. 있으면 이 구단주에게만 인앱 상품을 보인다(출시 전 실기기 구매 확인용). 지우면 모두에게 열린다. */
  IAP_TESTERS?: string;
  /** T-10-011. secret. 쉼표 구분 관리자 구글 이메일(게시판 글쓰기). 비어 있으면 관리자가 없다. */
  ADMIN_EMAILS?: string;
  /** T-11-146 Workers AI(공지 번역 초안·댓글·채팅 번역 보기). staging·운영에만 있다 — 없으면 번역 경로가 503을 낸다. */
  AI?: Ai;
  /** T-10-070 D1 매일 백업을 두는 R2 버킷. 운영에만 있다 — 없으면 백업을 건너뛴다. */
  BACKUP?: R2Bucket;
  /** T-10-072 홈 라이브 실시간 허브. 테스트(getPlatformProxy)엔 없다 — 없으면 소켓은 503, 소식은 보내지 않는다. */
  LIVE?: DurableObjectNamespace<LiveHub>;
  /** T-11-015 채팅방(src/chat/room.ts). 테스트엔 없다 — 없으면 채팅 소켓은 503, 입장권은 SERVICE_UNAVAILABLE. */
  CHAT?: DurableObjectNamespace<ChatRoom>;
};

export type SessionContext = {
  id: string;
  profileId: string;
  channel: SessionChannel;
};

export type Variables = {
  requestId: string;
  /** `getDb(c)`로만 채운다. health 같은 DB 없는 라우트가 `env.DB` 없이도 동작하도록 지연 생성한다. */
  db?: Db;
  publicReadDb?: Db;
  session?: SessionContext;
  /** middleware/session.ts `resolveSession`의 요청당 메모. */
  sessionLookup?: Promise<SessionContext | undefined>;
  startedAt: number;
  /** bodyGuard가 읽은 상태 변경 요청의 본문. 라우트가 다시 읽지 않도록 전달한다. */
  rawBody?: string;
  /** 응답은 이미 성공했지만 부가 저장(예: idempotency 기록)이 실패했을 때 logger가 한 줄에 함께 남긴다. */
  storeFailure?: { code: string; message: string };
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };

export function parseAllowedOrigins(
  env: Partial<Pick<Bindings, 'ALLOWED_ORIGINS'>> | undefined,
): string[] {
  return (env?.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** DB를 실제로 쓰는 미들웨어·라우트에서만 부른다. 처음 호출될 때 만들어 `c.set('db', ...)`로 캐시한다. */
export function getDb(c: Context<AppEnv>): Db {
  const existing = c.get('db');
  if (existing) {
    return existing;
  }
  const db = createDb(c.env.DB);
  c.set('db', db);
  return db;
}

/** Only for explicitly public, read-only multi-query loaders. Auth/writes use getDb.
 * Anchor the first query on primary; subsequent reads can use a caught-up replica.
 * No cross-request bookmark or account/session state is stored. */
export function getPublicReadDb(c: Context<AppEnv>): Db {
  if (c.env.D1_READ_SESSIONS_DISABLED === '1') return getDb(c);
  const existing = c.get('publicReadDb');
  if (existing) return existing;
  const db = createDb(c.env.DB.withSession('first-primary'));
  c.set('publicReadDb', db);
  return db;
}
