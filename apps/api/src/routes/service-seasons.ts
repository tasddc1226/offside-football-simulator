import { successEnvelope, type ServiceSeasonCurrent, ServiceSeasonCurrentSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import { getServiceSeasonById, type ServiceSeasonRecord } from '../db/repos/serviceSeasons.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';

/** D-54: 서버는 문장을 만들지 않는다(D-12 관례) — isTest 시즌이면 웹이 찾을 고정 문구 키만 준다. */
function noticeFor(row: ServiceSeasonRecord): ServiceSeasonCurrent['notice'] {
  return row.isTest ? 'LINE_TEST' : null;
}

/** API-SVC-001: `GET /v1/service-seasons/current`. 프로필 세션 불필요, 공개 GET이라 originGuard 대상이 아니다. */
export function registerServiceSeasonRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/service-seasons/current', async (c) => {
    const pointer = c.env.ACTIVE_SERVICE_SEASON_ID;
    if (!pointer) {
      throw new AppError({ code: 'SERVICE_SEASON_UNAVAILABLE', message: '서비스 시즌이 설정되지 않았습니다.' });
    }

    const db = getDb(c);
    const row = await getServiceSeasonById(db, pointer);
    if (!row) {
      throw new AppError({ code: 'SERVICE_SEASON_UNAVAILABLE', message: '서비스 시즌을 찾을 수 없습니다.' });
    }

    c.header('Cache-Control', 'public, max-age=60');
    const body = successEnvelope(ServiceSeasonCurrentSchema).parse({
      data: {
        id: row.id,
        name: row.name,
        status: row.status,
        isTest: row.isTest === 1,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        rulesetVersion: row.rulesetVersion,
        contentPackVersion: row.contentPackVersion,
        notice: noticeFor(row),
      },
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });
}
