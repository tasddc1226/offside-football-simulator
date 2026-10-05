import {
  PushDeviceIdentitySchema,
  RegisterPushDeviceSchema,
  PushDeviceResultSchema,
  PushTestResultSchema,
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
import { queueNotification } from '../db/repos/notifications.js';
import { enforceLimit, NO_STORE, nowIso, ok, readBody, notFoundError } from './shared.js';

export function registerPushRoutes(app: Hono<AppEnv>) {
  const appSession = (c: Parameters<typeof getSessionOrThrow>[0]) => {
    const session = getSessionOrThrow(c);
    if (session.channel !== 'app')
      throw new AppError({ code: 'FORBIDDEN', message: '앱에서 알림을 설정해 주세요.' });
    return session;
  };
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
    try {
      const ticketId = await sendPushTest(
        device.token,
        c.env.EXPO_PUSH_ACCESS_TOKEN,
        fetch,
        notification.id ?? undefined,
      );
      await rememberPushTestTicket(
        c.env.DB,
        installationId,
        { token: device.token, sessionId: session.id },
        ticketId,
        now,
      );
    } catch (e) {
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
