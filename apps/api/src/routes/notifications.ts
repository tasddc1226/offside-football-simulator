import {
  NotificationIdSchema,
  NotificationListQuerySchema,
  NotificationListSchema,
  NotificationSchema,
  NotificationReadSchema,
  NotificationReadAllBodySchema,
  NotificationReadAllSchema,
} from '@offside/contracts';
import type { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { getSessionOrThrow, requireProfile } from '../middleware/requireProfile.js';
import { parseWithAppError } from '../errors.js';
import {
  listNotifications,
  ownNotification,
  readNotification,
  readAllNotifications,
} from '../db/repos/notifications.js';
import { NO_STORE, nowIso, notFoundError, ok, readBody } from './shared.js';

export function registerNotificationRoutes(app: Hono<AppEnv>) {
  app.get('/v1/notifications', requireProfile, async (c) => {
    const query = parseWithAppError(NotificationListQuerySchema, c.req.query());
    const data = await listNotifications(c.env.DB, getSessionOrThrow(c).profileId, nowIso(), query);
    return ok(c, NotificationListSchema, data, 200, NO_STORE);
  });
  app.post('/v1/notifications/read-all', requireProfile, async (c) => {
    const { through } = readBody(c, NotificationReadAllBodySchema);
    const now = nowIso();
    const updated = await readAllNotifications(
      c.env.DB,
      getSessionOrThrow(c).profileId,
      through > now ? now : through,
      now,
    );
    return ok(c, NotificationReadAllSchema, { updated }, 200, NO_STORE);
  });
  app.get('/v1/notifications/:id', requireProfile, async (c) => {
    const id = parseWithAppError(NotificationIdSchema, c.req.param('id'));
    const data = await ownNotification(c.env.DB, getSessionOrThrow(c).profileId, id, nowIso());
    if (!data) throw notFoundError('이 알림을 찾을 수 없어요.', 'NOTIFICATION_MISSING');
    return ok(c, NotificationSchema, data, 200, NO_STORE);
  });
  app.post('/v1/notifications/:id/read', requireProfile, async (c) => {
    const id = parseWithAppError(NotificationIdSchema, c.req.param('id'));
    const row = await readNotification(c.env.DB, getSessionOrThrow(c).profileId, id, nowIso());
    if (!row) throw notFoundError('이 알림을 찾을 수 없어요.', 'NOTIFICATION_MISSING');
    return ok(c, NotificationReadSchema, { readAt: row.read_at }, 200, NO_STORE);
  });
}
