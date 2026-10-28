import {
  PushDeviceIdentitySchema,
  RegisterPushDeviceSchema,
  PushDeviceResultSchema,
  PushTestResultSchema,
  LegacyPushPreferencesSchema,
  PushPreferencesSchema,
  type PushPreferences,
  PutPushPreferencesSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import { getDb, type AppEnv } from '../env.js';
import { AppError } from '../errors.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import {
  registerPushDevice,
  unregisterPushDevice,
  ownPushDevice,
} from '../db/repos/pushDevices.js';
import { pushQueueText as pushQueueKo } from '../i18n/ko/pushQueue.js';
import { pushQueueText as pushQueueEn } from '../i18n/en/pushQueue.js';
import { pushQueueText as pushQueueJa } from '../i18n/ja/pushQueue.js';
import { pushQueueText as pushQueueZh } from '../i18n/zh/pushQueue.js';
import type { PushWork } from '../push/queuePublish.js';
import { reservePushTest } from '../push/testLimit.js';
import { sha256Hex } from '../db/hash.js';
import { queueNotification } from '../db/repos/notifications.js';
import { reqLang } from '../lang.js';
import { getPushPreferences, putPushPreferences } from '../db/repos/pushPreferences.js';
import { enforceLimit, NO_STORE, nowIso, ok, readBody, notFoundError } from './shared.js';

export function registerPushRoutes(app: Hono<AppEnv>) {
  // T-11-501 nudge를 아는 새 앱만 `?nudge=1`로 묻는다. 옛 앱에는 옛 모양을 그대로 돌려준다(strict 파싱).
  const withNudge = (c: { req: { query(key: string): string | undefined } }) =>
    c.req.query('nudge') === '1';
  const legacy = ({ nudge: _, ...rest }: PushPreferences) => rest;
  const appSession = (c: Parameters<typeof getSessionOrThrow>[0]) => {
    const session = getSessionOrThrow(c);
    if (session.channel !== 'app')
      throw new AppError({ code: 'FORBIDDEN', message: '앱에서 알림을 설정해 주세요.' });
    return session;
  };
  app.get('/v1/push/preferences', requireProfile, async (c) => {
    const session = appSession(c);
    const prefs = await getPushPreferences(getDb(c), session.profileId);
    return withNudge(c)
      ? ok(c, PushPreferencesSchema, prefs, 200, NO_STORE)
      : ok(c, LegacyPushPreferencesSchema, legacy(prefs), 200, NO_STORE);
  });
  app.put('/v1/push/preferences', requireProfile, async (c) => {
    const session = appSession(c);
    const input = readBody(c, PutPushPreferencesSchema);
    await enforceLimit(
      getDb(c),
      'PUSH_PREFERENCES',
      session.id,
      60,
      nowIso(),
      '잠시 뒤 알림 설정을 다시 시도해 주세요.',
    );
    const prefs = await putPushPreferences(getDb(c), session.profileId, input);
    return withNudge(c)
      ? ok(c, PushPreferencesSchema, prefs, 200, NO_STORE)
      : ok(c, LegacyPushPreferencesSchema, legacy(prefs), 200, NO_STORE);
  });
  app.put('/v1/push/device', requireProfile, async (c) => {
    const session = appSession(c);
    const input = readBody(c, RegisterPushDeviceSchema);
    const now = nowIso();
    await enforceLimit(
      getDb(c),
      'PUSH_DEVICE',
      session.id,
      30,
      now,
      '잠시 뒤 알림 설정을 다시 시도해 주세요.',
    );
    await registerPushDevice(c.env.DB, session, input, now);
    return ok(c, PushDeviceResultSchema, { enabled: true }, 200, NO_STORE);
  });
  app.delete('/v1/push/device', requireProfile, async (c) => {
    const session = appSession(c);
    const { installationId } = readBody(c, PushDeviceIdentitySchema);
    await enforceLimit(
      getDb(c),
      'PUSH_DEVICE',
      session.id,
      30,
      nowIso(),
      '잠시 뒤 알림 설정을 다시 시도해 주세요.',
    );
    await unregisterPushDevice(c.env.DB, installationId);
    return ok(c, PushDeviceResultSchema, { enabled: false }, 200, NO_STORE);
  });
  app.post('/v1/push/test', requireProfile, async (c) => {
    const session = appSession(c);
    const { installationId } = readBody(c, PushDeviceIdentitySchema);
    if (c.env.PUSH_TEST_ENABLED !== '1' || !c.env.PUSH_QUEUE)
      throw new AppError({ code: 'SERVICE_UNAVAILABLE', message: '알림 테스트 준비 중이에요.' });
    const now = nowIso();
    const device = await ownPushDevice(c.env.DB, session, installationId, now);
    if (!device)
      throw notFoundError('이 기기의 알림 받기를 먼저 켜 주세요.', 'PUSH_DEVICE_MISSING');
    const nextTestAt = await reservePushTest(c.env.DB, installationId, session.profileId, now);
    // 알림함에는 한국어 원문을 남기고(읽을 때 요청 언어로 바꾼다), 지금 보내는 푸시만 요청 언어로 보낸다.
    const notification = await queueNotification(c.env.DB, {
      profileId: session.profileId,
      sourceKey: `test:${now}`,
      now,
      content: {
        kind: 'test',
        title: '오프사이드 알림 테스트',
        body: '이 기기의 알림 연결을 확인하는 테스트예요.',
        target: { type: 'screen', screen: 'home' },
      },
    });
    const deliveryId = `test:${notification.id}`;
    // Reserve durable ownership before Queue publication; only its consumer sends or checks receipts.
    await c.env.DB.prepare(
      `INSERT INTO push_deliveries
      (id, notification_id, installation_hash, session_id, profile_id, token, state, attempts, due_at, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    )
      .bind(
        deliveryId,
        notification.id,
        await sha256Hex(installationId),
        session.id,
        session.profileId,
        device.token,
        new Date(Date.parse(now) + 120_000).toISOString(),
        new Date(Date.parse(now) + 86400_000).toISOString(),
        now,
      )
      .run();
    const work: PushWork = { version: 1, kind: 'test', id: deliveryId, lang: reqLang(c) };
    try {
      await c.env.PUSH_QUEUE!.send(work);
    } catch {
      // A publish can be ambiguous too. Cancel before reporting failure; never send directly.
      await c.env.DB.prepare(
        "UPDATE push_deliveries SET state='cancelled',token='',updated_at=? WHERE id=? AND state='pending'",
      )
        .bind(nowIso(), deliveryId)
        .run();
      throw new AppError({
        code: 'SERVICE_UNAVAILABLE',
        message: { ko: pushQueueKo, en: pushQueueEn, ja: pushQueueJa, zh: pushQueueZh }[reqLang(c)]
          .publishFailed,
      });
    }
    return ok(c, PushTestResultSchema, { accepted: true, nextTestAt }, 200, NO_STORE);
  });
}
