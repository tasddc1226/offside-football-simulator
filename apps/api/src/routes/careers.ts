import { reqLang } from '../lang.js';
import { retiredLookErrors } from '../retiredLookText.js';
import { appearanceUnlocked } from '@offside/contracts/avatar-look';
import {
  ANON_CAREER_IDS_MAX,
  AnonCareerIdsResponseSchema,
  CareerIdParamSchema,
  CareerUpsertResponseSchema,
  CareerYearParamSchema,
  MyCareersResponseSchema,
  PutCareerSeasonBodySchema,
  PutRetirementBodySchema,
  PutCareerNamesBodySchema,
  PutCareerNamesResponseSchema,
  PutRetiredLookBodySchema,
  RetiredLookResponseSchema,
  RetiredLookPolicySchema,
  RetirementResponseSchema,
  RenameCareerBodySchema,
  RenameCareerResponseSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import {
  conflictError,
  notFoundError,
  careerOwnerMismatch,
  ok,
  readBody,
  nowIso,
  rateLimited,
} from './shared.js';
import {
  careerHeadQuery,
  prunedCareerQuery,
  getCareer,
  getCareerHead,
  groupStoredSeasons,
  listOwnHof,
  putCareerSeason,
  listAnonRetiredIds,
  publishCareerNames,
  putRetirement,
  seasonOvrQuery,
  storedSeasonsQuery,
  updateRetired,
  updateRetiredLook,
  retiredLookPolicy,
  verifiedRetiredTitle,
  verifiedSnapshot,
} from '../db/repos/careers.js';
import { clubsJsonMap, clubsJsonQuery } from '../db/repos/retiredNumbers.js';
import { boundProfile, boundRetirement, boundValueRows, sanitizeSeason } from '../plausibility.js';
import { getProfile, isLinked } from '../db/repos/profiles.js';
import { tryAttempt } from '../db/repos/authAttempts.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { purgeEdge, purgeEdgeOrigin, waitUntil } from '../edgeCache.js';
import { offerRetiredBest11 } from '../db/repos/best11.js';
import { refreshOwnerTitles } from '../db/repos/ownerTitles.js';
import { refreshAfterChange } from '../team/ownerAchievements.js';
import { recordFirsts } from './firsts.js';
import { exceedsOvrCap, growthTampered } from '../db/repos/anomalies.js';
import { farmedOnUpload } from '../db/repos/potentialAudit.js';
import { judgeRetirement } from './retiredNumbers.js';
import { EDGE, STALE } from '../edgeKeys.js';
import { publishLive } from '../live/publish.js';
import { isHeadless } from '../db/repos/automation.js';
import { isAcceptablePublicName, toPublicName } from '@offside/contracts/content-filter';
import { resumeCareerDetails } from '../cron/careerRetention.js';
import { putSnapshot, readSnapshotJson, titleIdsOf } from '../careerSnapshots.js';
import { retireAtOf } from '@offside/contracts/service-seasons';
import { legendScoreOfRecord } from '@offside/contracts/hof-rules';
import { resolveBalance } from '@offside/contracts';
import { activeBalanceQuery, balanceVersionOf } from '../db/repos/balance.js';
import { completeInvite } from '../db/repos/referrals.js';
import { renameCareer } from '../db/repos/careerRename.js';
import { idempotency } from '../middleware/idempotency.js';
import { cupKo } from '../cupText.js';
import { requireOwner } from './ownerTeam.js';

const RENAME_ERROR = {
  NOT_MINE: 'renameNotMine',
  HIDDEN: 'renameHidden',
  SAME: 'renameSame',
  NO_RENAME: 'noRename',
} as const;

/** 프로필당 시간당 업로드 한도. 정상 플레이는 시즌당 PUT 1회, 오프라인 큐 상한은 100이다.
 * T-11-182 시즌 한도 120은 빠르게 여러 커리어를 도는 이용자가 넘겨(한 커리어 최대 약 28시즌) 은퇴 기록이 한 시간까지 밀렸다. */
// CAREER_NAMES는 한 번에 100명까지라 시간당 20번이면 2천 명이다(T-11-266).
export const UPLOAD_LIMIT = {
  CAREER_SEASON: 300,
  CAREER_RETIRE: 30,
  CAREER_LOOK: 60,
  CAREER_NAMES: 20,
} as const;

/** 검증을 통과한 업로드만 센다 — 잘못된 요청이 쿼터를 쓰지 않게, D1 쓰기 직전에 부른다. */
async function limitUpload(
  db: ReturnType<typeof getDb>,
  kind: keyof typeof UPLOAD_LIMIT,
  profileId: string,
): Promise<void> {
  // Once exhausted, reject atomically without rewriting the same counter on every retry.
  if (!(await tryAttempt(db, kind, profileId, UPLOAD_LIMIT[kind], nowIso()))) {
    throw rateLimited('기록을 너무 자주 올리고 있어요. 잠시 뒤에 다시 시도해 주세요.');
  }
}

type CareerHead = Awaited<ReturnType<typeof careerHeadQuery>>[number];

/** 소유권 확인: careerId가 이미 다른 프로필 소유면 409. 없으면(새 커리어) 통과. */
function assertOwnable(head: CareerHead | undefined, profileId: string): CareerHead | undefined {
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

  // T-11-266 이름 없이 올라간 내 선수 id. 라커룸 안내가 이 기기가 아는 이름과 맞춰 본다(팔았거나 방출한 선수 포함).
  app.get('/v1/careers/mine/anonymous', requireProfile, async (c) => {
    const { profileId } = getSessionOrThrow(c);
    const ids = await listAnonRetiredIds(getDb(c), profileId, ANON_CAREER_IDS_MAX);
    return ok(c, AnonCareerIdsResponseSchema, { ids }, 200, 'private, no-store');
  });

  // T-11-266 익명으로 은퇴한 내 선수 이름을 한꺼번에 공개한다. 영구결번 심사는 다시 하지 않는다(은퇴 때와 선수별 이름
  // 공개 토글에서만). 카드·이적시장·명예의 전당은 careers.public_name을 그대로 읽어 바로 이름이 보인다.
  app.put('/v1/careers/public-names', requireProfile, async (c) => {
    const db = getDb(c);
    const { profileId } = getSessionOrThrow(c);
    const { items } = readBody(c, PutCareerNamesBodySchema);
    if (items.some((x) => !isAcceptablePublicName(x.publicName))) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        // i18n-ignore: 기존 은퇴 업로드와 같은 문구(클라이언트가 보내기 전에 거른다)
        message: '공개할 수 없는 이름이에요.',
        details: { reason: 'PUBLIC_NAME_REJECTED' },
      });
    }
    await limitUpload(db, 'CAREER_NAMES', profileId);
    const updated = await publishCareerNames(db, profileId, items, nowIso());
    if (updated.length)
      purgeEdge(c, [...updated.map(EDGE.hofDetail), ...STALE.retirementPut(updated[0]!)]);
    return ok(
      c,
      PutCareerNamesResponseSchema,
      { updated: updated.length },
      200,
      'private, no-store',
    );
  });

  // T-11-377 선수 이름 변경권 한 장으로 내 선수(진행 중 · 은퇴 · 이적시장에서 산 선수)의 이름을 바꾼다. 로그인한 구단주만
  // (아이템이 구단주 것이라). 재시도가 두 장을 쓰지 않게 멱등 키를 쓴다. 바뀐 이름은 명예의 전당 상세 · 첫 기록 캐시를 지우고,
  // 나머지 목록은 TTL로 따라온다.
  app.post('/v1/careers/:careerId/rename', requireProfile, idempotency, async (c) => {
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const me = await requireOwner(c);
    const name = toPublicName(readBody(c, RenameCareerBodySchema).name);
    if (!name) throw conflictError(cupKo('renameName'), 'PUBLIC_NAME_REJECTED');
    const r = await renameCareer(getDb(c), { careerId, profileId: me.id, name, now: nowIso() });
    if (!r.ok) throw conflictError(cupKo(RENAME_ERROR[r.reason]), r.reason);
    purgeEdge(c, STALE.retirementPut(careerId));
    return ok(
      c,
      RenameCareerResponseSchema,
      { careerId, name, rename: r.rename },
      200,
      'private, no-store',
    );
  });

  // Private editor-open check. Public HOF reads remain session-free and cacheable.
  app.get('/v1/careers/:careerId/look', requireProfile, async (c) => {
    const db = getDb(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const row = await getCareerHead(db, careerId);
    const text = retiredLookErrors(reqLang(c));
    if (!row) throw notFoundError(text.missing, 'CAREER_NOT_FOUND');
    if (row.profileId !== getSessionOrThrow(c).profileId) throw careerOwnerMismatch();
    if (row.status !== 'retired') throw conflictError(text.active, 'CAREER_NOT_RETIRED');
    const policy = await retiredLookPolicy(db, careerId);
    if (!policy) throw notFoundError(text.missing, 'CAREER_NOT_FOUND');
    return ok(c, RetiredLookPolicySchema, policy, 200, 'private, no-store');
  });

  // Separate from retirement upload: no score recalculation, rewards, titles or live notices.
  app.put('/v1/careers/:careerId/look', requireProfile, async (c) => {
    const db = getDb(c);
    const { profileId } = getSessionOrThrow(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const { look } = readBody(c, PutRetiredLookBodySchema);
    const text = retiredLookErrors(reqLang(c));
    const row = await getCareer(db, careerId);
    if (!row) throw notFoundError(text.missing, 'CAREER_NOT_FOUND');
    if (row.profileId !== profileId) throw careerOwnerMismatch();
    if (row.status !== 'retired') throw conflictError(text.active, 'CAREER_NOT_RETIRED');
    // No-op/retry never spends another change, even if a successful response was lost.
    if (row.look === look)
      return ok(c, RetiredLookResponseSchema, { careerId, look }, 200, 'private, no-store');
    const policy = await retiredLookPolicy(db, careerId);
    if (policy?.lockedReason) {
      throw conflictError(
        text[policy.lockedReason],
        policy.lockedReason === 'transferred' ? 'LOOK_TRANSFERRED' : 'LOOK_ALREADY_USED',
      );
    }
    const titles = titleIdsOf(await readSnapshotJson(c.env, row));
    if (!appearanceUnlocked(look, row.look, titles)) {
      throw conflictError(text.locked, 'LOOK_RECORD_LOCKED');
    }
    await limitUpload(db, 'CAREER_LOOK', profileId);
    const saved = await updateRetiredLook(db, careerId, profileId, look);
    if (!saved) {
      const latest = await retiredLookPolicy(db, careerId);
      if (latest?.look === look)
        return ok(c, RetiredLookResponseSchema, { careerId, look }, 200, 'private, no-store');
      const reason = latest?.lockedReason ?? 'used';
      throw conflictError(
        text[reason],
        reason === 'transferred' ? 'LOOK_TRANSFERRED' : 'LOOK_ALREADY_USED',
      );
    }
    purgeEdge(c, [EDGE.hofDetail(careerId)]);
    return ok(c, RetiredLookResponseSchema, saved, 200, 'private, no-store');
  });

  // 두 라우트 모두 URL 키(career_id+year, career_id)로 이미 자연스럽게 멱등이라 Idempotency-Key
  // 미들웨어를 걷지 않는다(같은 키로 재전송해도 결과가 같다 — upsert이기 때문).
  app.put('/v1/careers/:careerId/seasons/:year', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const year = parseWithAppError(CareerYearParamSchema, c.req.param('year'));

    const body = readBody(c, PutCareerSeasonBodySchema);
    // T-11-276 커리어 머리와 지난 시즌 OVR을 한 왕복으로 읽는다(둘 다 기본 키 한 줄).
    // T-11-468 지운 버린 커리어의 흔적도 같은 왕복으로 읽는다(다시 만들 때 주인 · 처음 서비스 시즌).
    const [[headRow], [prevRow], [pruned]] = await db.batch([
      careerHeadQuery(db, careerId),
      seasonOvrQuery(db, careerId, year - 1),
      prunedCareerQuery(db, careerId),
    ]);
    const head = assertOwnable(headRow, session.profileId);
    if (!head && pruned && pruned.profileId !== session.profileId) throw careerOwnerMismatch();
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
    const prevOvr = growth && !overCap ? (prevRow?.ovr ?? null) : null;
    // T-11-462 처음 올라오는 높은 잠재력 선수는 구단주가 후보를 조작해 모은 것인지 같이 본다(높은 잠재력일 때만 조회).
    const hide =
      overCap ||
      growthTampered(growth, body.season.ovr, prevOvr) ||
      (!head && (await farmedOnUpload(db, session.profileId, body.career.pot, now)));

    const sentRevision = Number(c.req.header('X-Upload-Revision'));
    // Legacy clients omit the header; retain their existing update contract.
    const uploadRevision =
      Number.isSafeInteger(sentRevision) && sentRevision > 0 && sentRevision <= Date.now() + 300_000
        ? sentRevision
        : undefined;
    const status = await putCareerSeason(db, {
      ...(uploadRevision !== undefined && { uploadRevision }),
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
      adsJson: body.ads && JSON.stringify(body.ads),
      hide,
      now,
      ...(!head && pruned && { serviceSeason: pruned.serviceSeason }),
    });

    if (hide) purgeEdge(c, STALE.firstsChanged());
    else await recordFirsts(c, careerId);
    publishLive(c, 'season', careerId, now);
    return ok(c, CareerUpsertResponseSchema, {
      careerId,
      year,
      status,
    });
  });

  app.put('/v1/careers/:careerId/retirement', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const careerId = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));

    // T-11-276 응답 전에 필요한 읽기를 한 왕복으로. 은퇴 PUT은 D1 왕복 수가 그대로 응답 시간이라(쿼리 자체는 1ms 아래)
    // 커리어 머리·받아 둔 시즌·활성 밸런스·구단명 커스텀(결번 심사용)을 한 batch로 받고, 뒤의 판정은 나란히 돌린다.
    const [[career], seasonRows, [balanceRow], customRows] = await db.batch([
      careerHeadQuery(db, careerId),
      storedSeasonsQuery(db, [careerId]),
      activeBalanceQuery(db),
      clubsJsonQuery(db, [session.profileId]),
    ]);
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
    const first = career.status !== 'retired';
    // T-11-311 상세 스냅샷은 R2에 먼저 쓴다(첫 은퇴, 또는 상세 없이 은퇴한 기록에 처음 올 때만 — 첫 상세가 정본).
    // 이미 은퇴한 기록의 대표 칭호를 바꾸면 R2에 둔 상세의 획득 칭호로 확인한다. 둘 다 아래 보관 복원과 나란히 돈다.
    const [snapshotKey, snapshotTitleIds] = await Promise.all([
      snapshot && (first || !career.hasSnapshot)
        ? putSnapshot(c.env, careerId, JSON.stringify(verifiedSnapshot(snapshot, false)))
        : null,
      !first && sent.title && career.snapshotKey
        ? readSnapshotJson(c.env, { snapshotJson: null, snapshotKey: career.snapshotKey }).then(
            titleIdsOf,
          )
        : [],
      resumeCareerDetails(
        c.env,
        careerId,
        session.profileId,
        career.detailArchiveKey,
        career.updatedAt,
        now,
      ),
    ]);

    const seasons = groupStoredSeasons(seasonRows).get(careerId) ?? [];
    let written;
    if (!first) {
      written = await updateRetired(db, {
        careerId,
        publicName,
        snapshot,
        snapshotKey,
        snapshotTitleIds,
        title: sent.title,
        now,
      });
    } else {
      // 은퇴 요약은 받아 둔 시즌 기록에 맞춘다 — 보낸 숫자를 그대로 믿지 않는다.
      // T-11-187 스냅샷이 있으면 레전드 점수는 서버가 지금 공식으로 다시 매긴다. 레전드 공식을 바꾼 뒤에도 OTA를 못 받은
      // 옛 앱이 옛 공식 점수를 보내기 때문이다(T-11-168 뒤 iOS 옛 빌드).
      const legendScore = snapshot
        ? legendScoreOfRecord({ ...snapshot, pos: career.pos, dpos: career.dpos })
        : sent.legendScore;
      const summary = boundRetirement(
        career.pos,
        { ...sent, legendScore },
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
      const balance = resolveBalance(balanceRow && balanceVersionOf(balanceRow).values);
      written = await putRetirement(db, {
        careerId,
        bonusRate: balance.marketRetireBonusRate,
        summary,
        publicName,
        snapshot,
        snapshotKey,
        profile: profile && boundProfile(profile, summary.peak),
        potReal: sent.potReal,
        look: sent.look,
        // T-11-448 카드 기준가·은퇴 가치·장려금은 받아 둔 시즌에 맞춘 행으로 매긴다(보낸 시즌 OVR을 그대로 믿지 않는다).
        valueRows:
          snapshot && boundValueRows(snapshot.career, seasons, retireAtOf(career.serviceSeason)),
        now,
      });
    }
    // 은퇴 쓰기 뒤의 세 판정은 서로 다른 표를 쓰므로 나란히 돈다 — 응답은 가장 긴 결번 심사만 기다린다.
    const [judged] = await Promise.all([
      // T-10-076 영구결번 심사. 이름 공개 토글 재전송도 여기로 온다 — 이름을 공개하는 순간 자리를 잡는다.
      judgeRetirement(c, careerId, now, { seasons, customs: clubsJsonMap(customRows) }),
      // 레전드 점수 기록은 은퇴 때 판정한다(첫 은퇴만).
      first ? recordFirsts(c, careerId, { legendOnly: true }) : undefined,
      // T-11-171 친구 초대로 들어온 구단주가 커리어를 은퇴까지 마쳤으면 두 사람에게 초대 보상을 준다. 판정 전 초대만 끝내므로
      // 재전송(이름 공개 토글)에서 다시 불려도 한 번만 주고, 처음 은퇴 뒤 판정이 실패했으면 재전송 때 마저 준다.
      completeInvite(db, session.profileId, careerId, now),
    ]);
    purgeEdge(c, STALE.retirementPut(careerId));
    publishLive(c, 'retire', careerId, now);
    // T-11-028 그 시즌 구단주 업적 점수(업적 랭킹)를 응답 뒤에 다시 센다.
    waitUntil(
      c,
      Promise.all([
        refreshAfterChange(db, session.profileId, career.serviceSeason),
        refreshOwnerTitles(db, session.profileId, now),
        // T-11-463 시즌 BEST 11 후보(이름을 공개한 은퇴만). 자리 주인이 바뀌면 그 시즌 BEST 11 캐시를 지운다.
        offerRetiredBest11(db, { id: careerId, dpos: career.dpos }, seasons, now).then(
          async (season) => {
            if (season !== null)
              await purgeEdgeOrigin(new URL(c.req.url).origin, [EDGE.best11(season)]);
          },
        ),
      ]),
    );

    // 응답 칭호는 다시 읽지 않는다 — 쓰기가 돌려준 칭호에, 심사가 방금 적었을 수 있는 명예의 벽을 얹는다
    // (심사는 result.kind 'taken'일 때 wallOfHonor를 심사 뒤 값으로 알려 준다).
    const wallOfHonor =
      judged.retiredNumber?.kind === 'taken'
        ? judged.retiredNumber.wallOfHonor
        : written?.wallOfHonorJson != null;
    return ok(c, RetirementResponseSchema, {
      careerId,
      status: 'retired',
      title: verifiedRetiredTitle(
        written && { title: written.title, wallOfHonorJson: wallOfHonor ? 'granted' : null },
      ),
      ...judged,
      serviceSeason: career.serviceSeason,
    });
  });
}
