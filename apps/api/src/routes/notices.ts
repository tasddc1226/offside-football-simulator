import { NOTICES_DEFAULT_LIMIT, NOTICES_MAX_LIMIT, NoticesResponseSchema, successEnvelope } from '@offside/contracts';
import type { Hono } from 'hono';
import { listPublishedNotices, type NoticeRecord } from '../db/repos/notices.js';
import { getDb, type AppEnv } from '../env.js';

function parseLimit(raw: string | undefined): number {
  if (!raw) return NOTICES_DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return NOTICES_DEFAULT_LIMIT;
  return Math.min(Math.trunc(parsed), NOTICES_MAX_LIMIT);
}

/**
 * `body` 컬럼은 문단 배열을 JSON 문자열로 저장한다(schema.ts 주석). 값이 손상돼 파싱이 실패하면
 * 원문 전체를 한 문단으로 취급한다 — 공지 하나가 깨져도 나머지 목록·요청 전체를 실패시키지 않는다.
 */
function parseBody(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((p): p is string => typeof p === 'string' && p.length > 0)) {
      return parsed;
    }
    return [raw];
  } catch {
    return [raw];
  }
}

function toNotice(row: NoticeRecord) {
  return {
    id: row.id,
    title: row.title,
    body: parseBody(row.body),
    publishedAt: row.publishedAt,
  };
}

/** API-NOTICE-001: `GET /v1/notices`. 프로필 세션 불필요, 공개 GET이라 originGuard 대상이 아니다. */
export function registerNoticeRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/notices', async (c) => {
    const db = getDb(c);
    const limit = parseLimit(c.req.query('limit'));
    const rows = await listPublishedNotices(db, limit);

    c.header('Cache-Control', 'public, max-age=60');
    const body = successEnvelope(NoticesResponseSchema).parse({
      data: { items: rows.map(toNotice) },
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });
}
