import { router } from 'expo-router';
import { proxy, subscribe } from 'valtio';
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
import { recheckOwner } from '@offside/app-core/api/friendPending';
import { trackPushInteraction } from './pushTracking';
import { readOneBadge, showBadge } from './badge';

export const inboxState = proxy(initialInboxState());
export const inbox = createNotificationInbox(inboxState, {
  // 목록을 불러왔으면 줄어든 unreadCount를 아래 구독이 뱃지로 옮긴다. 아니면 지금 숫자에서 하나 뺀다.
  onRead: (wasUnread) => {
    if (wasUnread === undefined || (wasUnread && !inboxState.loaded)) void readOneBadge();
  },
});
// T-11-547 알림함 목록을 불러온 뒤에는 그 안 읽은 개수를 앱 아이콘 뱃지로 맞춘다.
let badged: number | undefined;
subscribe(inboxState, () => {
  const count = inboxState.loaded ? inboxState.unreadCount : undefined;
  if (count === badged) return;
  badged = count;
  if (count !== undefined) showBadge(count);
});
onSessionChanged(() => {
  inbox.reset();
  showBadge(0);
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
    if (parsed.data.screen === 'home') {
      recheckOwner();
      notificationDestination.home++;
    }
    if (parsed.data.screen === 'market' && kind === 'market') {
      invalidateApiCache('/v1/market');
      notificationDestination.market = true;
    }
    go(parsed.data.screen);
  }
  if (notificationId) void trackPushInteraction(notificationId, 'target_open');
}
