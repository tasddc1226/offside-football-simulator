// T-11-547 앱 아이콘 뱃지(안 읽은 알림 수). 앱이 꺼져 있을 때는 서버 푸시의 badge가 숫자를 맞추고
// (apps/api/src/push/badge.ts), 앱에서는 알림함이 아는 안 읽은 개수로 다시 맞춘다. 개수를 알려고 따로 요청하지 않는다.
// 안드로이드는 런처마다 다르다: 기본 런처는 트레이 알림으로 점을 그리고, 숫자는 삼성처럼 받는 런처만 보인다.
import * as Notifications from 'expo-notifications';

export function showBadge(count: number) {
  void Notifications.setBadgeCountAsync(count).catch(() => {});
  // 다 읽었으면 트레이도 비운다. 안드로이드 점·숫자는 트레이에 남은 알림을 따른다.
  if (count === 0) void Notifications.dismissAllNotificationsAsync().catch(() => {});
}

/** 알림함 목록 없이(푸시에서 바로 · 상세만 열고) 읽었으면 개수를 모른다. 지금 숫자에서 하나 뺀다. */
export async function readOneBadge() {
  const now = await Notifications.getBadgeCountAsync().catch(() => 0);
  if (now > 0) showBadge(now - 1);
}
