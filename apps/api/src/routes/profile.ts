import {
  AUTHORIZATION_HEADER,
  PatchProfileSettingsBodySchema,
  ProfileSchema,
  successEnvelope,
  type Profile,
  type ProfileSettings,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { issueSession, readSessionToken, sessionCookie } from '../auth/session.js';
import { sha256Hex } from '../db/hash.js';
import { getProfile, createProfile, touchLastSeen, updateSettings, type ProfileRecord } from '../db/repos/profiles.js';
import { revokeSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { executeProfileDeletion, issueDeleteConfirmToken } from '../profile/delete-profile.js';
import { issueRecoveryCode } from '../profile/issue-recovery-code.js';
import { recoverProfile, type MergeChoice } from '../profile/recover.js';

const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

function toProfileResponse(record: ProfileRecord): Profile {
  return {
    id: record.id,
    settings: record.settings,
    linked: { google: record.googleSub !== null, toss: record.tossAnonKeyHash !== null },
    recoveryCodeIssuedAt: record.recoveryCodeIssuedAt,
    createdAt: record.createdAt,
  };
}

export function registerProfileRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/profile', async (c) => {
    const db = getDb(c);
    const now = new Date().toISOString();
    const existingSession = c.get('session');
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
      data: toProfileResponse(record),
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
      data: toProfileResponse(updated),
      meta: { requestId: c.get('requestId') },
    });
    return c.json(body, 200);
  });

  app.post('/v1/profile/recovery-code', requireProfile, idempotency, async (c) => {
    const db = getDb(c);
    const session = getSessionOrThrow(c);
    const now = new Date().toISOString();

    const result = await issueRecoveryCode(db, { profileId: session.profileId, now });

    return c.json({ data: result, meta: { requestId: c.get('requestId') } }, 200);
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

    const body = parseRecoverBody(json);
    const now = new Date().toISOString();
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

    const result = await recoverProfile(db, {
      code: body.code,
      ...(body.mergeChoice !== undefined ? { mergeChoice: body.mergeChoice } : {}),
      currentProfileId: session.profileId,
      sessionId: session.id,
      ip,
      now,
    });

    return c.json({ data: result, meta: { requestId: c.get('requestId') } }, 200);
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
      return c.json({ data: result, meta: { requestId: c.get('requestId') } }, 200);
    }

    await executeProfileDeletion(db, {
      profileId: session.profileId,
      sessionId: session.id,
      sessionTokenHash,
      confirmToken: body.confirmToken,
      now,
    });
    return c.body(null, 204);
  });
}

/** 로컬 검증(브리프: contracts는 T-1-006이 담당하므로 여기서는 손으로 검증한다). */
function parseRecoverBody(json: unknown): { code: string; mergeChoice?: MergeChoice } {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바르지 않습니다.' });
  }
  const record = json as Record<string, unknown>;

  if (typeof record.code !== 'string' || record.code.trim().length === 0) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: 'code가 필요합니다.',
      details: { issues: [{ path: ['code'], message: '문자열이어야 합니다.' }] },
    });
  }

  if (record.mergeChoice === undefined) {
    return { code: record.code };
  }
  if (record.mergeChoice !== 'MOVE_TO_LINKED' && record.mergeChoice !== 'KEEP_LINKED_ONLY') {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: 'mergeChoice가 올바르지 않습니다.',
      details: { issues: [{ path: ['mergeChoice'], message: 'MOVE_TO_LINKED 또는 KEEP_LINKED_ONLY여야 합니다.' }] },
    });
  }
  return { code: record.code, mergeChoice: record.mergeChoice };
}

function parseDeleteBody(json: unknown): { confirmToken?: string } {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new AppError({ code: 'VALIDATION_FAILED', message: '요청 본문이 올바르지 않습니다.' });
  }
  const record = json as Record<string, unknown>;

  if (record.confirmToken === undefined) {
    return {};
  }
  if (typeof record.confirmToken !== 'string' || record.confirmToken.length === 0) {
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: 'confirmToken이 올바르지 않습니다.',
      details: { issues: [{ path: ['confirmToken'], message: '문자열이어야 합니다.' }] },
    });
  }
  return { confirmToken: record.confirmToken };
}
