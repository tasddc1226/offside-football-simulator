import {
  AdminCommentListSchema,
  AdminCommentPurgeInputSchema,
  AdminCommentPurgeResultSchema,
  AdminCommentQuerySchema,
  AdminStatsSchema,
  AutomationHoursSchema,
  AutomationReportSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import { getAdminStats, listRecentComments, purgeCommentsBy } from '../db/repos/admin.js';
import { getActiveBalance } from '../db/repos/balance.js';
import { automationReport } from '../db/repos/automation.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { ok, readBody, nowIso } from './shared.js';
import { parseWithAppError } from '../errors.js';
import { EDGE, STALE } from '../edgeKeys.js';

// T-10-016 운영 도구: 대시보드와 댓글 관리. 댓글 하나 지우기는 게시판의 DELETE /v1/boards/comments/:id를 쓴다.
const STATS_TTL = 60;

export function registerAdminRoutes(app: Hono<AppEnv>): void {
  // 관리자 확인을 먼저 하므로 엣지 캐시는 관리자에게만 나간다. 집계라 1분 늦어도 된다. 활성 밸런스는
  // 행 하나라 매번 읽는다 — 집계 캐시에 넣으면 밸런스 활성화가 대시보드 캐시까지 지워야 한다.
  app.get(EDGE.adminStats, async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const [stats, active] = await Promise.all([
      edgeCached(c, EDGE.adminStats, STATS_TTL, () => getAdminStats(db, new Date())),
      getActiveBalance(db),
    ]);
    const data = {
      ...stats,
      balance: active ? { version: active.version, activatedAt: active.activatedAt } : null,
    };
    return ok(c, AdminStatsSchema, data);
  });

  // 자동 플레이 탐지(관찰 전용). 운영자가 열 때만 읽는다(최근 hours시간 시즌, 시각 인덱스).
  app.get('/v1/admin/automation', async (c) => {
    await requireAdmin(c);
    const hours = parseWithAppError(AutomationHoursSchema, c.req.query('hours'));
    const data = await automationReport(getDb(c), new Date(), hours);
    return ok(c, AutomationReportSchema, data, 200, 'private, no-store');
  });

  app.get('/v1/admin/comments', async (c) => {
    await requireAdmin(c);
    const q = parseWithAppError(AdminCommentQuerySchema, c.req.query());
    const data = await listRecentComments(getDb(c), q);
    return ok(c, AdminCommentListSchema, data);
  });

  app.post('/v1/admin/comments/purge', async (c) => {
    const viewer = await requireAdmin(c);
    const { profileId } = readBody(c, AdminCommentPurgeInputSchema);
    const deleted = await purgeCommentsBy(getDb(c), profileId, viewer.profileId!, nowIso());
    if (deleted) purgeEdge(c, STALE.commentsPurged());
    return ok(c, AdminCommentPurgeResultSchema, { deleted });
  });
}
