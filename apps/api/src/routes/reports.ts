import { NameReportInputSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { getNameTarget, reportName } from '../db/repos/nameReports.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { notFoundError, nowIso, readBody } from './shared.js';

// 공개 이름 신고(앱스토어 UGC 정책) — 명예의 전당 선수 이름, 구단 이름·감독 이름. 운영자가 관리 화면에서
// 가리거나 기각한다(routes/admin.ts).
export function registerReportRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/reports/names', requireProfile, async (c) => {
    const { kind, id } = readBody(c, NameReportInputSchema);
    const db = getDb(c);
    const target = await getNameTarget(db, kind, id);
    if (!target) throw notFoundError('신고할 이름을 찾지 못했어요.', 'NAME_NOT_FOUND');
    const { profileId } = getSessionOrThrow(c);
    if (target.ownerId === profileId)
      throw new AppError({ code: 'FORBIDDEN', message: '내 이름은 신고할 수 없어요.' });
    await reportName(db, { kind, targetId: id, profileId, name: target.name }, nowIso());
    return c.body(null, 204);
  });
}
