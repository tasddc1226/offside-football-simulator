import {
  AUTHORIZATION_HEADER,
  DeleteProfileConfirmBodySchema,
  DeleteProfileStartResponseSchema,
  IssueRecoveryCodeResponseSchema,
  PatchProfileSettingsBodySchema,
  ProfileSchema,
  PutNicknameBodySchema,
  PutAvatarBodySchema,
  RecoverProfileBodySchema,
  RecoverProfileResponseSchema,
  type DeleteProfileConfirmBody,
  type Profile,
  type ProfileSettings,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { profiles, profileAvatars } from '../db/schema.js';
import { reqLang } from '../lang.js';
import { avatarText } from '../profile/avatarText.js';
import { validateAvatarImage } from '../profile/avatar.js';
import { chatRoom } from '../chat/socket.js';
import { clientIp, ok, readBody, readJson, nowIso, enforceLimit, conflictError } from './shared.js';
import { commentIdentity } from '../auth/admin.js';
import { issueSession, readSessionToken, sessionCookie } from '../auth/session.js';
import { sha256Hex } from '../db/hash.js';
import {
  getProfile,
  createProfile,
  setNickname,
  touchLastSeen,
  updateSettings,
  type ProfileRecord,
} from '../db/repos/profiles.js';
import { isAcceptablePublicName, isReservedNickname } from '@offside/contracts/content-filter';
import { revokeSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';
import { edgeCached, purgeEdge, waitUntil } from '../edgeCache.js';
import { revokeAppleAuthorization } from '../auth/apple-revoke.js';
import { STALE } from '../edgeKeys.js';
import { issueRecoveryCode } from '../profile/issue-recovery-code.js';
import { maskEmail } from '../profile/mask-email.js';
import { recoverProfile } from '../profile/recover.js';

const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;
/** 한 주소에서 1시간에 새로 만들 수 있는 프로필 수(학교·회사 공유 주소도 넉넉히 지난다). */
const PROFILE_CREATE_LIMIT = 30;

function buildProfileResponse(record: ProfileRecord, adminEmails: string | undefined): Profile {
  return {
    id: record.id,
    settings: record.settings,
    linked: {
      google: record.googleSub !== null,
      toss: record.tossAnonKeyHash !== null,
      apple: record.appleSub !== null,
    },
    recoveryCodeIssuedAt: record.recoveryCodeIssuedAt,
    createdAt: record.createdAt,
    googleEmailMasked: maskEmail(record.email),
    nickname: commentIdentity(record, adminEmails).nickname,
    avatarId: record.avatarId ?? null,
  };
}

export function registerProfileRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/profile', async (c) => {
    const db = getDb(c);
    const now = nowIso();
    const existingSession = await resolveSession(c);
    const bearerPresent = Boolean(c.req.header(AUTHORIZATION_HEADER));

    // 결정 3: Bearer가 왔는데 무효면 쿠키로 폴백하지 않고 401이다.
    if (!existingSession && bearerPresent) {
      throw new AppError({
        code: 'PROFILE_REQUIRED',
        message: '접속 정보가 만료됐어요. 다시 연결해 주세요.',
      });
    }

    let record: ProfileRecord | undefined = existingSession
      ? await getProfile(db, existingSession.profileId)
      : undefined;

    if (existingSession && !record) {
      // 세션은 유효하지만 프로필이 사라졌다. 세션을 폐기하고 아래에서 새로 발급한다.
      await revokeSession(db, existingSession.id, now);
    }

    if (!record) {
      // 한 주소에서 새 프로필을 계속 만들어 내는 스크립트를 늦춘다.
      await enforceLimit(
        db,
        'PROFILE_CREATE',
        clientIp(c),
        PROFILE_CREATE_LIMIT,
        now,
        '새 프로필을 너무 자주 만들고 있어요. 잠시 뒤에 다시 시도해 주세요.',
      );
      record = await createProfile(db);
      const { token } = await issueSession(db, { profileId: record.id, channel: 'web', now });
      c.header('Set-Cookie', sessionCookie(token));
    } else if (Date.now() - Date.parse(record.lastSeenAt) >= LAST_SEEN_REFRESH_MS) {
      await touchLastSeen(db, record.id, now);
      record = { ...record, lastSeenAt: now };
    }

    return ok(c, ProfileSchema, buildProfileResponse(record, c.env.ADMIN_EMAILS));
  });

  // Public, opaque/versioned image URL: no session resolution and no profile IDs exposed.
  app.get('/v1/avatars/:id', async (c) => {
    const id = c.req.param('id');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))
      return c.notFound();
    const image = await edgeCached(c, `/v1/avatars/${id}`, 60, async () => {
      const [row] = await getDb(c)
        .select({ image: profileAvatars.image })
        .from(profileAvatars)
        .where(eq(profileAvatars.id, id));
      return row?.image;
    });
    if (!image) {
      c.header('Cache-Control', 'no-store');
      return c.notFound();
    }
    const [prefix, encoded] = image.split(',');
    const bytes = Uint8Array.from(atob(encoded!), (ch) => ch.charCodeAt(0));
    c.header('Content-Type', prefix!.includes('webp') ? 'image/webp' : 'image/png');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'public, max-age=60');
    return c.body(bytes);
  });

  app.put('/v1/profile/avatar', requireProfile, async (c) => {
    const db = getDb(c);
    const { profileId } = getSessionOrThrow(c);
    const profile = await getProfile(db, profileId);
    if (!profile || !commentIdentity(profile, c.env.ADMIN_EMAILS).google)
      throw new AppError({
        code: 'FORBIDDEN',
        message: avatarText(reqLang(c)).login,
      });
    const { image } = readBody(c, PutAvatarBodySchema);
    if (image) validateAvatarImage(image, reqLang(c));
    await enforceLimit(db, 'PROFILE_AVATAR', profileId, 20, nowIso(), avatarText(reqLang(c)).rate);
    const avatarId = image ? crypto.randomUUID() : null;
    await db.batch([
      image && avatarId
        ? db
            .insert(profileAvatars)
            .values({ profileId, id: avatarId, image })
            .onConflictDoUpdate({ target: profileAvatars.profileId, set: { id: avatarId, image } })
        : db.delete(profileAvatars).where(eq(profileAvatars.profileId, profileId)),
      db.update(profiles).set({ avatarId }).where(eq(profiles.id, profileId)),
    ]);
    if (profile.avatarId) purgeEdge(c, [`/v1/avatars/${profile.avatarId}`]);
    if (c.env.CHAT) waitUntil(c, chatRoom(c.env.CHAT).updateAvatar(profileId, avatarId));
    return ok(c, ProfileSchema, buildProfileResponse({ ...profile, avatarId }, c.env.ADMIN_EMAILS));
  });

  app.patch('/v1/profile/settings', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const patch = readBody(c, PatchProfileSettingsBodySchema);
    // zod .partial()의 추론 타입은 exactOptionalPropertyTypes에서 `key?: T | undefined`가 되어
    // `Partial<ProfileSettings>`(`key?: T`)와 어긋난다. 없는 키를 걷어내 좁힌다.
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<ProfileSettings>;
    const updated = await updateSettings(db, session.profileId, definedPatch);

    return ok(c, ProfileSchema, buildProfileResponse(updated, c.env.ADMIN_EMAILS));
  });

  // T-10-028 댓글 닉네임. 구글 로그인한 프로필만 정할 수 있고, 다른 사람과 겹치면 409.
  app.put('/v1/profile/nickname', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const { nickname } = readBody(c, PutNicknameBodySchema);
    const profile = await getProfile(db, session.profileId);
    const identity = commentIdentity(profile, c.env.ADMIN_EMAILS);
    if (!profile || !identity.google) {
      throw new AppError({
        code: 'FORBIDDEN',
        message: '로그인하면 닉네임을 정할 수 있어요.',
        details: { reason: 'GOOGLE_LOGIN_REQUIRED' },
      });
    }
    if (identity.admin) {
      throw new AppError({
        code: 'FORBIDDEN',
        message: `운영자 계정의 댓글 닉네임은 '${identity.nickname}'로 고정돼요.`,
        details: { reason: 'ADMIN_NICKNAME_FIXED' },
      });
    }
    if (isReservedNickname(nickname)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: `'운영자'처럼 운영진으로 보이는 닉네임은 쓸 수 없어요.`,
        details: { reason: 'RESERVED_NICKNAME' },
      });
    }
    if (!isAcceptablePublicName(nickname)) {
      throw new AppError({
        code: 'VALIDATION_FAILED',
        message: '쓸 수 없는 닉네임이에요.',
        details: { reason: 'BLOCKED_WORD' },
      });
    }
    const updated = await setNickname(db, profile.id, nickname);
    if (updated === 'taken') {
      throw conflictError('이미 쓰고 있는 닉네임이에요.', 'NICKNAME_TAKEN');
    }
    return ok(c, ProfileSchema, buildProfileResponse(updated, c.env.ADMIN_EMAILS));
  });

  app.post('/v1/profile/recovery-code', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const now = nowIso();

    const result = await issueRecoveryCode(db, { profileId: session.profileId, now });

    return ok(c, IssueRecoveryCodeResponseSchema, result);
  });

  app.post('/v1/profile/recover', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const parsed = readBody(c, RecoverProfileBodySchema);
    const now = nowIso();
    const ip = clientIp(c);

    const result = await recoverProfile(db, {
      code: parsed.code,
      currentProfileId: session.profileId,
      sessionId: session.id,
      ip,
      now,
    });

    return ok(c, RecoverProfileResponseSchema, result);
  });

  app.post('/v1/profile/delete', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const body = parseDeleteBody(readJson(c));
    const now = nowIso();
    const rawToken = readSessionToken(c);
    if (!rawToken) {
      throw new AppError({
        code: 'PROFILE_REQUIRED',
        message: '접속 정보가 없어요. 다시 연결해 주세요.',
      });
    }
    const sessionTokenHash = await sha256Hex(rawToken);

    if (body.confirmToken === undefined) {
      const result = await issueDeleteConfirmToken({
        sessionId: session.id,
        sessionTokenHash,
        now,
      });
      return ok(c, DeleteProfileStartResponseSchema, result);
    }

    const [previousAvatar] = await db
      .select({ id: profiles.avatarId })
      .from(profiles)
      .where(eq(profiles.id, session.profileId));
    const { careerIds, heldFirsts, hadComments, predictedCupIds } = await executeProfileDeletion(
      db,
      {
        profileId: session.profileId,
        sessionId: session.id,
        sessionTokenHash,
        confirmToken: body.confirmToken,
        now,
      },
    );
    // 지운 커리어가 가진 최초·서버 기록은 삭제 배치가 재계산 표시를 지웠으니, 목록 캐시만 비우면 다음 공개
    // 조회부터 조각씩 다시 훑어 채운다. 나머지는 바뀐 공개 캐시만 비운다(명예의 전당 목록은 TTL 1분).
    if (previousAvatar?.id) {
      purgeEdge(c, [`/v1/avatars/${previousAvatar.id}`]);
      if (c.env.CHAT) waitUntil(c, chatRoom(c.env.CHAT).updateAvatar(session.profileId, null));
    }
    if (heldFirsts) purgeEdge(c, STALE.firstsChanged());
    purgeEdge(c, [
      ...STALE.profileDeleted(careerIds, hadComments),
      ...predictedCupIds.map((id) => `/v1/cups/${id}/predictions`),
    ]);
    // T-11-167 Apple 토큰 해지는 삭제를 막지 않는다(실패는 기록만). 계정 데이터는 이미 지웠다.
    const code = body.appleAuthorizationCode;
    if (code)
      waitUntil(
        c,
        revokeAppleAuthorization(c.env, code, { nowS: Math.floor(Date.now() / 1000) }).then(
          // 키가 빠진 채 코드가 들어오면 가이드라인 5.1.1(v)을 못 지킨 것이라 경고로 남긴다.
          (r) =>
            r === 'skipped' &&
            console.warn(JSON.stringify({ job: 'apple-revoke', skipped: 'no keys' })),
          (e) =>
            console.error(JSON.stringify({ job: 'apple-revoke', error: String(e).slice(0, 200) })),
        ),
      );
    return c.body(null, 204);
  });
}

/** 본문 없음(빈 객체)은 1단계 요청이다. 그 외에는 contracts 스키마로 검증한다. */
function parseDeleteBody(json: unknown): Partial<DeleteProfileConfirmBody> {
  if (
    json !== null &&
    typeof json === 'object' &&
    !Array.isArray(json) &&
    Object.keys(json).length === 0
  ) {
    return {};
  }
  return parseWithAppError(DeleteProfileConfirmBodySchema, json);
}
