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
import { careerOwnerMismatch, ok, readBody, nowIso, rateLimited } from './shared.js';
import {
  getCareer,
  getCareerHead,
  listOwnHof,
  putCareerSeason,
  putRetirement,
  storedSeasonOvr,
  storedSeasonsOf,
  updateRetired,
  verifiedRetiredTitle,
} from '../db/repos/careers.js';
import { boundProfile, boundRetirement, sanitizeSeason } from '../plausibility.js';
import { getProfile, isLinked } from '../db/repos/profiles.js';
import { recordAttempt } from '../db/repos/authAttempts.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { purgeEdge, waitUntil } from '../edgeCache.js';
import { refreshAfterChange } from '../team/ownerAchievements.js';
import { recordFirsts } from './firsts.js';
import { exceedsOvrCap, growthTampered } from '../db/repos/anomalies.js';
import { judgeRetirement } from './retiredNumbers.js';
import { STALE } from '../edgeKeys.js';
import { publishLive } from '../live/publish.js';
import { isHeadless } from '../db/repos/automation.js';
import { isAcceptablePublicName, toPublicName } from '@offside/contracts/content-filter';
import { resumeCareerDetails } from '../cron/careerRetention.js';
import { retireAtOf } from '@offside/contracts/service-seasons';
import { resolveBalance } from '@offside/contracts';
import { getActiveBalance } from '../db/repos/balance.js';
import { completeInvite } from '../db/repos/referrals.js';

/** 프로필당 시간당 업로드 한도. 정상 플레이는 시즌당 PUT 1회, 오프라인 큐 상한은 100이다.
 * T-11-182 시즌 한도 120은 빠르게 여러 커리어를 도는 이용자가 넘겨(한 커리어 최대 약 28시즌) 은퇴 기록이 한 시간까지 밀렸다. */
export const UPLOAD_LIMIT = { CAREER_SEASON: 300, CAREER_RETIRE: 30 } as const;

/** 검증을 통과한 업로드만 센다 — 잘못된 요청이 쿼터를 쓰지 않게, D1 쓰기 직전에 부른다. */
async function limitUpload(
  db: ReturnType<typeof getDb>,
  kind: keyof typeof UPLOAD_LIMIT,
  profileId: string,
): Promise<void> {
  if ((await recordAttempt(db, kind, profileId, nowIso())) > UPLOAD_LIMIT[kind]) {
    throw rateLimited('기록을 너무 자주 올리고 있어요. 잠시 뒤에 다시 시도해 주세요.');
  }
}

/** 소유권 확인: careerId가 이미 다른 프로필 소유면 409. 없으면(새 커리어) 통과. */
async function assertOwnable(
  db: ReturnType<typeof getDb>,
  careerId: string,
  profileId: string,
): Promise<Awaited<ReturnType<typeof getCareerHead>>> {
  const head = await getCareerHead(db, careerId);
  if (head !== undefined && head.profileId !== profileId) {
    throw careerOwnerMismatch();
  }
  return head;
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

    const body = readBody(c, PutCareerSeasonBodySchema);
    const head = await assertOwnable(db, careerId, session.profileId);
    await limitUpload(db, 'CAREER_SEASON', session.profileId);
    const now = nowIso();
    await resumeCareerDetails(
      c.env,
      careerId,
      session.profileId,
      head?.detailArchiveKey ?? null,
      head?.updatedAt,
      now,
    );
    // 나이별 OVR 상한을 크게 넘긴 값은 sanitizeSeason이 잘라 저장해 매일 점검에 남지 않으므로 저장과 함께 숨긴다.
    // T-11-097 시즌 중간에 세이브를 고쳐 올린 OVR도 성장 기록으로만 보이므로 같이 숨긴다(지난 시즌 조회는 성장 기록이 올 때만).
    const { growth } = body.season;
    const overCap = exceedsOvrCap(body.season.age, body.season.ovr);
    const prevOvr = growth && !overCap ? await storedSeasonOvr(db, careerId, year - 1) : null;
    const hide = overCap || growthTampered(growth, body.season.ovr, prevOvr);

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
      hide,
      now,
    });

    if (hide) purgeEdge(c, STALE.firstsChanged());
    else await recordFirsts(c, careerId);
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
        message: '커리어를 찾을 수 없어요.',
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
        message: '공개할 수 없는 이름이에요.',
        details: { reason: 'PUBLIC_NAME_REJECTED' },
      });
    }
    await limitUpload(db, 'CAREER_RETIRE', session.profileId);
    const now = nowIso();
    await resumeCareerDetails(
      c.env,
      careerId,
      session.profileId,
      career.detailArchiveKey,
      career.updatedAt,
      now,
    );

    if (career.status === 'retired') {
      await updateRetired(db, { careerId, publicName, snapshot, title: sent.title, now });
    } else {
      // 은퇴 요약은 받아 둔 시즌 기록에 맞춘다 — 보낸 숫자를 그대로 믿지 않는다.
      const seasons = (await storedSeasonsOf(db, [careerId])).get(careerId) ?? [];
      const summary = boundRetirement(
        career.pos,
        sent,
        seasons,
        career.dpos,
        retireAtOf(career.serviceSeason),
      );
      if (!summary) {
        throw new AppError({
          code: 'VALIDATION_FAILED',
          message: '시즌 기록이 있어야 은퇴를 기록할 수 있어요.',
          details: { reason: 'NO_SEASONS' },
        });
      }
      const balance = resolveBalance((await getActiveBalance(db))?.values);
      await putRetirement(db, {
        careerId,
        bonusRate: balance.marketRetireBonusRate,
        summary,
        publicName,
        snapshot,
        profile: profile && boundProfile(profile, summary.peak),
        potReal: sent.potReal,
        now,
      });
      await recordFirsts(c, careerId, { legendOnly: true }); // 레전드 점수 기록은 은퇴 때 판정한다.
    }
    // T-11-171 친구 초대로 들어온 구단주가 커리어를 은퇴까지 마쳤으면 두 사람에게 초대 보상을 준다. 판정 전 초대만 끝내므로
    // 재전송(이름 공개 토글)에서 다시 불려도 한 번만 주고, 처음 은퇴 뒤 판정이 실패했으면 재전송 때 마저 준다.
    await completeInvite(db, session.profileId, careerId, now);
    // T-10-076 영구결번 심사. 이름 공개 토글 재전송도 여기로 온다 — 이름을 공개하는 순간 자리를 잡는다.
    const judged = await judgeRetirement(c, careerId, now);
    purgeEdge(c, STALE.retirementPut(careerId));
    publishLive(c, 'retire', careerId, now);
    // T-11-028 그 시즌 구단주 업적 점수(업적 랭킹)를 응답 뒤에 다시 센다.
    waitUntil(c, refreshAfterChange(db, session.profileId, career.serviceSeason));

    return ok(c, RetirementResponseSchema, {
      careerId,
      status: 'retired',
      title: verifiedRetiredTitle(await getCareerHead(db, careerId)),
      ...judged,
      serviceSeason: career.serviceSeason,
    });
  });
}
