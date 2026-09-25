import {
  CareerIdParamSchema,
  HofDetailResponseSchema,
  HofListQuerySchema,
  HofListResponseSchema,
  successEnvelope,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { getPublicHof, listPublicHof } from '../db/repos/careers.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';

// T-10-005 공개 명예의 전당. 로그인 없이 누구나 읽는다 — 응답에는 유저가 공개를 고른 이름과 커리어
// 기록만 있고 프로필·계정 정보는 없다. D1 읽기를 줄이려고 짧게 캐시한다.
const CACHE = 'public, max-age=60';

// 공개 이름 최소 필터: 링크·연락처 홍보와 흔한 욕설만 막는다(완벽한 검열이 목적이 아니다).
const LINK = /https?:|www\.|\.(com|net|kr|io|gg)\b/i;
const PROFANITY = /(시발|씨발|ㅅㅂ|병신|ㅂㅅ|개새|좆|지랄|fuck|shit|bitch)/i;
export function isAcceptablePublicName(name: string): boolean {
  const compact = name.replace(/\s+/g, '');
  return !LINK.test(compact) && !PROFANITY.test(compact);
}
/** 긴 글(게시판 댓글)용 — 링크는 허용하고 흔한 욕설만 막는다. */
export const hasProfanity = (text: string): boolean => PROFANITY.test(text.replace(/\s+/g, ''));

export function registerHofRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/hof', async (c) => {
    const limit = parseWithAppError(HofListQuerySchema, c.req.query('limit'));
    const entries = await listPublicHof(getDb(c), limit);
    const body = successEnvelope(HofListResponseSchema).parse({ data: { entries }, meta: { requestId: c.get('requestId') } });
    c.header('Cache-Control', CACHE);
    return c.json(body, 200);
  });

  app.get('/v1/hof/:careerId', async (c) => {
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const found = await getPublicHof(getDb(c), careerId);
    if (!found) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        status: 404,
        message: '명예의 전당에 없는 선수입니다.',
        details: { reason: 'HOF_NOT_FOUND' },
      });
    }
    const body = successEnvelope(HofDetailResponseSchema).parse({ data: found, meta: { requestId: c.get('requestId') } });
    c.header('Cache-Control', CACHE);
    return c.json(body, 200);
  });
}
