import type { Context } from 'hono';
import { createDb, type Db } from './db/client.js';
import type { SessionChannel } from './db/repos/sessions.js';

export type Bindings = {
  DB: D1Database;
  /** local|preview|staging|production. */
  ENVIRONMENT: string;
  /** 쉼표 구분 origin 목록. */
  ALLOWED_ORIGINS: string;
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
  startedAt: number;
  /** bodyGuard가 읽은 상태 변경 요청의 본문. 라우트가 다시 읽지 않도록 전달한다. */
  rawBody?: string;
  /** 응답은 이미 성공했지만 부가 저장(예: idempotency 기록)이 실패했을 때 logger가 한 줄에 함께 남긴다. */
  storeFailure?: { code: string; message: string };
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };

export function parseAllowedOrigins(env: Partial<Pick<Bindings, 'ALLOWED_ORIGINS'>> | undefined): string[] {
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
