import {
  CareerIdParamSchema,
  CareerUpsertResponseSchema,
  CareerYearParamSchema,
  MyCareersResponseSchema,
  PutCareerSeasonBodySchema,
  PutRetirementBodySchema,
  RetirementResponseSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { ok, readBody } from './shared.js';
import { getCareer, getCareerOwner, listOwnHof, putCareerSeason, putRetirement } from '../db/repos/careers.js';
import { getProfile, isLinked } from '../db/repos/profiles.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { purgeEdge } from '../edgeCache.js';
import { recordFirsts } from './firsts.js';
import { STALE } from '../edgeKeys.js';
import { isAcceptablePublicName } from '@offside/contracts/content-filter';

/** 소유권 확인: careerId가 이미 다른 프로필 소유면 409. 없으면(새 커리어) 통과. */
async function assertOwnable(db: ReturnType<typeof getDb>, careerId: string, profileId: string): Promise<void> {
  const owner = await getCareerOwner(db, careerId);
  if (owner !== undefined && owner !== profileId) {
    throw new AppError({
      code: 'CAREER_OWNER_MISMATCH',
      message: '이 커리어 ID는 다른 프로필 소유입니다.',
    });
  }
}

export function registerCareerRoutes(app: Hono<AppEnv>): void {
  // T-10-013 명예의 전당 '내 선수'를 계정 기준으로. 계정(구글·토스)에 연결된 프로필이면 기기와 상관없이
  // 같은 목록이 나온다. 익명 프로필이면 linked=false — 웹은 기기 기록을 그대로 쓴다.
  app.get('/v1/careers/mine', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const profile = await getProfile(db, session.profileId);
    const linked = !!profile && isLinked(profile);
    const entries = linked ? await listOwnHof(db, session.profileId) : [];
    c.header('Cache-Control', 'private, no-store');
    return ok(c, MyCareersResponseSchema, { linked, entries });
  });

  // 두 라우트 모두 URL 키(career_id+year, career_id)로 이미 자연스럽게 멱등이라 Idempotency-Key
  // 미들웨어를 걷지 않는다(같은 키로 재전송해도 결과가 같다 — upsert이기 때문).
  app.put('/v1/careers/:careerId/seasons/:year', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const year = parseWithAppError(CareerYearParamSchema, c.req.param('year'));

    await assertOwnable(db, careerId, session.profileId);

    const body = readBody(c, PutCareerSeasonBodySchema);
    const now = new Date().toISOString();

    await putCareerSeason(db, {
      careerId,
      profileId: session.profileId,
      year,
      meta: body.career,
      season: body.season,
      eventsJson: JSON.stringify(body.events),
      now,
    });

    await recordFirsts(c, careerId);
    const career = await getCareer(db, careerId);
    return ok(c, CareerUpsertResponseSchema, { careerId, year, status: career?.status ?? 'active' });
  });

  app.put('/v1/careers/:careerId/retirement', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));

    const owner = await getCareerOwner(db, careerId);
    if (owner === undefined) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '존재하지 않는 커리어입니다.',
        details: { reason: 'CAREER_NOT_FOUND' },
      });
    }
    if (owner !== session.profileId) {
      throw new AppError({
        code: 'CAREER_OWNER_MISMATCH',
        message: '이 커리어 ID는 다른 프로필 소유입니다.',
      });
    }

    const { publicName, snapshot, ...summary } = readBody(c, PutRetirementBodySchema);
    if (publicName && !isAcceptablePublicName(publicName)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '공개할 수 없는 이름입니다.',
        details: { reason: 'PUBLIC_NAME_REJECTED' },
      });
    }
    const now = new Date().toISOString();

    await putRetirement(db, { careerId, summary, publicName, snapshot, now });
    await recordFirsts(c, careerId, { legendOnly: true }); // 레전드 점수 기록은 은퇴 때 판정한다.
    purgeEdge(c, STALE.retirementPut(careerId));

    return ok(c, RetirementResponseSchema, { careerId, status: 'retired' });
  });
}
