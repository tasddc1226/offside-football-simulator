import {
  PushDeviceIdentitySchema,
  RegisterPushDeviceSchema,
  PushDeviceResultSchema,
  PushTestResultSchema,
  PushPreferencesSchema,
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
  rememberPushTestTicket,
} from '../db/repos/pushDevices.js';
import { sendPushTest } from '../push/expo.js';
import { reservePushTest } from '../push/testLimit.js';
import { sha256Hex } from '../db/hash.js';
import { latePushResult } from '../push/result.js';
import { queueNotification } from '../db/repos/notifications.js';
import { reqLang } from '../lang.js';
import { getPushPreferences, putPushPreferences } from '../db/repos/pushPreferences.js';
import { enforceLimit, NO_STORE, nowIso, ok, readBody, notFoundError } from './shared.js';

export function registerPushRoutes(app: Hono<AppEnv>) {
  const appSession = (c: Parameters<typeof getSessionOrThrow>[0]) => {
    const session = getSessionOrThrow(c);
    if (session.channel !== 'app')
      throw new AppError({ code: 'FORBIDDEN', message: '앱에서 알림을 설정해 주세요.' });
    return session;
  };
  app.get('/v1/push/preferences', requireProfile, async (c) => {
    const session = appSession(c);
    return ok(
      c,
      PushPreferencesSchema,
      await getPushPreferences(getDb(c), session.profileId),
      200,
      NO_STORE,
    );
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
    return ok(
      c,
      PushPreferencesSchema,
      await putPushPreferences(getDb(c), session.profileId, input),
      200,
      NO_STORE,
    );
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
    if (c.env.PUSH_TEST_ENABLED !== '1')
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
    // The same receipt worker checks manual test tickets, without re-sending them.
    await c.env.DB.prepare(
      `INSERT INTO push_deliveries
      (id, notification_id, installation_hash, session_id, profile_id, token, state, attempts, due_at, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'sending', 1, ?, ?, ?)`,
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
    try {
      const ticketId = await sendPushTest(
        device.token,
        c.env.EXPO_PUSH_ACCESS_TOKEN,
        fetch,
        notification.id ?? undefined,
        reqLang(c),
      );
      await c.env.DB.prepare(
        "UPDATE push_deliveries SET state = 'accepted', ticket_id = ?, due_at = ?, updated_at = ? WHERE id = ? AND state = 'sending'",
      )
        .bind(ticketId, new Date(Date.now() + 900_000).toISOString(), nowIso(), deliveryId)
        .run();
      await latePushResult(c.env.DB, 'push_deliveries', deliveryId, 'accepted', nowIso()).run();
      await rememberPushTestTicket(
        c.env.DB,
        installationId,
        { token: device.token, sessionId: session.id },
        ticketId,
        now,
      );
    } catch (e) {
      const failed =
        e instanceof AppError && (e.details as { reason?: string } | undefined)?.reason;
      await c.env.DB.prepare(
        "UPDATE push_deliveries SET state = ?, token = '', updated_at = ? WHERE id = ? AND state = 'sending'",
      )
        .bind(failed ? 'failed' : 'unknown', nowIso(), deliveryId)
        .run();
      await latePushResult(
        c.env.DB,
        'push_deliveries',
        deliveryId,
        failed ? 'failed' : 'unknown',
        nowIso(),
      ).run();
      if (
        e instanceof AppError &&
        (e.details as { reason?: string } | undefined)?.reason === 'PUSH_DEVICE_NOT_REGISTERED'
      )
        await unregisterPushDevice(c.env.DB, installationId, {
          token: device.token,
          sessionId: session.id,
        });
      throw e;
    }
    return ok(c, PushTestResultSchema, { accepted: true, nextTestAt }, 200, NO_STORE);
  });
}
