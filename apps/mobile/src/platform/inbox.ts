import { router } from 'expo-router';
import { proxy } from 'valtio';
import {
  NotificationIdSchema,
  NotificationTargetSchema,
  type NotificationTarget,
  type AppNotification,
} from '@offside/contracts';
import { createNotificationInbox, initialInboxState } from '@offside/app-core/notification-inbox';
import { ensureSession, onSessionChanged } from './session';
import { go, openBoard } from '../game/nav';
import { inboxText as L } from '@offside/app-core/i18n/ko/inbox';
import { appState } from '../store';
import { notificationDestination } from './notificationDestination';
import { invalidateApiCache } from '@offside/app-core/api/client';
import { trackPushInteraction } from './pushTracking';

export const inboxState = proxy(initialInboxState());
export const inbox = createNotificationInbox(inboxState);
onSessionChanged(() => {
  inbox.reset();
  Object.assign(notificationDestination, { friends: false, history: false, market: false });
});
export async function loadInbox(options: Parameters<typeof inbox.load>[0] = {}) {
  if (await ensureSession()) await inbox.load(options);
  else inboxState.error = L.connectFailed;
}
export function openInbox(id?: string) {
  if (id && NotificationIdSchema.safeParse(id).success) router.push(`/notifications/${id}`);
  else router.push('/notifications');
}
/** 내 팀 '경기' 탭의 친구 목록을 연다(구단주 '내 팀'의 받은 신청 점, 웹 openFriends). */
export function openFriends() {
  notificationDestination.friends = true;
  invalidateApiCache('/v1/friends');
  appState.teamView = 'opponents';
  go('team');
}
export function openInboxTarget(
  target: NotificationTarget,
  kind?: AppNotification['kind'],
  notificationId?: string,
) {
  const parsed = NotificationTargetSchema.safeParse(target);
  if (!parsed.success) return;
  router.dismissTo('/');
  if (parsed.data.type === 'board') {
    invalidateApiCache(`/v1/boards/posts/${parsed.data.postId}`);
    openBoard(parsed.data.board, parsed.data.postId);
  } else {
    if (parsed.data.screen === 'team') {
      notificationDestination.friends = kind === 'social';
      notificationDestination.history = kind === 'team';
      invalidateApiCache('/v1/owner-team');
      if (kind === 'social') invalidateApiCache('/v1/friends');
      if (kind === 'social') appState.teamView = 'opponents';
      else if (kind === 'team') appState.teamView = 'history';
    }
    if (parsed.data.screen === 'market' && kind === 'market') {
      invalidateApiCache('/v1/market');
      notificationDestination.market = true;
    }
    go(parsed.data.screen);
  }
  if (notificationId) void trackPushInteraction(notificationId, 'target_open');
}
