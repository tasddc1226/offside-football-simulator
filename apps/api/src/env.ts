import type { Context } from 'hono';
import { createDb, type Db } from './db/client.js';
import type { SessionChannel } from './db/repos/sessions.js';
import type { LiveHub } from './live/hub.js';

export type Bindings = {
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
  /** T-10-011. secret. 쉼표 구분 관리자 구글 이메일(게시판 글쓰기). 비어 있으면 관리자가 없다. */
  ADMIN_EMAILS?: string;
  /** T-10-070 D1 매일 백업을 두는 R2 버킷. 운영에만 있다 — 없으면 백업을 건너뛴다. */
  BACKUP?: R2Bucket;
  /** T-10-072 홈 라이브 실시간 허브. 테스트(getPlatformProxy)엔 없다 — 없으면 소켓은 503, 소식은 보내지 않는다. */
  LIVE?: DurableObjectNamespace<LiveHub>;
  /** T-10-076 영구결번을 여는 시각(ISO, UTC). 운영에만 둔다 — 없으면 바로 열려 있다. 오픈 뒤 지운다. */
  RETIRED_NUMBERS_OPEN_AT?: string;
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
