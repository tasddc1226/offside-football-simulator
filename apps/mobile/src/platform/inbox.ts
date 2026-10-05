import { router } from 'expo-router';
import { proxy } from 'valtio';
import {
  NotificationIdSchema,
  NotificationTargetSchema,
  type NotificationTarget,
} from '@offside/contracts';
import { createNotificationInbox, initialInboxState } from '@offside/app-core/notification-inbox';
import { ensureSession, onSessionChanged } from './session';
import { go, openBoard } from '../game/nav';

export const inboxState = proxy(initialInboxState());
export const inbox = createNotificationInbox(inboxState);
onSessionChanged(() => inbox.reset());
export async function loadInbox(options: Parameters<typeof inbox.load>[0] = {}) {
  if (await ensureSession()) await inbox.load(options);
  else inboxState.error = '알림함에 연결하지 못했어요. 다시 시도해 주세요.';
}
export function openInbox(id?: string) {
  if (id && NotificationIdSchema.safeParse(id).success) router.push(`/notifications/${id}`);
  else router.push('/notifications');
}
export function openInboxTarget(target: NotificationTarget) {
  const parsed = NotificationTargetSchema.safeParse(target);
  if (!parsed.success) return;
  router.replace('/');
  if (parsed.data.type === 'board') openBoard(parsed.data.board, parsed.data.postId);
  else go(parsed.data.screen);
}
