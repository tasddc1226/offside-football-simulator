import {
  AdminCommentListSchema,
  AdminCommentPurgeInputSchema,
  AdminCommentPurgeResultSchema,
  AdminCommentQuerySchema,
  AdminNameReportListSchema,
  AdminNameReportResolveSchema,
  AdminStatsSchema,
  AnomalyReportSchema,
  CareerHiddenInputSchema,
  AutomationHoursSchema,
  AutomationReportSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import { getAdminStats, listRecentComments, purgeCommentsBy } from '../db/repos/admin.js';
import { listOpenNameReports, resolveNameReports } from '../db/repos/nameReports.js';
import { getActiveBalance } from '../db/repos/balance.js';
import { anomalyReport, setCareerHidden } from '../db/repos/anomalies.js';
import { automationReport } from '../db/repos/automation.js';
import { edgeCached, purgeEdge } from '../edgeCache.js';
import { getDb, type AppEnv } from '../env.js';
import { notFoundError, ok, readBody, nowIso } from './shared.js';
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

  // 비정상 기록: 검토 대상과 숨겨진 커리어. 매일 cron(repos/anomalies.ts)이 확실한 것은 이미 숨긴다.
  app.get('/v1/admin/anomalies', async (c) => {
    await requireAdmin(c);
    const data = await anomalyReport(c.env.DB, Date.now());
    return ok(c, AnomalyReportSchema, data, 200, 'private, no-store');
  });

  // 명예의 전당 상세·서버 기록 캐시는 바로 지우고, 목록은 TTL(1분)로 바뀐다.
  app.post('/v1/admin/careers/hidden', async (c) => {
    await requireAdmin(c);
    const { careerId, hidden } = readBody(c, CareerHiddenInputSchema);
    if (!(await setCareerHidden(c.env.DB, careerId, hidden, Date.now())))
      throw notFoundError('커리어를 찾을 수 없어요.', 'CAREER_NOT_FOUND');
    purgeEdge(c, STALE.retirementPut(careerId));
    return c.body(null, 204);
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

  app.get('/v1/admin/name-reports', async (c) => {
    await requireAdmin(c);
    return ok(c, AdminNameReportListSchema, { items: await listOpenNameReports(getDb(c)) });
  });

  // 가리면 이름이 보이는 공개 조회의 엣지 캐시를 지운다(명예의 전당 목록·팀 랭킹 뒤 페이지는 TTL로).
  app.post('/v1/admin/name-reports/resolve', async (c) => {
    const viewer = await requireAdmin(c);
    const input = readBody(c, AdminNameReportResolveSchema);
    const done = await resolveNameReports(getDb(c), input, viewer.profileId!, nowIso());
    if (!done) throw notFoundError('열린 신고가 없어요.', 'NAME_REPORT_NOT_FOUND');
    if (input.action === 'hide') {
      if (input.kind === 'career') purgeEdge(c, STALE.retirementPut(input.id));
      else if (done.season !== null) purgeEdge(c, STALE.teamSaved(done.season));
    }
    return c.body(null, 204);
  });
}
