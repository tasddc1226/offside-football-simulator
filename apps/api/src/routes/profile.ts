import {
  AUTHORIZATION_HEADER,
  DeleteProfileConfirmBodySchema,
  DeleteProfileStartResponseSchema,
  IssueRecoveryCodeResponseSchema,
  PatchProfileSettingsBodySchema,
  ProfileSchema,
  PutNicknameBodySchema,
  RecoverProfileBodySchema,
  RecoverProfileResponseSchema,
  successEnvelope,
  type DeleteProfileConfirmBody,
  type Profile,
  type ProfileSettings,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { commentIdentity } from '../auth/admin.js';
import { issueSession, readSessionToken, sessionCookie } from '../auth/session.js';
import { sha256Hex } from '../db/hash.js';
import { getProfile, createProfile, setNickname, touchLastSeen, updateSettings, type ProfileRecord } from '../db/repos/profiles.js';
import { isAcceptablePublicName, isReservedNickname } from '@offside/contracts/content-filter';
import { revokeSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseJsonBody, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { resolveSession } from '../middleware/session.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';
import { purgeEdge, waitUntil } from '../edgeCache.js';
import { STALE } from '../edgeKeys.js';
import { recomputeFirsts } from '../db/repos/firsts.js';
import { issueRecoveryCode } from '../profile/issue-recovery-code.js';
import { maskEmail } from '../profile/mask-email.js';
import { recoverProfile } from '../profile/recover.js';

const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

function buildProfileResponse(record: ProfileRecord, adminEmails: string | undefined): Profile {
  return {
    id: record.id,
    settings: record.settings,
    linked: { google: record.googleSub !== null, toss: record.tossAnonKeyHash !== null },
    recoveryCodeIssuedAt: record.recoveryCodeIssuedAt,
    createdAt: record.createdAt,
    googleEmailMasked: maskEmail(record.email),
    nickname: commentIdentity(record, adminEmails).nickname,
  };
}

export function registerProfileRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/profile', async (c) => {
    const db = getDb(c);
    const now = new Date().toISOString();
    const existingSession = await resolveSession(c);
    const bearerPresent = Boolean(c.req.header(AUTHORIZATION_HEADER));

    // 결정 3: Bearer가 왔는데 무효면 쿠키로 폴백하지 않고 401이다.
    if (!existingSession && bearerPresent) {
      throw new AppError({ code: 'PROFILE_REQUIRED', message: '세션이 유효하지 않습니다.' });
    }

    let record: ProfileRecord | undefined = existingSession ? await getProfile(db, existingSession.profileId) : undefined;

    if (existingSession && !record) {
      // 세션은 유효하지만 프로필이 사라졌다. 세션을 폐기하고 아래에서 새로 발급한다.
      await revokeSession(db, existingSession.id, now);
    }

    if (!record) {
      record = await createProfile(db);
      const { token } = await issueSession(db, { profileId: record.id, channel: 'web', now });
      c.header('Set-Cookie', sessionCookie(token));
    } else if (Date.now() - Date.parse(record.lastSeenAt) >= LAST_SEEN_REFRESH_MS) {
      await touchLastSeen(db, record.id, now);
      record = { ...record, lastSeenAt: now };
    }

    const body = successEnvelope(ProfileSchema).parse({
      data: buildProfileResponse(record, c.env.ADMIN_EMAILS),
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });

  app.patch('/v1/profile/settings', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const rawBody = c.get('rawBody') ?? '';

    let json: unknown;
    try {
      json = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
    }

    const patch = parseWithAppError(PatchProfileSettingsBodySchema, json);
    // zod .partial()의 추론 타입은 exactOptionalPropertyTypes에서 `key?: T | undefined`가 되어
    // `Partial<ProfileSettings>`(`key?: T`)와 어긋난다. 없는 키를 걷어내 좁힌다.
    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<ProfileSettings>;
    const updated = await updateSettings(db, session.profileId, definedPatch);

    const body = successEnvelope(ProfileSchema).parse({
      data: buildProfileResponse(updated, c.env.ADMIN_EMAILS),
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });

  // T-10-028 댓글 닉네임. 구글 로그인한 프로필만 정할 수 있고, 다른 사람과 겹치면 409.
  app.put('/v1/profile/nickname', requireProfile, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const { nickname } = parseWithAppError(PutNicknameBodySchema, parseJsonBody(c.get('rawBody') ?? ''));
    const profile = await getProfile(db, session.profileId);
    const identity = commentIdentity(profile, c.env.ADMIN_EMAILS);
    if (!profile || !identity.google) {
      throw new AppError({ code: 'FORBIDDEN', message: '구글로 로그인하면 닉네임을 정할 수 있어요.', details: { reason: 'GOOGLE_LOGIN_REQUIRED' } });
    }
    if (identity.admin) {
      throw new AppError({ code: 'FORBIDDEN', message: `운영자 계정의 댓글 닉네임은 '${identity.nickname}'로 고정돼요.`, details: { reason: 'ADMIN_NICKNAME_FIXED' } });
    }
    if (isReservedNickname(nickname)) {
      throw new AppError({ code: 'VALIDATION_FAILED', message: `'운영자'처럼 운영진으로 보이는 닉네임은 쓸 수 없어요.`, details: { reason: 'RESERVED_NICKNAME' } });
    }
    if (!isAcceptablePublicName(nickname)) {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '쓸 수 없는 닉네임이에요.', details: { reason: 'BLOCKED_WORD' } });
    }
    const updated = await setNickname(db, profile.id, nickname);
    if (updated === 'taken') {
      throw new AppError({ code: 'VALIDATION_FAILED', status: 409, message: '이미 쓰고 있는 닉네임이에요.', details: { reason: 'NICKNAME_TAKEN' } });
    }
    const body = successEnvelope(ProfileSchema).parse({ data: buildProfileResponse(updated, c.env.ADMIN_EMAILS), meta: { requestId: c.get('requestId') } });
    return c.json(body, 200);
  });

  app.post('/v1/profile/recovery-code', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const now = new Date().toISOString();

    const result = await issueRecoveryCode(db, { profileId: session.profileId, now });

    const body = successEnvelope(IssueRecoveryCodeResponseSchema).parse({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });

  app.post('/v1/profile/recover', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const rawBody = c.get('rawBody') ?? '';

    let json: unknown;
    try {
      json = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
    }

    const parsed = parseWithAppError(RecoverProfileBodySchema, json);
    const now = new Date().toISOString();
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

    const result = await recoverProfile(db, {
      code: parsed.code,
      currentProfileId: session.profileId,
      sessionId: session.id,
      ip,
      now,
    });

    const body = successEnvelope(RecoverProfileResponseSchema).parse({
      data: result,
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });

  app.post('/v1/profile/delete', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const rawBody = c.get('rawBody') ?? '';

    let json: unknown;
    try {
      json = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    } catch {
      throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바른 JSON이 아닙니다.' });
    }

    const body = parseDeleteBody(json);
    const now = new Date().toISOString();
    const rawToken = readSessionToken(c);
    if (!rawToken) {
      throw new AppError({ code: 'PROFILE_REQUIRED', message: '프로필 세션이 필요합니다.' });
    }
    const sessionTokenHash = await sha256Hex(rawToken);

    if (body.confirmToken === undefined) {
      const result = await issueDeleteConfirmToken({ sessionId: session.id, sessionTokenHash, now });
      const responseBody = successEnvelope(DeleteProfileStartResponseSchema).parse({
        data: result,
        meta: { requestId: c.get('requestId') },
      });
      return c.json(responseBody, 200);
    }

    const { careerIds, heldFirsts, hadComments } = await executeProfileDeletion(db, {
      profileId: session.profileId,
      sessionId: session.id,
      sessionTokenHash,
      confirmToken: body.confirmToken,
      now,
    });
    // 지운 최초 기록은 응답 뒤에 다시 계산하고 그 캐시를 비운다. 소급 표시는 삭제 배치에서 이미 지웠으니,
    // 재계산이 끝나기 전·실패한 뒤의 공개 조회도 스스로 다시 계산한다. 나머지는 바뀐 공개 캐시만 비운다
    // (명예의 전당 목록은 TTL 1분).
    if (heldFirsts) waitUntil(c, recomputeFirsts(db).finally(() => purgeEdge(c, STALE.firstsChanged())));
    purgeEdge(c, STALE.profileDeleted(careerIds, hadComments));
    return c.body(null, 204);
  });
}

/** 본문 없음(빈 객체)은 1단계 요청이다. 그 외에는 contracts 스키마로 검증한다. */
function parseDeleteBody(json: unknown): { confirmToken?: string } {
  if (json !== null && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length === 0) {
    return {};
  }
  const parsed: DeleteProfileConfirmBody = parseWithAppError(DeleteProfileConfirmBodySchema, json);
  return { confirmToken: parsed.confirmToken };
}
