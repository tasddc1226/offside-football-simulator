import {
  AUTHORIZATION_HEADER,
  PatchProfileSettingsBodySchema,
  ProfileSchema,
  successEnvelope,
  type Profile,
  type ProfileSettings,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { issueSession, sessionCookie } from '../auth/session.js';
import { getProfile, createProfile, touchLastSeen, updateSettings, type ProfileRecord } from '../db/repos/profiles.js';
import { revokeSession } from '../db/repos/sessions.js';
import { getDb, type AppEnv } from '../env.js';
import { AppError, parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';

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
}
