import {
  AdminCommentListSchema,
  AdminCommentPurgeInputSchema,
  AdminCommentPurgeResultSchema,
  AdminCommentQuerySchema,
  AdminStatsSchema,
  successEnvelope,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import { getAdminStats, listRecentComments, purgeCommentsBy } from '../db/repos/admin.js';
import { getActiveBalance } from '../db/repos/balance.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { envelope, nowIso } from './shared.js';
import { parseJsonBody, parseWithAppError } from '../errors.js';
import { EDGE, STALE } from '../edgeKeys.js';

// T-10-016 운영 도구: 대시보드와 댓글 관리. 댓글 하나 지우기는 게시판의 DELETE /v1/boards/comments/:id를 쓴다.
const STATS_TTL = 60;

export function registerAdminRoutes(app: Hono<AppEnv>): void {
  // 관리자 확인을 먼저 하므로 엣지 캐시는 관리자에게만 나간다. 집계라 1분 늦어도 된다. 활성 밸런스는
  // 행 하나라 매번 읽는다 — 집계 캐시에 넣으면 밸런스 활성화가 대시보드 캐시까지 지워야 한다.
  app.get(EDGE.adminStats, async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const [stats, active] = await Promise.all([edgeCached(c, EDGE.adminStats, STATS_TTL, () => getAdminStats(db, new Date())), getActiveBalance(db)]);
    const data = { ...stats, balance: active ? { version: active.version, activatedAt: active.activatedAt } : null };
    return c.json(successEnvelope(AdminStatsSchema).parse(envelope(c, data)), 200);
  });

  app.get('/v1/admin/comments', async (c) => {
    await requireAdmin(c);
    const q = parseWithAppError(AdminCommentQuerySchema, c.req.query());
    const data = await listRecentComments(getDb(c), q);
    return c.json(successEnvelope(AdminCommentListSchema).parse(envelope(c, data)), 200);
  });

  app.post('/v1/admin/comments/purge', async (c) => {
    const viewer = await requireAdmin(c);
    const { profileId } = parseWithAppError(AdminCommentPurgeInputSchema, parseJsonBody(c.get('rawBody') ?? ''));
    const deleted = await purgeCommentsBy(getDb(c), profileId, viewer.profileId!, nowIso());
    if (deleted) purgeEdge(c, STALE.commentsPurged());
    return c.json(successEnvelope(AdminCommentPurgeResultSchema).parse(envelope(c, { deleted })), 200);
  });
}
