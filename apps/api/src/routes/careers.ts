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
import { careerOwnerMismatch, ok, readBody, nowIso } from './shared.js';
import {
  getCareer,
  getCareerHead,
  getCareerOwner,
  listOwnHof,
  putCareerSeason,
  putRetirement,
  storedSeasonsOf,
  updateRetired,
} from '../db/repos/careers.js';
import { boundProfile, boundRetirement, sanitizeSeason } from '../plausibility.js';
import { getProfile, isLinked } from '../db/repos/profiles.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { purgeEdge, waitUntil } from '../edgeCache.js';
import { refreshAfterChange } from '../team/ownerAchievements.js';
import { recordFirsts } from './firsts.js';
import { judgeRetirement } from './retiredNumbers.js';
import { STALE } from '../edgeKeys.js';
import { publishLive } from '../live/publish.js';
import { isHeadless } from '../db/repos/automation.js';
import { isAcceptablePublicName, toPublicName } from '@offside/contracts/content-filter';

/** 소유권 확인: careerId가 이미 다른 프로필 소유면 409. 없으면(새 커리어) 통과. */
async function assertOwnable(
  db: ReturnType<typeof getDb>,
  careerId: string,
  profileId: string,
): Promise<void> {
  const owner = await getCareerOwner(db, careerId);
  if (owner !== undefined && owner !== profileId) {
    throw careerOwnerMismatch();
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
    return ok(c, MyCareersResponseSchema, { linked, entries }, 200, 'private, no-store');
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
    const now = nowIso();

    await putCareerSeason(db, {
      careerId,
      profileId: session.profileId,
      year,
      meta: body.career,
      season: sanitizeSeason(body.season),
      eventsJson: JSON.stringify(body.events),
      // 링크·욕설이 든 이름은 시즌 기록까지 버리지 않고 익명으로만 남긴다(은퇴 PUT은 거부한다).
      publicName: body.publicName && toPublicName(body.publicName),
      signalsJson:
        body.signals &&
        JSON.stringify({ ...body.signals, headless: isHeadless(c.req.header('User-Agent')) }),
      now,
    });

    await recordFirsts(c, careerId);
    publishLive(c, 'season', careerId, now);
    const career = await getCareer(db, careerId);
    return ok(c, CareerUpsertResponseSchema, {
      careerId,
      year,
      status: career?.status ?? 'active',
    });
  });

  app.put('/v1/careers/:careerId/retirement', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));

    const career = await getCareerHead(db, careerId);
    if (career === undefined) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '존재하지 않는 커리어입니다.',
        details: { reason: 'CAREER_NOT_FOUND' },
      });
    }
    if (career.profileId !== session.profileId) {
      throw careerOwnerMismatch();
    }

    const { publicName, snapshot, profile, ...sent } = readBody(c, PutRetirementBodySchema);
    if (publicName && !isAcceptablePublicName(publicName)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '공개할 수 없는 이름입니다.',
        details: { reason: 'PUBLIC_NAME_REJECTED' },
      });
    }
    const now = nowIso();

    if (career.status === 'retired') {
      await updateRetired(db, { careerId, publicName, snapshot, title: sent.title, now });
    } else {
      // 은퇴 요약은 받아 둔 시즌 기록에 맞춘다 — 보낸 숫자를 그대로 믿지 않는다.
      const seasons = (await storedSeasonsOf(db, [careerId])).get(careerId) ?? [];
      const summary = boundRetirement(career.pos, sent, seasons, career.dpos);
      if (!summary) {
        throw new AppError({
          code: 'VALIDATION_FAILED',
          message: '시즌 기록이 없는 커리어는 은퇴를 기록할 수 없습니다.',
          details: { reason: 'NO_SEASONS' },
        });
      }
      await putRetirement(db, {
        careerId,
        summary,
        publicName,
        snapshot,
        profile: profile && boundProfile(profile, summary.peak),
        now,
      });
      await recordFirsts(c, careerId, { legendOnly: true }); // 레전드 점수 기록은 은퇴 때 판정한다.
    }
    // T-10-076 영구결번 심사. 이름 공개 토글 재전송도 여기로 온다 — 이름을 공개하는 순간 자리를 잡는다.
    const retiredNumber = await judgeRetirement(c, careerId, now);
    purgeEdge(c, STALE.retirementPut(careerId));
    publishLive(c, 'retire', careerId, now);
    // T-11-028 그 시즌 구단주 업적 점수(업적 랭킹)를 응답 뒤에 다시 센다.
    waitUntil(c, refreshAfterChange(db, session.profileId, career.serviceSeason));

    return ok(c, RetirementResponseSchema, {
      careerId,
      status: 'retired',
      retiredNumber,
      serviceSeason: career.serviceSeason,
    });
  });
}
