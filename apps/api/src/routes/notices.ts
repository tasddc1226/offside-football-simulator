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
 * 빈/공백뿐인 문단은 제거한다: JSON.parse 실패 폴백에서 raw가 빈 문자열이면 그대로 두면 `['']`이 되어
 * NoticeSchema의 `body: z.array(z.string().min(1)).min(1)`과 충돌한다(원소 min(1)을 공백이 우연히
 * 통과해도 화면엔 빈 줄만 남는다). 필터링 뒤 문단이 하나도 안 남으면 빈 배열을 돌려주고, 그 공지는
 * `toNotice`가 `null`을 반환해 응답에서 제외한다 — 임의로 지어낸 "(내용 없음)" 같은 대체 문구를
 * 노출하기보다는 손상된 공지를 안 보여주는 쪽을 택했다(운영자가 SQL로 직접 고치는 데이터이므로
 * 깨진 채 노출되는 것보다 조용히 빠지는 편이 안전하다).
 */
function parseBody(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((p): p is string => typeof p === 'string')) {
      return parsed.map((p) => p.trim()).filter((p) => p.length > 0);
    }
    return sanitizeFallbackBody(raw);
  } catch {
    return sanitizeFallbackBody(raw);
  }
}

function sanitizeFallbackBody(raw: string): string[] {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? [trimmed] : [];
}

function toNotice(row: NoticeRecord): { id: string; title: string; body: string[]; publishedAt: string } | null {
  const body = parseBody(row.body);
  if (body.length === 0) return null;
  return {
    id: row.id,
    title: row.title,
    body,
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
    const items = rows.map(toNotice).filter((notice): notice is NonNullable<typeof notice> => notice !== null);
    const body = successEnvelope(NoticesResponseSchema).parse({
      data: { items },
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });
}
