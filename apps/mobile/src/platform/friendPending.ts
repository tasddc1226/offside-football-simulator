// T-11-142 받은 친구 신청 수 — 하단 '구단주' 탭 · 구단주 '내 팀' · 내 팀 '경기' 탭 · '친구' 버튼의 점(웹 App.svelte).
import { AppState } from 'react-native';
import { pendingFriendRequests } from '@offside/app-core/api/friendPending';
import { appState } from '../store';

/** fresh면 메모를 건너뛴다(친구 푸시를 받았을 때). */
export const refreshFriendPending = (fresh = false) =>
  void pendingFriendRequests(fresh).then((n) => (appState.friendReq = n));

let watching = false;
/** 구단주 화면을 연 적 있는 기기만 묻는다 — 앱을 열 때와 앱으로 돌아올 때(메모 5분). */
export function watchFriendPending() {
  if (watching) return;
  watching = true;
  refreshFriendPending();
  AppState.addEventListener('change', (s) => {
    if (s === 'active') refreshFriendPending();
  });
}
