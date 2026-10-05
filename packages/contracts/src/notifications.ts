import { z } from 'zod';

export const NotificationIdSchema = z.string().regex(/^ntf_[A-Za-z0-9_-]{1,80}$/);
export const NotificationTargetSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('board'),
      board: z.enum(['notice', 'release']),
      postId: z.string().regex(/^pst_[A-Za-z0-9_-]{1,80}$/),
    })
    .strict(),
  z
    .object({
      type: z.literal('screen'),
      screen: z.enum(['home', 'owner', 'team', 'market', 'settings']),
    })
    .strict(),
]);
export const NotificationContentSchema = z
  .object({
    kind: z.enum(['news', 'test', 'return', 'team', 'market', 'social']),
    title: z.string().trim().min(1).max(100),
    body: z.string().trim().min(1).max(500),
    target: NotificationTargetSchema,
  })
  .strict();
export const NotificationSchema = NotificationContentSchema.extend({
  id: NotificationIdSchema,
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export const NotificationCursorSchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: NotificationIdSchema,
  })
  .strict();
export const NotificationListQuerySchema = z
  .object({
    cursor: z.string().max(300).optional(),
    unread: z.enum(['1']).optional(),
  })
  .strict();
export const NotificationListSchema = z.object({
  items: z.array(NotificationSchema).max(20),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
});
export const NotificationReadSchema = z.object({ readAt: z.iso.datetime() });
export const NotificationReadAllBodySchema = z.object({ through: z.iso.datetime() }).strict();
export const NotificationReadAllSchema = z.object({ updated: z.number().int().nonnegative() });
export type AppNotification = z.infer<typeof NotificationSchema>;
export type NotificationContent = z.infer<typeof NotificationContentSchema>;
export type NotificationTarget = z.infer<typeof NotificationTargetSchema>;
export type NotificationList = z.infer<typeof NotificationListSchema>;
